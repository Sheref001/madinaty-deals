import { RequestError, readJson } from './request.js';

const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const roles = new Set(['RESIDENT', 'SERVICE_PROVIDER', 'BUSINESS_OWNER', 'MODERATOR', 'ADMIN']);
const statuses = new Set(['ACTIVE', 'SUSPENDED']);
const publicUser = user => ({ id: user.id, email: user.email, phone: user.phone, role: user.role, status: user.status, name: user.profile?.displayName || 'Neighbour', residentVerified: user.profile?.verificationState === 'VERIFIED', createdAt: user.createdAt });

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
    if (parts.length === 3 && parts[2] === 'users' && request.method === 'GET') {
      const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { profile: { select: { displayName: true, verificationState: true } } } });
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
    await prisma.$transaction(async tx => {
      await ensureAdminRemains(tx, target, current, change);
      await tx.user.update({ where: { id: target.id }, data: change });
      await tx.auditLog.create({ data: { actorId: current.userId, action: `admin.user_${action}_changed`, targetType: 'User', targetId: target.id, metadata: { from: action === 'role' ? target.role : target.status, to: action === 'role' ? body.role : body.status } } });
    });
    const updated = await prisma.user.findUnique({ where: { id: target.id }, include: { profile: { select: { displayName: true, verificationState: true } } } });
    return send(response, 200, { user: publicUser(updated) });
  }
  return { handle };
}
