import { describe, expect, it, vi } from 'vitest';
import { isContentVisible, setContentStatus } from './moderation.js';

const id = '11111111-1111-4111-8111-111111111111';
const contentId = `submission-${id}`;
function fixture(status = 'PUBLISHED', kind = 'listing') {
  const item = { id, kind, status, statusBeforeHide: null, payload: {} };
  const tx = {
    submission: {
      findUnique: vi.fn(async () => ({ ...item })),
      updateMany: vi.fn(async ({ where, data }) => { if (where.status !== item.status) return { count: 0 }; Object.assign(item, data); return { count: 1 }; }),
    },
    auditLog: { create: vi.fn() },
  };
  return { item, tx };
}

describe('emergency content moderation', () => {
  it('hides a published ad immediately, records why, and restores its prior status', async () => {
    const { item, tx } = fixture();
    await setContentStatus(tx, { contentType: 'listing', contentId, action: 'HIDE', reason: 'Unsafe contact details', actorId: id, admin: false });
    expect(item).toMatchObject({ status: 'HIDDEN', statusBeforeHide: 'PUBLISHED' });
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'moderation.hide', metadata: expect.objectContaining({ reason: 'Unsafe contact details' }) }) }));
    await setContentStatus(tx, { contentType: 'listing', contentId, action: 'RESTORE', actorId: id, admin: false });
    expect(item).toMatchObject({ status: 'PUBLISHED', statusBeforeHide: null });
  });
  it('restores a held ad to review instead of publishing it', async () => {
    const { item, tx } = fixture('PENDING_REVIEW');
    await setContentStatus(tx, { contentType: 'listing', contentId, action: 'HIDE', reason: 'Needs more checking', actorId: id, admin: true });
    await setContentStatus(tx, { contentType: 'listing', contentId, action: 'RESTORE', actorId: id, admin: true });
    expect(item.status).toBe('PENDING_REVIEW');
  });
  it('prevents moderators from approving commercial posts or removing ads permanently', async () => {
    const { tx } = fixture('PENDING_REVIEW');
    tx.submission.findUnique.mockResolvedValue({ id, kind: 'listing', status: 'PENDING_REVIEW', payload: { feeStatus: 'AWAITING_AGREEMENT' } });
    await expect(setContentStatus(tx, { contentType: 'listing', contentId, action: 'APPROVE', actorId: id, admin: false })).rejects.toMatchObject({ status: 403 });
    await expect(setContentStatus(tx, { contentType: 'listing', contentId, action: 'REMOVE', reason: 'Fraudulent ad', actorId: id, admin: false })).rejects.toMatchObject({ status: 403 });
    expect(tx.submission.updateMany).not.toHaveBeenCalled();
  });
  it('blocks a live ad when its owner is suspended and a demo ad when hidden', async () => {
    const prisma = {
      submission: { findUnique: vi.fn().mockResolvedValue({ kind: 'listing', status: 'PUBLISHED', user: { status: 'SUSPENDED' } }) },
      contentControl: { findUnique: vi.fn().mockResolvedValue({ status: 'HIDDEN' }) },
    };
    expect(await isContentVisible(prisma, 'listing', contentId)).toBe(false);
    expect(await isContentVisible(prisma, 'service', 'service-1')).toBe(false);
  });
  it('does not let an administrator publish an old vehicle ad from an unverified account', async () => {
    const { tx } = fixture('PENDING_REVIEW');
    tx.submission.findUnique.mockResolvedValue({ id, kind: 'listing', status: 'PENDING_REVIEW', payload: { category: 'Cars & motorcycles', vehicleType: 'Cars' }, user: { profile: { verificationState: 'UNVERIFIED' } } });
    await expect(setContentStatus(tx, { contentType: 'listing', contentId, action: 'APPROVE', actorId: id, admin: true })).rejects.toMatchObject({ status: 403 });
    expect(tx.submission.updateMany).not.toHaveBeenCalled();
    const prisma = { submission: { findUnique: vi.fn().mockResolvedValue({ kind: 'listing', status: 'PUBLISHED', payload: { category: 'Cars & motorcycles' }, user: { status: 'ACTIVE', profile: { verificationState: 'UNVERIFIED' } } }) } };
    expect(await isContentVisible(prisma, 'listing', contentId)).toBe(false);
  });
});
