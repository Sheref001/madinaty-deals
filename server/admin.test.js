import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { createAdmin } from './admin.js';

const adminUser = { id: '11111111-1111-1111-1111-111111111111', email: 'hello@madinatydeals.com', role: 'ADMIN', status: 'ACTIVE', createdAt: new Date(), profile: { displayName: 'Owner', verificationState: 'VERIFIED' } };
const target = { id: '22222222-2222-2222-2222-222222222222', email: 'staff@example.com', role: 'RESIDENT', status: 'ACTIVE', createdAt: new Date(), profile: { displayName: 'Staff', verificationState: 'UNVERIFIED' } };
const request = body => Object.assign(Readable.from([JSON.stringify(body)]), { method: 'POST', headers: { origin: 'https://madinatydeals.com', 'x-csrf-token': 'csrf' }, socket: { remoteAddress: '127.0.0.1' } });

function fixture() {
  const prisma = {
    user: { findMany: vi.fn().mockResolvedValue([adminUser, target]), findUnique: vi.fn().mockResolvedValue(target), update: vi.fn().mockResolvedValue({ ...target, role: 'MODERATOR' }), count: vi.fn().mockResolvedValue(1) },
    session: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
    auditLog: { create: vi.fn() },
  };
  prisma.$transaction = async callback => callback(prisma);
  const auth = { session: vi.fn().mockResolvedValue({ userId: adminUser.id, user: adminUser }), protect: vi.fn().mockResolvedValue({ userId: adminUser.id, user: adminUser }) };
  const send = vi.fn();
  return { prisma, auth, send, admin: createAdmin({ prisma, auth }) };
}

describe('administrator user controls', () => {
  it('lists users only for an administrator', async () => {
    const f = fixture();
    await f.admin.handle(Object.assign(Readable.from(['{}']), { method: 'GET', headers: {}, socket: {} }), {}, ['api', 'admin', 'users'], f.send);
    expect(f.send.mock.calls[0][2].users).toHaveLength(2);
    f.auth.session.mockResolvedValue({ userId: target.id, user: target });
    await expect(f.admin.handle(Object.assign(Readable.from(['{}']), { method: 'GET', headers: {}, socket: {} }), {}, ['api', 'admin', 'users'], f.send)).rejects.toMatchObject({ status: 403 });
  });
  it('changes a collaborator role and records an audit event', async () => {
    const f = fixture();
    await f.admin.handle(request({ role: 'MODERATOR' }), {}, ['api', 'admin', 'users', target.id, 'role'], f.send);
    expect(f.prisma.user.update).toHaveBeenCalledWith({ where: { id: target.id }, data: { role: 'MODERATOR' } });
    expect(f.prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'admin.user_role_changed', targetId: target.id }) }));
  });
  it('suspends an account with a reason and revokes existing sessions', async () => {
    const f = fixture();
    await f.admin.handle(request({ status: 'SUSPENDED', reason: 'Repeated prohibited ads' }), {}, ['api', 'admin', 'users', target.id, 'status'], f.send);
    expect(f.prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: target.id } });
    expect(f.prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'admin.user_status_changed', metadata: expect.objectContaining({ reason: 'Repeated prohibited ads' }) }) }));
  });
});
