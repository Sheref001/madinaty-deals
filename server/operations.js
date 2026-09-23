import { RequestError, readJson } from './request.js';
import { canReview } from './auth.js';
import { contentActions, contentTypes, publicationCategories, setContentStatus } from './moderation.js';

const safeReason = value => typeof value === 'string' && value.trim().length >= 5 && value.length <= 500;

export function createOperations({ prisma, auth }) {
  async function handle(request, response, parts, send) {
    const current = request.method === 'GET' ? await auth.session(request) : await auth.protect(request);
    const user = current.publicUser || current.user;
    const admin = user.role === 'ADMIN';
    if (parts.length === 3 && parts[2] === 'operations' && request.method === 'GET') {
      if (!canReview(user, 'DASHBOARD')) throw new RequestError(403, 'Dashboard permission required');
      const [users, published, pending, hidden, services, reports, views, recent, hiddenStatic] = await Promise.all([
        prisma.user.count({ where: { status: 'ACTIVE' } }),
        prisma.submission.count({ where: { status: 'PUBLISHED', user: { is: { status: 'ACTIVE' } } } }),
        prisma.submission.count({ where: { status: 'PENDING_REVIEW' } }),
        prisma.submission.count({ where: { status: { in: ['HIDDEN', 'REMOVED'] } } }),
        prisma.submission.count({ where: { kind: 'service', status: 'PUBLISHED', user: { is: { status: 'ACTIVE' } } } }),
        prisma.contentReport.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } } }),
        prisma.contentView.count(),
        admin ? prisma.auditLog.findMany({ where: { OR: [{ action: { startsWith: 'moderation.' } }, { action: { startsWith: 'publication.' } }, { action: { startsWith: 'admin.user_' } }, { action: 'report.reviewed' }] }, orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, action: true, targetType: true, targetId: true, metadata: true, createdAt: true, actor: { select: { email: true, profile: { select: { displayName: true } } } } } }) : Promise.resolve([]),
        prisma.contentControl.count({ where: { status: { in: ['HIDDEN', 'REMOVED'] } } }),
      ]);
      return send(response, 200, { counts: { users, published, pending, hidden: hidden + hiddenStatic, services, reports, views }, recent: recent.map(item => ({ ...item, actor: item.actor?.profile?.displayName || item.actor?.email || 'System' })) });
    }
    if (parts.length === 3 && parts[2] === 'content' && request.method === 'GET') {
      if (!canReview(user, 'CONTENT_REVIEW')) throw new RequestError(403, 'Content review permission required');
      const [submissions, controls] = await Promise.all([
        prisma.submission.findMany({ orderBy: { createdAt: 'desc' }, take: 200, select: { id: true, kind: true, status: true, createdAt: true, payload: true, uploads: { where: { purpose: 'photo', status: 'READY' }, select: { id: true } }, user: { select: { id: true, email: true, phone: true, status: true, profile: { select: { displayName: true } } } } } }),
        prisma.contentControl.findMany({ select: { contentType: true, contentId: true, status: true, reason: true, updatedAt: true } }),
      ]);
      return send(response, 200, { submissions: submissions.map(item => ({ id: `submission-${item.id}`, kind: item.kind, status: item.status, createdAt: item.createdAt, title: typeof item.payload?.title === 'string' ? item.payload.title : 'Untitled', description: typeof item.payload?.subtitle === 'string' ? item.payload.subtitle : '', category: item.payload?.category || '', commercial: item.payload?.advertiserType === 'small_business' || item.payload?.feeStatus === 'AWAITING_AGREEMENT', owner: { id: item.user.id, name: item.user.profile?.displayName || 'Neighbour', email: item.user.email, phone: item.user.phone, status: item.user.status }, uploadIds: item.uploads.map(upload => upload.id) })), controls });
    }
    if (parts.length === 4 && parts[2] === 'content' && parts[3] === 'status' && request.method === 'POST') {
      if (!canReview(user, 'CONTENT_REVIEW')) throw new RequestError(403, 'Content review permission required');
      const body = await readJson(request);
      if (!contentTypes.has(body.contentType) || !contentActions.has(body.action)) throw new RequestError(400, 'Invalid content action');
      const content = await prisma.$transaction(tx => setContentStatus(tx, { contentType: body.contentType, contentId: body.contentId, action: body.action, reason: body.reason, actorId: current.userId, admin }));
      return send(response, 200, { content });
    }
    if (parts.length === 3 && parts[2] === 'publication-pause') {
      if (!admin) throw new RequestError(403, 'Administrator access required');
      if (request.method === 'GET') return send(response, 200, { pauses: await prisma.publicationPause.findMany({ orderBy: { createdAt: 'asc' } }) });
      if (request.method === 'POST') {
        const body = await readJson(request);
        const category = body.category === '*' || publicationCategories.has(body.category) ? body.category : null;
        if (!category || typeof body.paused !== 'boolean') throw new RequestError(400, 'Choose a valid publication category');
        if (body.paused && !safeReason(body.reason)) throw new RequestError(400, 'Enter a reason of at least five characters');
        await prisma.$transaction(async tx => {
          if (body.paused) await tx.publicationPause.upsert({ where: { category }, update: { reason: body.reason.trim() }, create: { category, reason: body.reason.trim() } });
          else await tx.publicationPause.deleteMany({ where: { category } });
          await tx.auditLog.create({ data: { actorId: current.userId, action: body.paused ? 'publication.paused' : 'publication.resumed', targetType: 'Category', targetId: category, metadata: { reason: body.paused ? body.reason.trim() : null } } });
        });
        return send(response, 200, { pauses: await prisma.publicationPause.findMany({ orderBy: { createdAt: 'asc' } }) });
      }
    }
    throw new RequestError(404, 'Not found');
  }
  return { handle };
}
