/* global URL */
import { RequestError, readJson } from './request.js';
import { canReview, consumeLimit } from './auth.js';
import { isContentVisible, setContentStatus } from './moderation.js';

const contentTypes = new Set(['listing', 'service', 'business', 'offer']);
const reasons = new Set(['Scam or fraud', 'Prohibited item or service', 'Duplicate or spam', 'Misleading information', 'Wrong category', 'Something else']);
const statuses = new Set(['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED']);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);

export function createReports({ prisma, auth, origin }) {
  async function handle(request, response, parts, send) {
    if (parts[1] === 'reports' && parts.length === 2 && request.method === 'POST') {
      if (request.headers.origin !== origin) throw new RequestError(403, 'Request origin is not allowed');
      const body = await readJson(request);
      const contentType = typeof body.contentType === 'string' ? body.contentType.trim() : '';
      const contentId = typeof body.contentId === 'string' ? body.contentId.trim() : '';
      const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
      const details = typeof body.details === 'string' ? body.details.trim() : '';
      if (!contentTypes.has(contentType) || !contentId || contentId.length > 160) throw new RequestError(400, 'Invalid report target');
      if (!(await isContentVisible(prisma, contentType, contentId))) throw new RequestError(404, 'Ad not found');
      if (!reasons.has(reason)) throw new RequestError(400, 'Choose a report reason');
      if (details.length > 1000) throw new RequestError(400, 'Report details are too long');
      const current = auth ? await auth.session(request, false) : null;
      await consumeLimit(prisma, 'content-report', current?.userId || request.clientIp || 'unknown', 5, 3600000);
      const report = await prisma.contentReport.create({ data: { reporterId: current?.userId || null, contentType, contentId, reason, details: details || null }, select: { id: true, status: true, createdAt: true } });
      return send(response, 201, { report: { id: report.id, status: report.status, createdAt: report.createdAt } });
    }

    if (parts[1] === 'admin' && parts[2] === 'reports') {
      if (!auth) throw new RequestError(503, 'Authentication is not configured');
      const current = request.method === 'GET' ? await auth.session(request) : await auth.protect(request);
      if (!canReview(current.publicUser || current.user, 'REPORTS')) throw new RequestError(403, 'Reports permission required');
      if (request.method === 'GET' && parts.length === 3) {
        const status = new URL(request.url, 'http://localhost').searchParams.get('status');
        const reports = await prisma.contentReport.findMany({
          where: status && statuses.has(status) ? { status } : { status: { in: ['OPEN', 'IN_REVIEW'] } },
          orderBy: { createdAt: 'desc' }, take: 100,
          select: { id: true, contentType: true, contentId: true, reason: true, details: true, status: true, createdAt: true, resolvedAt: true, reporter: { select: { email: true, phone: true } } },
        });
        return send(response, 200, { reports });
      }
      if (request.method === 'POST' && parts.length === 4) {
        if (!uuid(parts[3])) throw new RequestError(400, 'Invalid report');
        const body = await readJson(request);
        if (!statuses.has(body.status) || body.status === 'OPEN') throw new RequestError(400, 'Invalid report status');
        if (body.action && (body.action !== 'HIDE' || body.status !== 'RESOLVED' || !canReview(current.publicUser || current.user, 'CONTENT_REVIEW'))) throw new RequestError(403, 'Content review permission required');
        const report = await prisma.$transaction(async tx => {
          const item = await tx.contentReport.findUnique({ where: { id: parts[3] } });
          if (!item) throw new RequestError(404, 'Report not found');
          if (['RESOLVED', 'DISMISSED'].includes(item.status)) throw new RequestError(409, 'Report has already been decided');
          if (body.action) await setContentStatus(tx, { contentType: item.contentType, contentId: item.contentId, action: body.action, reason: body.reason, actorId: current.userId, admin: current.user.role === 'ADMIN' });
          const changed = await tx.contentReport.updateMany({ where: { id: item.id, status: item.status }, data: { status: body.status, resolvedAt: ['RESOLVED', 'DISMISSED'].includes(body.status) ? new Date() : null } });
          if (!changed.count) throw new RequestError(409, 'Report changed while you were reviewing it');
          await tx.auditLog.create({ data: { actorId: current.userId, action: 'report.reviewed', targetType: 'ContentReport', targetId: item.id, metadata: { from: item.status, to: body.status, contentId: item.contentId, action: body.action || null } } });
          return tx.contentReport.findUnique({ where: { id: item.id }, select: { id: true, status: true, resolvedAt: true } });
        });
        return send(response, 200, { report });
      }
    }
    throw new RequestError(404, 'Not found');
  }
  return { handle };
}
