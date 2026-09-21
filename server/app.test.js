import { Readable } from 'node:stream';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRequestHandler } from './app.js';
import { createRateLimiter } from './rate-limit.js';

async function request(handler, url, { method = 'GET', body = '', headers = {} } = {}) {
  const incoming = Readable.from(body ? [body] : []);
  Object.assign(incoming, { url, method, headers, socket: { remoteAddress: '127.0.0.1' } });
  const result = {};
  await handler(incoming, {
    writeHead(status, responseHeaders) { Object.assign(result, { status, headers: responseHeaders }); },
    end(data) { result.body = data?.toString() || ''; },
  });
  return result;
}

const auth = { protect: async () => ({ userId: 'user-1', publicUser: { name: 'Neighbour', residentVerified: true } }) };
const database = () => ({
  $queryRaw: vi.fn().mockResolvedValue([{ count: 1 }]),
  contentView: { create: vi.fn().mockResolvedValue({}), count: vi.fn().mockResolvedValue(1) },
  comment: { create: vi.fn().mockResolvedValue({ id: 'comment-1', body: 'مرحبا' }), findMany: vi.fn().mockResolvedValue([]) },
});

describe('API responses', () => {
  it('serves health without touching the database', async () => {
    const result = await request(createRequestHandler({ prisma: {} }), '/api/health');
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ ok: true });
    expect(result.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('uses the configured CORS origin for preflight', async () => {
    const result = await request(createRequestHandler({ prisma: {}, corsOrigin: 'https://madinatydeals.com' }), '/api/health', { method: 'OPTIONS' });
    expect(result.status).toBe(204);
    expect(result.headers['access-control-allow-origin']).toBe('https://madinatydeals.com');
    expect(result.headers['access-control-allow-credentials']).toBe('true');
  });

  it('routes verification review controls to the submission reviewer and user controls to admin', async () => {
    const admin = { handle: vi.fn(async (_request, response, _parts, send) => send(response, 200, { source: 'admin' })) };
    const submissions = { handle: vi.fn(async (_request, response, _parts, send) => send(response, 200, { source: 'verification-review' })) };
    const handler = createRequestHandler({ prisma: {}, admin, submissions });
    const verification = await request(handler, '/api/admin/verifications');
    const users = await request(handler, '/api/admin/users');
    expect(JSON.parse(verification.body)).toEqual({ source: 'verification-review' });
    expect(JSON.parse(users.body)).toEqual({ source: 'admin' });
    expect(submissions.handle).toHaveBeenCalledOnce();
    expect(admin.handle).toHaveBeenCalledOnce();
  });

  it.each(['/api/content/listing', '/api/content/listing/id/comments/extra', '/api/health/extra'])('rejects incomplete or extra route segments: %s', async url => {
    expect((await request(createRequestHandler({ prisma: {} }), url)).status).toBe(404);
  });

  it.each([['{', 400], ['null', 400], ['x'.repeat(10001), 413]])('rejects invalid comment bodies', async (body, status) => {
    const prisma = database();
    const result = await request(createRequestHandler({ prisma, auth }), '/api/content/listing/id/comments', { method: 'POST', body });
    expect(result.status).toBe(status);
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed URL escaping', async () => {
    expect((await request(createRequestHandler({ prisma: {} }), '/api/content/listing/%ZZ/comments')).status).toBe(400);
  });

  it('counts duplicate daily views without failing', async () => {
    const prisma = database();
    prisma.contentView.create.mockRejectedValue({ code: 'P2002' });
    const result = await request(createRequestHandler({ prisma, auth }), '/api/content/listing/id/view', { method: 'POST', headers: { 'x-visitor-id': 'visitor-1' } });
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ viewCount: 1 });
  });

  it('queues valid Arabic comments and throttles concurrent submissions', async () => {
    const prisma = database();
    const handler = createRequestHandler({ prisma, auth });
    const options = { method: 'POST', body: JSON.stringify({ body: 'مرحبا', language: 'ar', status: 'HIDDEN', userId: 'user-1' }), headers: { 'x-visitor-id': 'visitor-1' } };
    const results = await Promise.all([request(handler, '/api/content/listing/id/comments', options), request(handler, '/api/content/listing/id/comments', options)]);
    expect(results.map(result => result.status).sort()).toEqual([201, 429]);
    expect(prisma.comment.create).toHaveBeenCalledTimes(1);
    expect(prisma.comment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ body: 'مرحبا', language: 'ar', status: 'HIDDEN', userId: 'user-1' }) }));
  });

  it('rejects comments from residents without verification', async () => {
    const prisma = database();
    const unverifiedAuth = { protect: async () => ({ userId: 'user-2', publicUser: { name: 'Neighbour', residentVerified: false } }) };
    const result = await request(createRequestHandler({ prisma, auth: unverifiedAuth }), '/api/content/listing/id/comments', { method: 'POST', body: JSON.stringify({ body: 'مرحبا', language: 'ar' }) });
    expect(result.status).toBe(403);
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });

  it('does not bypass the client limit with new routes or forwarded IP headers', async () => {
    const handler = createRequestHandler({ prisma: {} });
    for (let index = 0; index < 60; index++) {
      expect((await request(handler, `/api/unknown/${index}`, { headers: { 'x-forwarded-for': String(index) } })).status).toBe(404);
    }
    expect((await request(handler, '/api/health')).status).toBe(429);
  });
});

describe('static production files', () => {
  let directory;
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'madinaty-static-'));
    await mkdir(join(directory, 'assets'));
    await writeFile(join(directory, 'index.html'), '<html>app</html>');
    await writeFile(join(directory, 'robots.txt'), 'User-agent: *');
    await writeFile(join(directory, 'sitemap.xml'), '<urlset />');
    await writeFile(join(directory, 'assets/app-hash.js'), 'export {};');
  });
  afterAll(async () => { await rm(directory, { recursive: true, force: true }); });

  it('serves SPA navigation and allows local photo previews', async () => {
    const result = await request(createRequestHandler({ prisma: {}, distDirectory: directory }), '/browse');
    expect(result.status).toBe(200);
    expect(result.body).toBe('<html>app</html>');
    expect(result.headers['cache-control']).toBe('no-cache');
    expect(result.headers['content-security-policy']).toContain("img-src 'self' data: blob:");
  });

  it.each([['robots.txt', 'text/plain'], ['sitemap.xml', 'application/xml']])('serves the correct MIME type for %s', async (path, mime) => {
    const result = await request(createRequestHandler({ prisma: {}, distDirectory: directory }), `/${path}`);
    expect(result.status).toBe(200);
    expect(result.headers['content-type']).toContain(mime);
  });

  it('caches bundled assets and returns 404 for missing assets', async () => {
    const handler = createRequestHandler({ prisma: {}, distDirectory: directory });
    const found = await request(handler, '/assets/app-hash.js');
    expect(found.status).toBe(200);
    expect(found.headers['cache-control']).toContain('immutable');
    expect((await request(handler, '/assets/missing.js')).status).toBe(404);
  });
});

it('expires rate limits and keeps the number of stored clients bounded', () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 2 });
  expect(limiter.take('a', 0)).toBe(true);
  expect(limiter.take('a', 1)).toBe(false);
  expect(limiter.take('b', 1)).toBe(true);
  expect(limiter.take('c', 2)).toBe(false);
  expect(limiter.take('c', 1000)).toBe(true);
});
