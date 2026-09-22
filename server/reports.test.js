import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { createRequestHandler } from './app.js';
import { createReports } from './reports.js';

async function request(handler, url, { method = 'GET', body = '', headers = {} } = {}) {
  const incoming = Readable.from(body ? [body] : []);
  Object.assign(incoming, { url, method, headers, socket: { remoteAddress: '127.0.0.1' } });
  const result = {};
  await handler(incoming, { writeHead(status, responseHeaders) { result.status = status; result.headers = responseHeaders; }, end(data) { result.body = data?.toString() || ''; } });
  return result;
}

const auth = {
  session: vi.fn().mockResolvedValue(null),
  protect: vi.fn().mockResolvedValue({ userId: 'admin-1', publicUser: { role: 'ADMIN' } }),
};

const database = () => ({
  $queryRaw: vi.fn().mockResolvedValue([{ count: 1 }]),
  contentReport: {
    create: vi.fn().mockResolvedValue({ id: 'report-1', status: 'OPEN', createdAt: new Date('2026-09-22T00:00:00Z') }),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({ id: 'report-1', status: 'RESOLVED', resolvedAt: new Date('2026-09-22T00:00:00Z') }),
  },
});

describe('content reports', () => {
  it('persists a valid anonymous report', async () => {
    const prisma = database();
    const reports = createReports({ prisma, auth, origin: 'https://madinatydeals.com' });
    const handler = createRequestHandler({ prisma, reports, config: { origin: 'https://madinatydeals.com' } });
    const result = await request(handler, '/api/reports', { method: 'POST', headers: { origin: 'https://madinatydeals.com' }, body: JSON.stringify({ contentType: 'listing', contentId: 'listing-1', reason: 'Scam or fraud', details: 'Please review this.' }) });
    expect(result.status).toBe(201);
    expect(prisma.contentReport.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ contentType: 'listing', contentId: 'listing-1', reason: 'Scam or fraud', details: 'Please review this.', reporterId: null }) }));
  });

  it('rejects invalid targets and cross-origin submissions', async () => {
    const prisma = database();
    const handler = createRequestHandler({ prisma, reports: createReports({ prisma, auth, origin: 'https://madinatydeals.com' }), config: { origin: 'https://madinatydeals.com' } });
    expect((await request(handler, '/api/reports', { method: 'POST', headers: { origin: 'https://evil.example' }, body: '{}' })).status).toBe(403);
    expect((await request(handler, '/api/reports', { method: 'POST', headers: { origin: 'https://madinatydeals.com' }, body: JSON.stringify({ contentType: 'unknown', contentId: 'x', reason: 'Scam or fraud' }) })).status).toBe(400);
    expect(prisma.contentReport.create).not.toHaveBeenCalled();
  });

  it('exposes reports to reviewers and allows resolution', async () => {
    const prisma = database();
    const adminAuth = { session: vi.fn().mockResolvedValue({ userId: 'admin-1', publicUser: { role: 'ADMIN' } }), protect: auth.protect };
    const reports = createReports({ prisma, auth: adminAuth, origin: 'https://madinatydeals.com' });
    const handler = createRequestHandler({ prisma, reports, config: { origin: 'https://madinatydeals.com' } });
    expect((await request(handler, '/api/admin/reports')).status).toBe(200);
    const result = await request(handler, '/api/admin/reports/11111111-1111-4111-8111-111111111111', { method: 'POST', body: JSON.stringify({ status: 'RESOLVED' }) });
    expect(result.status).toBe(200);
    expect(prisma.contentReport.update).toHaveBeenCalled();
  });
});
