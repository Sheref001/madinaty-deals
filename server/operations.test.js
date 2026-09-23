import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { createOperations } from './operations.js';

const request = (method, body = {}) => Object.assign(Readable.from([JSON.stringify(body)]), { method, headers: {} });
const moderator = { role: 'MODERATOR', permissions: ['CONTENT_REVIEW'] };

function fixture(user = moderator) {
  const prisma = {
    user: { count: vi.fn().mockResolvedValue(0) },
    submission: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    contentControl: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    contentReport: { count: vi.fn().mockResolvedValue(0) },
    contentView: { count: vi.fn().mockResolvedValue(0) },
    publicationPause: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn(), deleteMany: vi.fn() },
    systemSetting: { findUnique: vi.fn().mockResolvedValue({ value: 'true' }), upsert: vi.fn() },
    auditLog: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  };
  prisma.$transaction = callback => callback(prisma);
  const auth = { session: vi.fn().mockResolvedValue({ userId: 'owner', user, publicUser: user }), protect: vi.fn().mockResolvedValue({ userId: 'owner', user, publicUser: user }) };
  const send = vi.fn();
  return { prisma, auth, send, operations: createOperations({ prisma, auth }) };
}

describe('owner operations permissions', () => {
  it('lets a content moderator see the review queue but not pause publication', async () => {
    const f = fixture();
    await f.operations.handle(request('GET'), {}, ['api', 'admin', 'content'], f.send);
    expect(f.send.mock.calls[0][2]).toEqual({ submissions: [], controls: [] });
    await expect(f.operations.handle(request('POST', { category: '*', paused: true, reason: 'Emergency review' }), {}, ['api', 'admin', 'publication-pause'], f.send)).rejects.toMatchObject({ status: 403 });
    expect(f.prisma.publicationPause.upsert).not.toHaveBeenCalled();
  });
  it('lets the owner pause all publication and records the reason', async () => {
    const f = fixture({ role: 'ADMIN' });
    await f.operations.handle(request('POST', { category: '*', paused: true, reason: 'Fraud campaign detected' }), {}, ['api', 'admin', 'publication-pause'], f.send);
    expect(f.prisma.publicationPause.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { category: '*' } }));
    expect(f.prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'publication.paused', metadata: { reason: 'Fraud campaign detected' } }) }));
  });
  it('shows dashboard totals to an assigned moderator without disclosing owner action history', async () => {
    const f = fixture({ role: 'MODERATOR', permissions: ['DASHBOARD'] });
    await f.operations.handle(request('GET'), {}, ['api', 'admin', 'operations'], f.send);
    expect(f.send.mock.calls[0][2].recent).toEqual([]);
    expect(f.prisma.auditLog.findMany).not.toHaveBeenCalled();
  });
  it('lets only the administrator pause public sign-in and registration', async () => {
    const f = fixture({ role: 'ADMIN' });
    await f.operations.handle(request('GET'), {}, ['api', 'admin', 'registration-access'], f.send);
    expect(f.send.mock.calls[0][2]).toEqual({ enabled: true });
    await f.operations.handle(request('POST', { enabled: false, reason: 'Scheduled maintenance' }), {}, ['api', 'admin', 'registration-access'], f.send);
    expect(f.prisma.systemSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { key: 'public_registration_enabled' }, update: { value: 'false' } }));
    expect(f.prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'registration.paused' }) }));
    const moderator = fixture();
    await expect(moderator.operations.handle(request('POST', { enabled: false, reason: 'Scheduled maintenance' }), {}, ['api', 'admin', 'registration-access'], moderator.send)).rejects.toMatchObject({ status: 403 });
  });
});
