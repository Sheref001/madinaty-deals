/* global URL */
import { RequestError, readJson } from './request.js';
import { moderatorPermissions, normalizePhone } from './auth.js';

const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const roles = new Set(['RESIDENT', 'SERVICE_PROVIDER', 'BUSINESS_OWNER', 'MODERATOR', 'ADMIN']);
const statuses = new Set(['ACTIVE', 'SUSPENDED']);
const publicUser = user => ({ id: user.id, email: user.email, phone: user.phone, role: user.role, status: user.status, name: user.profile?.displayName || 'Neighbour', residentVerified: user.profile?.verificationState === 'VERIFIED', createdAt: user.createdAt });
const publicAssignment = assignment => ({ id: assignment.id, name: assignment.name, email: assignment.email, phone: assignment.phone, permissions: Array.isArray(assignment.permissions) ? assignment.permissions : [], status: assignment.status, createdAt: assignment.createdAt, matchedUser: assignment.matchedUser ? { id: assignment.matchedUser.id, name: assignment.matchedUser.profile?.displayName || 'Neighbour', email: assignment.matchedUser.email, phone: assignment.matchedUser.phone } : null });

export function createAdmin({ prisma, auth }) {
  async function requireAdmin(request) {
    const current = request.method === 'GET' ? await auth.session(request) : await auth.protect(request);
    if (current.user.role !== 'ADMIN') throw new RequestError(403, 'Administrator access required');
    return current;
  }

  async function ensureAdminRemains(tx, target, current, change) {
    const removesAdmin = target.role === 'ADMIN' && (change.role && change.role !== 'ADMIN' || change.status === 'SUSPENDED');
    if (!removesAdmin) return;
    const count = await tx.user.count({ where: { role: 'ADMIN', status: 'ACTIVE', NOT: { id: target.id } } });
    if (!count) throw new RequestError(409, 'The last active administrator cannot be removed');
    if (target.id === current.userId) throw new RequestError(409, 'You cannot remove your own administrator access');
  }

  async function handle(request, response, parts, send) {
    const current = await requireAdmin(request);
    if (parts.length === 3 && parts[2] === 'moderators' && request.method === 'GET') {
      const assignments = await prisma.moderatorAssignment.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { matchedUser: { include: { profile: { select: { displayName: true } } } } } });
      return send(response, 200, { moderators: assignments.map(publicAssignment) });
    }
    if (parts.length === 3 && parts[2] === 'moderators' && request.method === 'POST') {
      const body = await readJson(request);
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim().toLowerCase() : null;
      let phone = null;
      if (typeof body.phone === 'string' && body.phone.trim()) phone = normalizePhone(body.phone);
      if (name.length < 2 || name.length > 80) throw new RequestError(400, 'Enter a valid moderator name');
      if (!email && !phone) throw new RequestError(400, 'Enter an email address or phone number');
      if (email && (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254)) throw new RequestError(400, 'Enter a valid email address');
      const permissions = Array.isArray(body.permissions) ? [...new Set(body.permissions)] : [];
      if (!permissions.length || permissions.some(permission => !moderatorPermissions.has(permission))) throw new RequestError(400, 'Choose at least one moderator task');
      const existing = await prisma.moderatorAssignment.findFirst({ where: { OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])], status: { in: ['PENDING', 'ACTIVE'] } } });
      if (existing) throw new RequestError(409, 'A moderator assignment already exists for this contact');
      const matchedUser = await prisma.user.findFirst({ where: { OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])], status: { not: 'DELETED' } } });
      const assignment = await prisma.$transaction(async tx => {
        const created = await tx.moderatorAssignment.create({ data: { name, email, phone, permissions, createdById: current.userId, ...(matchedUser ? { status: 'ACTIVE', matchedUserId: matchedUser.id } : {}) } });
        if (matchedUser && matchedUser.role !== 'ADMIN' && matchedUser.role !== 'MODERATOR') await tx.user.update({ where: { id: matchedUser.id }, data: { role: 'MODERATOR' } });
        await tx.auditLog.create({ data: { actorId: current.userId, action: 'admin.moderator_assigned', targetType: 'ModeratorAssignment', targetId: created.id, metadata: { permissions } } });
        return tx.moderatorAssignment.findUnique({ where: { id: created.id }, include: { matchedUser: { include: { profile: { select: { displayName: true } } } } } });
      });
      return send(response, 201, { moderator: publicAssignment(assignment) });
    }
    if (parts.length === 5 && parts[2] === 'moderators' && parts[4] === 'revoke' && uuid(parts[3]) && request.method === 'POST') {
      const assignment = await prisma.moderatorAssignment.findUnique({ where: { id: parts[3] } });
      if (!assignment) throw new RequestError(404, 'Moderator assignment not found');
      await prisma.$transaction(async tx => {
        await tx.moderatorAssignment.update({ where: { id: assignment.id }, data: { status: 'REVOKED' } });
        if (assignment.matchedUserId) await tx.user.updateMany({ where: { id: assignment.matchedUserId, role: 'MODERATOR' }, data: { role: 'RESIDENT' } });
        await tx.auditLog.create({ data: { actorId: current.userId, action: 'admin.moderator_revoked', targetType: 'ModeratorAssignment', targetId: assignment.id } });
      });
      return send(response, 200, { ok: true });
    }
    if (parts.length === 3 && parts[2] === 'users' && request.method === 'GET') {
      const query = new URL(request.url, 'http://localhost').searchParams.get('query')?.trim().slice(0, 100) || '';
      const users = await prisma.user.findMany({ ...(query ? { where: { OR: [{ email: { contains: query, mode: 'insensitive' } }, { phone: { contains: query } }, { profile: { is: { displayName: { contains: query, mode: 'insensitive' } } } }] } } : {}), orderBy: { createdAt: 'desc' }, take: 200, include: { profile: { select: { displayName: true, verificationState: true } } } });
      return send(response, 200, { users: users.map(publicUser) });
    }
    if (parts.length !== 5 || parts[2] !== 'users' || !uuid(parts[3]) || request.method !== 'POST') throw new RequestError(404, 'Not found');
    const action = parts[4];
    if (!['role', 'status'].includes(action)) throw new RequestError(404, 'Not found');
    const body = await readJson(request);
    const target = await prisma.user.findUnique({ where: { id: parts[3] }, include: { profile: { select: { displayName: true, verificationState: true } } } });
    if (!target || target.status === 'DELETED') throw new RequestError(404, 'User not found');
    const change = action === 'role' ? { role: body.role } : { status: body.status };
    if (action === 'role' && !roles.has(body.role)) throw new RequestError(400, 'Invalid role');
    if (action === 'status' && !statuses.has(body.status)) throw new RequestError(400, 'Invalid account status');
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (action === 'status' && body.status === 'SUSPENDED' && (reason.length < 5 || reason.length > 500)) throw new RequestError(400, 'Enter a reason of at least five characters');
    await prisma.$transaction(async tx => {
      await ensureAdminRemains(tx, target, current, change);
      await tx.user.update({ where: { id: target.id }, data: change });
      if (action === 'status' && body.status === 'SUSPENDED') await tx.session.deleteMany({ where: { userId: target.id } });
      await tx.auditLog.create({ data: { actorId: current.userId, action: `admin.user_${action}_changed`, targetType: 'User', targetId: target.id, metadata: { from: action === 'role' ? target.role : target.status, to: action === 'role' ? body.role : body.status, reason: reason || null } } });
    });
    const updated = await prisma.user.findUnique({ where: { id: target.id }, include: { profile: { select: { displayName: true, verificationState: true } } } });
    return send(response, 200, { user: publicUser(updated) });
  }
  return { handle };
}
