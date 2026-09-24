import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { createMemberAccount } from './member-account.js';
import { isContentVisible } from './moderation.js';
import { RequestError } from './request.js';

const id = '11111111-1111-4111-8111-111111111111';
const owner = '22222222-2222-4222-8222-222222222222';
const visitor = '33333333-3333-4333-8333-333333333333';
function fixture(userId = owner) {
  const item = { id, kind: 'service', status: 'PUBLISHED', ownerState: 'ACTIVE', version: 1, createdAt: new Date('2026-09-01'), updatedAt: new Date('2026-09-01'), payload: { title: 'Mathematics lessons', subtitle: 'Individual mathematics lessons for school students.', category: 'Tutoring & education', zone: 'B1', providerName: 'Nour Hassan', whatsapp: '+201000000000', availability: 'Evenings', pricing: '200 EGP', advertiserType: 'individual', offer: { kind: 'First session free', discount: 'First lesson free', validUntil: '2026-10-01' } } };
  const publicItem = () => ({ ...item, uploads: [], user: { status: 'ACTIVE', profile: { displayName: 'Nour', verificationState: 'UNVERIFIED' } } });
  const prisma = {
    $queryRaw: vi.fn().mockResolvedValue([{ count: 1 }]),
    submission: {
      findUnique: vi.fn(async () => publicItem()),
      findFirst: vi.fn(async ({ where }) => where.userId === owner && where.id === id ? { ...item } : null),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn(async ({ where, data }) => {
        if (where.version !== item.version || where.status !== item.status || where.ownerState !== item.ownerState || where.userId !== owner) return { count: 0 };
        Object.assign(item, { ...data, version: item.version + 1 });
        return { count: 1 };
      }),
    },
    savedSubmission: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0), upsert: vi.fn(), deleteMany: vi.fn() },
    contactActivity: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn(), deleteMany: vi.fn() },
    publicationPause: { findFirst: vi.fn().mockResolvedValue(null) },
    auditLog: { create: vi.fn() },
  };
  prisma.$transaction = vi.fn(callback => callback(prisma));
  const auth = { session: vi.fn().mockResolvedValue({ userId }), protect: vi.fn().mockResolvedValue({ userId }) };
  const handler = createMemberAccount({ prisma, auth });
  const send = vi.fn();
  const call = (section, method = 'GET', body = {}) => {
    const path = '/api/account/' + section;
    const request = Object.assign(Readable.from([JSON.stringify(body)]), { method, headers: {}, url: path });
    return handler.handle(request, {}, path.split('?')[0].split('/').filter(Boolean), send);
  };
  const edit = changes => call(`listings/${id}`, 'POST', { version: item.version, action: 'edit', changes });
  const action = action => call(`listings/${id}`, 'POST', { version: item.version, action });
  return { item, publicItem, prisma, auth, send, call, edit, action };
}

describe('member account privacy and saved items', () => {
  it('requires authentication for all account reads', async () => {
    const f = fixture();
    f.auth.session.mockRejectedValue(new RequestError(401, 'Please sign in'));
    for (const route of ['saved', 'activity', 'listings?kind=service']) await expect(f.call(route)).rejects.toMatchObject({ status: 401 });
    expect(f.prisma.submission.findMany).not.toHaveBeenCalled();
  });
  it('uses the CSRF-protected session before writing or deleting data', async () => {
    const f = fixture();
    f.auth.protect.mockRejectedValue(new RequestError(403, 'Invalid security token'));
    for (const section of ['saved', 'activity', 'listings']) await expect(f.call(`${section}/${id}`, 'POST', {})).rejects.toMatchObject({ status: 403 });
    await expect(f.call(`saved/${id}`, 'DELETE')).rejects.toMatchObject({ status: 403 });
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });
  it('scopes reads and removals to the signed-in member', async () => {
    const f = fixture(visitor);
    await f.call('saved');
    await f.call('activity?page=1');
    await f.call('listings?kind=service&page=2');
    await f.call(`saved/${id}`, 'DELETE', { userId: owner });
    await f.call(`activity/${id}`, 'DELETE', { userId: owner });
    expect(f.prisma.savedSubmission.findMany.mock.calls[0][0].where).toEqual({ userId: visitor });
    expect(f.prisma.contactActivity.findMany.mock.calls[0][0]).toMatchObject({ where: { userId: visitor }, skip: 20, take: 21 });
    expect(f.prisma.submission.findMany.mock.calls[0][0]).toMatchObject({ where: { userId: visitor, kind: 'service' }, skip: 40, take: 21 });
    expect(f.prisma.savedSubmission.deleteMany).toHaveBeenCalledWith({ where: { userId: visitor, submissionId: id } });
    expect(f.prisma.contactActivity.deleteMany).toHaveBeenCalledWith({ where: { userId: visitor, submissionId: id } });
  });
  it('saves idempotently without accepting a forged owner', async () => {
    const f = fixture(visitor);
    await f.call(`saved/${id}`, 'POST', { userId: owner });
    expect(f.prisma.savedSubmission.upsert).toHaveBeenCalledWith({ where: { userId_submissionId: { userId: visitor, submissionId: id } }, update: {}, create: { userId: visitor, submissionId: id } });
  });
  it('bounds the shortlist while allowing an existing save to be retried', async () => {
    const f = fixture();
    f.prisma.savedSubmission.count.mockResolvedValue(500);
    await expect(f.call(`saved/${id}`, 'POST')).rejects.toMatchObject({ status: 409 });
    f.prisma.savedSubmission.findUnique.mockResolvedValue({ submissionId: id });
    await f.call(`saved/${id}`, 'POST');
    expect(f.prisma.savedSubmission.upsert).toHaveBeenCalledOnce();
  });
  it.each(['PAUSED', 'CLOSED', 'SOLD', 'REMOVED'])('redacts saved %s listings and blocks new saves/contacts', async ownerState => {
    const f = fixture();
    f.item.ownerState = ownerState;
    f.prisma.savedSubmission.findMany.mockResolvedValue([{ submissionId: id, submission: f.publicItem() }]);
    await f.call('saved');
    expect(f.send.mock.calls[0][2]).toEqual({ saved: [{ id, submission: null }] });
    await expect(f.call(`saved/${id}`, 'POST')).rejects.toMatchObject({ status: 404 });
    await expect(f.call(`activity/${id}`, 'POST')).rejects.toMatchObject({ status: 404 });
    expect(await isContentVisible(f.prisma, 'service', `submission-${id}`)).toBe(false);
  });
  it.each(['PENDING_REVIEW', 'HIDDEN', 'REMOVED'])('blocks nonpublic %s records', async status => {
    const f = fixture();
    f.item.status = status;
    await expect(f.call(`saved/${id}`, 'POST')).rejects.toMatchObject({ status: 404 });
  });
  it('stores contact-open activity from server data without claiming a purchase', async () => {
    const f = fixture(visitor);
    await f.call(`activity/${id}`, 'POST', { title: 'Forged', providerName: 'Fake seller', purchased: true });
    const data = f.prisma.contactActivity.upsert.mock.calls[0][0].create;
    expect(data).toMatchObject({ userId: visitor, submissionId: id, title: 'Mathematics lessons', providerName: 'Nour Hassan', kind: 'service' });
    expect(data.purchased).toBeUndefined();
    expect(data.whatsapp).toBeUndefined();
  });
  it('does not record contact activity where no contact link exists', async () => {
    const f = fixture();
    f.item.kind = 'listing';
    await expect(f.call(`activity/${id}`, 'POST')).rejects.toMatchObject({ status: 400 });
    expect(f.prisma.contactActivity.upsert).not.toHaveBeenCalled();
  });
  it('does not expose private assisted-posting metadata in saved records', async () => {
    const f = fixture();
    f.item.payload.assistedPosting = { consentMethod: 'phone' };
    f.item.payload.feeStatus = 'AWAITING_AGREEMENT';
    f.prisma.savedSubmission.findMany.mockResolvedValue([{ submissionId: id, submission: f.publicItem() }]);
    await f.call('saved');
    const result = f.send.mock.calls[0][2].saved[0].submission;
    expect(result.seller).toBe('Nour Hassan');
    expect(result.verified).toBe(false);
    expect(result.payload.assistedPosting).toBeUndefined();
    expect(result.payload.feeStatus).toBeUndefined();
  });
  it.each(['listings?kind=other', 'listings?kind=service&page=-1', 'activity?page=NaN', 'activity?page=1.5'])('rejects invalid paging/filter input %s', async path => {
    await expect(fixture().call(path)).rejects.toMatchObject({ status: 400 });
  });
});

describe('owner listing management', () => {
  it('prevents another account editing or changing a listing', async () => {
    const f = fixture(visitor);
    await expect(f.edit({ pricing: '500 EGP' })).rejects.toMatchObject({ status: 404 });
    await expect(f.action('remove')).rejects.toMatchObject({ status: 404 });
    expect(f.prisma.submission.updateMany).not.toHaveBeenCalled();
  });
  it('updates rates and availability without resetting quotas, dates or approved commercial status', async () => {
    const f = fixture();
    f.item.payload.advertiserType = 'small_business';
    f.item.payload.feeStatus = 'AWAITING_AGREEMENT';
    const originalOffer = { ...f.item.payload.offer };
    await f.edit({ pricing: '300 EGP', availability: 'Weekends' });
    expect(f.item.status).toBe('PUBLISHED');
    expect(f.item.version).toBe(2);
    expect(f.item.payload).toMatchObject({ pricing: '300 EGP', availability: 'Weekends', feeStatus: 'AWAITING_AGREEMENT', offer: originalOffer });
    const data = f.prisma.submission.updateMany.mock.calls[0][0].data;
    expect(data.createdAt).toBeUndefined();
    expect(data.rentalMonth).toBeUndefined();
    expect(f.prisma.auditLog.create).toHaveBeenCalledOnce();
  });
  it('sends description changes for review without allowing automatic approval', async () => {
    const f = fixture();
    await f.edit({ subtitle: 'Updated mathematics classes for secondary students.' });
    expect(f.item.status).toBe('PENDING_REVIEW');
    await f.edit({ availability: 'Every morning' });
    expect(f.item.status).toBe('PENDING_REVIEW');
  });
  it.each(['category', 'advertiserType', 'businessRequest', 'feeStatus', 'businessAuthenticationStatus', 'offer', 'userId', 'status', 'createdAt', 'providerName', 'whatsapp', 'uploadIds'])('rejects protected field %s', async key => {
    const f = fixture();
    await expect(f.edit({ [key]: 'changed' })).rejects.toMatchObject({ status: 400 });
    expect(f.prisma.submission.updateMany).not.toHaveBeenCalled();
  });
  it.each(['Find me at https://example.com', 'Contact me on @myaccount', '<script>alert(1)</script>', '<img src=x onerror=alert(1)>'])('enforces the description policy during editing: %s', async subtitle => {
    await expect(fixture().edit({ subtitle })).rejects.toMatchObject({ status: 400 });
  });
  it('rejects stale edits and concurrent moderation changes', async () => {
    const f = fixture();
    await expect(f.call(`listings/${id}`, 'POST', { version: 9, action: 'edit', changes: { pricing: '1 EGP' } })).rejects.toMatchObject({ status: 409 });
    f.prisma.submission.updateMany.mockResolvedValue({ count: 0 });
    await expect(f.edit({ availability: 'Morning' })).rejects.toMatchObject({ status: 409 });
    expect(f.prisma.auditLog.create).not.toHaveBeenCalled();
  });
  it('cannot bypass a moderation hold by pausing and resuming', async () => {
    const f = fixture();
    f.item.status = 'HIDDEN';
    await f.action('pause');
    await f.action('resume');
    expect(f.item.status).toBe('HIDDEN');
    await expect(f.edit({ availability: 'Morning' })).rejects.toMatchObject({ status: 409 });
  });
  it('respects publication pauses on resumption', async () => {
    const f = fixture();
    f.item.ownerState = 'PAUSED';
    f.prisma.publicationPause.findFirst.mockResolvedValue({ category: '*' });
    await f.action('resume');
    expect(f.item.status).toBe('PENDING_REVIEW');
  });
  it('retains promotion usage when closing or removing a service', async () => {
    const f = fixture();
    const originalOffer = { ...f.item.payload.offer };
    await f.action('close');
    expect(f.item.ownerState).toBe('CLOSED');
    await expect(f.action('resume')).rejects.toMatchObject({ status: 409 });
    await f.action('remove');
    expect(f.item.ownerState).toBe('REMOVED');
    expect(f.item.payload.offer).toEqual(originalOffer);
    expect(f.item.createdAt).toEqual(new Date('2026-09-01'));
  });
  it('marks an item sold without inventing a buyer or closing a service as sold', async () => {
    const f = fixture();
    await expect(f.action('sold')).rejects.toMatchObject({ status: 409 });
    f.item.kind = 'listing';
    await f.action('sold');
    expect(f.item.ownerState).toBe('SOLD');
    expect(f.prisma.contactActivity.upsert).not.toHaveBeenCalled();
  });
});
