import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSubmissions } from './submissions.js';

const photoId = '11111111-1111-4111-8111-111111111111';
const verificationId = '22222222-2222-4222-8222-222222222222';
const payload = { title: 'Dining table', subtitle: 'Solid wood table in good condition.', category: 'Furniture & home', zone: 'B1', price: 1000, condition: 'Good' };
function fixture({ role = 'RESIDENT', verified = false, photos = [] } = {}) {
  const current = { userId: 'owner', user: { role } };
  const prisma = {
    $queryRaw: vi.fn().mockResolvedValue([{ count: 1 }]),
    profile: { findUnique: vi.fn().mockResolvedValue({ verificationState: verified ? 'VERIFIED' : 'UNVERIFIED' }), update: vi.fn() },
    submission: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 'submission', status: 'PUBLISHED' }) },
    upload: { findMany: vi.fn(async ({ where }) => photos.filter(photo => where.id.in.includes(photo.id) && photo.userId === where.userId && photo.purpose === where.purpose && photo.status === where.status && photo.submissionId === null)), updateMany: vi.fn() },
    residentVerification: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue({ id: verificationId, userId: 'resident' }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    auditLog: { create: vi.fn() },
  };
  prisma.$transaction = vi.fn(callback => callback(prisma));
  const auth = { protect: vi.fn().mockResolvedValue(current), session: vi.fn().mockResolvedValue(current) };
  const handler = createSubmissions({ prisma, auth });
  const send = vi.fn();
  const call = (body, path = 'api/submissions', method = 'POST') => handler.handle(Object.assign(Readable.from([JSON.stringify(body)]), { method, headers: {} }), {}, path.split('/'), send);
  return { prisma, auth, send, call };
}
const rental = { kind: 'listing', payload: { ...payload, category: 'Apartment rentals', furnishing: 'Unfurnished' } };
const review = `api/admin/verifications/${verificationId}/review`;
afterEach(() => vi.useRealTimers());

describe('marketplace submission boundaries', () => {
  it('requires authentication before reading or writing submissions', async () => {
    const f = fixture();
    f.auth.protect.mockRejectedValue({ status: 401 });
    f.auth.session.mockRejectedValue({ status: 401 });
    await expect(f.call({ kind: 'listing', payload })).rejects.toMatchObject({ status: 401 });
    await expect(f.call({}, 'api/submissions', 'GET')).rejects.toMatchObject({ status: 401 });
    expect(f.prisma.submission.create).not.toHaveBeenCalled();
    expect(f.prisma.submission.findMany).not.toHaveBeenCalled();
  });
  it('scopes submission history to the signed-in account', async () => {
    const f = fixture();
    await f.call({}, 'api/submissions', 'GET');
    expect(f.prisma.submission.findMany.mock.calls[0][0].where).toEqual({ userId: 'owner' });
  });
  it('exposes only published submissions through the public feed', async () => {
    const f = fixture();
    f.prisma.submission.findMany.mockResolvedValue([{ id: 'published-id', kind: 'listing', payload: { ...payload, feeStatus: 'AWAITING_AGREEMENT', businessAuthenticationStatus: 'PENDING_REVIEW' }, uploads: [], createdAt: new Date('2026-09-23T10:00:00Z'), user: { profile: { displayName: 'Neighbour', verificationState: 'VERIFIED' } } }]);
    await f.call({}, 'api/public-submissions', 'GET');
    expect(f.prisma.submission.findMany.mock.calls[0][0].where).toEqual({ status: 'PUBLISHED' });
    expect(f.send.mock.calls[0][2].submissions[0]).toMatchObject({ id: 'published-id', kind: 'listing', seller: 'Neighbour', verified: true });
    expect(f.send.mock.calls[0][2].submissions[0].payload.feeStatus).toBeUndefined();
  });
  it('publishes ordinary listings immediately and ignores client-supplied ownership and approval', async () => {
    const f = fixture();
    await f.call({ kind: 'listing', payload: { ...payload, status: 'PUBLISHED', userId: 'attacker' }, userId: 'attacker', status: 'PUBLISHED' });
    expect(f.prisma.submission.create.mock.calls[0][0].data).toEqual({ userId: 'owner', kind: 'listing', payload, status: 'PUBLISHED', rentalMonth: null });
    expect(f.send).toHaveBeenCalledWith({}, 201, { id: 'submission', status: 'PUBLISHED', published: true });
  });
  it('holds risky and commercial submissions for review', async () => {
    const risky = fixture();
    await risky.call({ kind: 'listing', payload: { ...payload, subtitle: 'Guaranteed profit. Visit https://example.test' } });
    expect(risky.prisma.submission.create.mock.calls[0][0].data.status).toBe('PENDING_REVIEW');
    const commercial = fixture();
    await commercial.call({ kind: 'listing', payload: { ...payload, category: 'Electronics', advertiserType: 'small_business', businessRequest: 'posting' } });
    expect(commercial.prisma.submission.create.mock.calls[0][0].data.status).toBe('PENDING_REVIEW');
  });
  it('allows service providers without resident verification', async () => {
    const f = fixture({ role: 'SERVICE_PROVIDER' });
    await f.call({ kind: 'service', payload: { ...payload, category: 'Home services', whatsapp: '+201001234567' } });
    expect(f.prisma.submission.create).toHaveBeenCalledOnce();
    expect(f.prisma.profile.findUnique).not.toHaveBeenCalled();
  });
  it('allows one structured promotion per month and rejects a second one', async () => {
    const f = fixture();
    const service = { ...payload, category: 'Home services', whatsapp: '+201001234567', offer: { kind: 'Percentage discount', discount: '10% off the first booking', validUntil: '2026-12-31' } };
    await f.call({ kind: 'service', payload: service });
    expect(f.prisma.submission.create).toHaveBeenCalledOnce();
    f.prisma.submission.findMany.mockResolvedValue([{ createdAt: new Date(), payload: { offer: service.offer } }]);
    await expect(f.call({ kind: 'service', payload: { ...service, offer: { ...service.offer, discount: '20% off' } } })).rejects.toMatchObject({ status: 409, message: expect.stringContaining('hello@madinatydeals.com') });
    expect(f.prisma.submission.create).toHaveBeenCalledOnce();
  });
  it('rejects multiple or malformed promotions', async () => {
    const f = fixture();
    const baseService = { ...payload, category: 'Moving', whatsapp: '+201001234567' };
    await expect(f.call({ kind: 'service', payload: { ...baseService, offer: { kind: 'Percentage discount', discount: '10% and first session free', validUntil: '2026-12-31', secondOffer: 'free delivery' } } })).rejects.toMatchObject({ status: 400 });
    await expect(f.call({ kind: 'service', payload: { ...baseService, offer: { kind: 'Percentage discount', discount: '10%\nFirst session free', validUntil: '2026-12-31' } } })).rejects.toMatchObject({ status: 400 });
    expect(f.prisma.submission.create).not.toHaveBeenCalled();
  });
  it('keeps pet-care research submissions restricted to administrators and validates the subtype', async () => {
    const resident = fixture();
    const petCare = { ...payload, category: 'Pet care', whatsapp: '+201001234567', petBusinessType: 'Veterinary clinics' };
    await expect(resident.call({ kind: 'service', payload: petCare })).rejects.toMatchObject({ status: 403 });
    expect(resident.prisma.submission.create).not.toHaveBeenCalled();
    const admin = fixture({ role: 'ADMIN' });
    await expect(admin.call({ kind: 'service', payload: { ...petCare, petBusinessType: 'Dog walkers' } })).rejects.toMatchObject({ status: 400 });
    await admin.call({ kind: 'service', payload: petCare });
    expect(admin.prisma.submission.create.mock.calls[0][0].data.payload.petBusinessType).toBe('Veterinary clinics');
  });
  it.each([{ role: 'RESIDENT', verified: false }, { role: 'SERVICE_PROVIDER', verified: true }])('rejects ineligible rentals: %j', async options => {
    const f = fixture(options);
    await expect(f.call(rental)).rejects.toMatchObject({ status: 403 });
    expect(f.prisma.submission.create).not.toHaveBeenCalled();
  });
  it('uses the Cairo calendar month and blocks a second rental', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-31T22:30:00Z'));
    const f = fixture({ verified: true });
    await f.call(rental);
    const month = f.prisma.submission.create.mock.calls[0][0].data.rentalMonth;
    expect(month).toBe(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit' }).format(new Date('2026-02-01T12:00:00Z')));
    f.prisma.submission.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(f.call(rental)).rejects.toMatchObject({ status: 409 });
    expect(f.prisma.submission.create).toHaveBeenCalledOnce();
  });
  it.each([
    { userId: 'someone-else' }, { purpose: 'verification' }, { status: 'PENDING' }, { submissionId: 'already-used' }, { byteSize: 21 * 1024 * 1024 },
  ])('rejects unavailable or oversized photos: %j', async overrides => {
    const photo = { id: photoId, userId: 'owner', purpose: 'photo', status: 'READY', submissionId: null, byteSize: 100, ...overrides };
    const f = fixture({ photos: [photo] });
    await expect(f.call({ kind: 'listing', payload, uploadIds: [photoId] })).rejects.toMatchObject({ status: 400 });
    expect(f.prisma.submission.create).not.toHaveBeenCalled();
  });
  it.each([[photoId, photoId], ['-'.repeat(36)]])('rejects duplicate or malformed photo IDs before querying uploads: %j', async (...ids) => {
    const f = fixture();
    await expect(f.call({ kind: 'listing', payload, uploadIds: ids })).rejects.toMatchObject({ status: 400 });
    expect(f.prisma.upload.findMany).not.toHaveBeenCalled();
  });
});

describe('verification review boundaries', () => {
  it('returns only pending verification requests with their private document references to reviewers', async () => {
    const f = fixture({ role: 'ADMIN' });
    f.prisma.residentVerification.findMany.mockResolvedValue([{ id: verificationId, userId: 'resident', submittedAt: new Date('2026-09-20T12:00:00Z'), user: { email: 'resident@example.test', phone: null, profile: { displayName: 'Neighbour' } } }]);
    f.prisma.upload.findMany.mockResolvedValue([{ id: photoId, verificationId, documentType: 'MADINATY_ID' }]);
    await f.call({}, 'api/admin/verifications', 'GET');
    expect(f.prisma.residentVerification.findMany.mock.calls[0][0].where).toEqual({ status: 'PENDING' });
    expect(f.send.mock.calls[0][2].requests[0]).toMatchObject({ id: verificationId, name: 'Neighbour', email: 'resident@example.test', uploads: [{ id: photoId, documentType: 'MADINATY_ID' }] });
  });
  it('denies non-reviewers and self-review', async () => {
    const resident = fixture();
    await expect(resident.call({ status: 'VERIFIED' }, review)).rejects.toMatchObject({ status: 403 });
    const admin = fixture({ role: 'ADMIN' });
    admin.prisma.residentVerification.findUnique.mockResolvedValue({ id: verificationId, userId: 'owner' });
    await expect(admin.call({ status: 'VERIFIED' }, review)).rejects.toMatchObject({ status: 403 });
    expect(admin.prisma.profile.update).not.toHaveBeenCalled();
  });
  it('rejects malformed request IDs before querying the database', async () => {
    const f = fixture({ role: 'ADMIN' });
    await expect(f.call({ status: 'VERIFIED' }, 'api/admin/verifications/not-a-uuid/review')).rejects.toMatchObject({ status: 400 });
    expect(f.prisma.residentVerification.findUnique).not.toHaveBeenCalled();
  });
  it('does not grant residency when another reviewer already decided', async () => {
    const f = fixture({ role: 'MODERATOR' });
    f.prisma.residentVerification.updateMany.mockResolvedValue({ count: 0 });
    await expect(f.call({ status: 'VERIFIED' }, review)).rejects.toMatchObject({ status: 409 });
    expect(f.prisma.profile.update).not.toHaveBeenCalled();
    expect(f.prisma.auditLog.create).not.toHaveBeenCalled();
  });
  it.each(['VERIFIED', 'REJECTED'])('records a %s decision and only grants residency on approval', async status => {
    const f = fixture({ role: 'ADMIN' });
    await f.call({ status }, review);
    expect(f.prisma.profile.update).toHaveBeenCalledTimes(status === 'VERIFIED' ? 1 : 0);
    expect(f.prisma.auditLog.create.mock.calls[0][0].data.metadata).toEqual({ status });
    expect(f.send).toHaveBeenCalledWith({}, 200, { ok: true });
  });
});


describe('individual and small business submissions', () => {
  it.each(['Electronics', 'Tutoring & education'])('keeps %s individual ads free and ignores commercial approval fields', async category => {
    const f = fixture();
    await f.call({ kind: category === 'Electronics' ? 'listing' : 'service', payload: { ...payload, category, whatsapp: '+201001234567', advertiserType: 'individual', feeStatus: 'PAID', businessAuthenticationStatus: 'VERIFIED' } });
    const saved = f.prisma.submission.create.mock.calls[0][0].data.payload;
    expect(saved.advertiserType).toBe('individual');
    expect(saved.feeStatus).toBeUndefined();
    expect(saved.businessAuthenticationStatus).toBeUndefined();
  });
  it.each(['posting', 'authentication', 'both'])('retains a business %s request for fee agreement and review', async businessRequest => {
    const f = fixture();
    await f.call({ kind: 'listing', payload: { ...payload, category: 'Electronics', advertiserType: 'small_business', businessRequest, feeStatus: 'PAID', businessAuthenticationStatus: 'VERIFIED' } });
    const saved = f.prisma.submission.create.mock.calls[0][0].data.payload;
    expect(saved.businessRequest).toBe(businessRequest);
    expect(saved.feeStatus).toBe('AWAITING_AGREEMENT');
    expect(saved.businessAuthenticationStatus).toBe(businessRequest === 'posting' ? undefined : 'PENDING_REVIEW');
  });
  it.each([{ advertiserType: 'dealer' }, { advertiserType: 'small_business', businessRequest: 'free' }])('rejects invalid advertiser selections: %j', async fields => {
    const f = fixture();
    await expect(f.call({ kind: 'listing', payload: { ...payload, category: 'Electronics', ...fields } })).rejects.toMatchObject({ status: 400 });
    expect(f.prisma.submission.create).not.toHaveBeenCalled();
  });
});


it('requires fee agreement for individual and business gym posts', async () => {
  const f = fixture();
  const gym = { ...payload, category: 'Health & fitness', whatsapp: '+201001234567', advertiserType: 'individual' };
  await f.call({ kind: 'service', payload: gym });
  expect(f.prisma.submission.create.mock.calls[0][0].data.payload.feeStatus).toBe('AWAITING_AGREEMENT');
  await f.call({ kind: 'service', payload: { ...gym, advertiserType: 'small_business', businessRequest: 'posting' } });
  expect(f.prisma.submission.create.mock.calls[1][0].data.payload.feeStatus).toBe('AWAITING_AGREEMENT');
});
