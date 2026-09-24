/* global console, URL */
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, routeParts, validContent, RequestError } from './request.js';
import { createRateLimiter } from './rate-limit.js';
import { consumeLimit } from './auth.js';
import { isContentVisible } from './moderation.js';
import { publicRegistrationEnabled } from './access.js';
import { createMemberAccount } from './member-account.js';

const root = fileURLToPath(new URL('..', import.meta.url));
export function createRequestHandler({ prisma, corsOrigin = '', distDirectory = join(root, 'dist'), auth, cognito, uploads, submissions, admin, reports, operations, translator, config = {} }) {
  const memberAccount = auth ? createMemberAccount({ prisma, auth }) : null;
  const commentLimit = createRateLimiter({ limit: 1, windowMs: 30000 });
  const translationLimit = createRateLimiter({ limit: 20, windowMs: 60000 });
  const requestLimit = createRateLimiter({ limit: 60, windowMs: 60000 });

  const securityHeaders = {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(self), microphone=(), geolocation=()',
    'content-security-policy': "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https:; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    ...(config.local ? {} : { 'strict-transport-security': 'max-age=31536000' }),
  };

  const send = (response, status, payload, headers = {}) => {
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(corsOrigin ? { 'access-control-allow-origin': corsOrigin, 'access-control-allow-credentials': 'true', vary: 'Origin' } : {}), ...securityHeaders, ...headers });
    response.end(JSON.stringify(payload));
  };

  const dayKey = () => new Date().toISOString().slice(0, 10);

  async function handleApi(request, response, parts) {
    const peer = request.socket.remoteAddress || 'unknown';
    const forwarded = config.trustedProxyPeers?.has(peer) ? String(request.headers['x-forwarded-for'] || '').split(',')[0].trim() : '';
    const clientKey = forwarded || peer;
    request.clientIp = clientKey;
    if (!requestLimit.take(clientKey)) return send(response, 429, { error: 'Too many requests. Please try again later.' }, { 'retry-after': '60' });
    if (parts.length === 2 && parts[1] === 'health' && request.method === 'GET') return send(response, 200, { ok: true });
    if (parts.length === 2 && parts[1] === 'config' && request.method === 'GET') {
      const registrationEnabled = await publicRegistrationEnabled(prisma, config.registrationEnabled === true);
      return send(response, 200, { registrationEnabled, maintenanceMode: !registrationEnabled, cognitoEnabled: config.cognitoEnabled === true, translationEnabled: config.translation?.enabled === true });
    }
    if (parts[1] === 'auth' && parts[2] === 'cognito' && cognito) return cognito.handle(request, response, parts, send);
    if (parts[1] === 'auth' && auth) return auth.handle(request, response, parts, send);
    if (parts[1] === 'account' && memberAccount) return memberAccount.handle(request, response, parts, send);
    if (parts[1] === 'reports' && reports) return reports.handle(request, response, parts, send);
    if (parts.length === 2 && parts[1] === 'submissions' && request.method === 'GET' && submissions) return submissions.handle(request, response, parts, send);
    if (['uploads', 'public-uploads', 'verifications'].includes(parts[1]) && uploads) return uploads.handle(request, response, parts, send);
    if (parts[1] === 'admin' && parts[2] === 'reports' && reports) return reports.handle(request, response, parts, send);
    if (parts[1] === 'admin' && ['operations', 'content', 'publication-pause', 'registration-access'].includes(parts[2]) && operations) return operations.handle(request, response, parts, send);
    if (parts[1] === 'admin' && parts[2] === 'verifications' && submissions) return submissions.handle(request, response, parts, send);
    if (parts[1] === 'admin' && admin) return admin.handle(request, response, parts, send);
    if (parts[1] === 'public-submissions' && submissions) return submissions.handle(request, response, parts, send);
    if (parts[1] === 'submissions' && submissions) return submissions.handle(request, response, parts, send);
    if (parts.length === 2 && parts[1] === 'translate' && request.method === 'POST') {
      if (!translator) return send(response, 503, { error: 'Translation is temporarily unavailable.' });
      if (!translationLimit.take(clientKey)) return send(response, 429, { error: 'Too many translation requests. Please try again later.' }, { 'retry-after': '60' });
      const body = await readJson(request);
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      const sourceLanguage = body.sourceLanguage === 'ar' || body.sourceLanguage === 'en' ? body.sourceLanguage : '';
      const targetLanguage = body.targetLanguage === 'ar' || body.targetLanguage === 'en' ? body.targetLanguage : '';
      if (!text || text.length > 3000 || !sourceLanguage || !targetLanguage || sourceLanguage === targetLanguage) return send(response, 400, { error: 'Invalid translation request' });
      const translation = await translator.translate({ text, sourceLanguage, targetLanguage });
      return send(response, 200, translation);
    }
    if (parts.length === 2 && parts[1] === 'ready' && request.method === 'GET') {
      await prisma.$queryRaw`SELECT 1`;
      return send(response, 200, { ok: true });
    }
    if (parts.length !== 5 || parts[1] !== 'content' || !validContent(parts[2], parts[3])) return send(response, 404, { error: 'Not found' });
    const [, , contentType, contentId, action] = parts;
    if (!(await isContentVisible(prisma, contentType, contentId))) return send(response, 404, { error: 'Not found' });
    if (request.method === 'GET' && action === 'visible') return send(response, 200, { visible: true });

    if (request.method === 'POST' && action === 'view') {
      const visitorId = String(request.headers['x-visitor-id'] || '').slice(0, 100);
      if (!visitorId) return send(response, 400, { error: 'Visitor ID is required' });
      try {
        await prisma.contentView.create({ data: { contentType, contentId, visitorId, dayKey: dayKey() } });
      } catch (error) {
        if (error?.code !== 'P2002') throw error;
      }
      const viewCount = await prisma.contentView.count({ where: { contentType, contentId } });
      return send(response, 200, { viewCount });
    }

    if (action === 'comments' && request.method === 'GET') {
      const comments = await prisma.comment.findMany({ where: { contentType, contentId, status: 'PUBLISHED' }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, displayName: true, body: true, language: true, createdAt: true, user: { select: { profile: { select: { verificationState: true } } } } } });
      return send(response, 200, { comments: comments.map(comment => ({ ...comment, verifiedResident: comment.user?.profile?.verificationState === 'VERIFIED', user: undefined })) });
    }

    if (action === 'comments' && request.method === 'POST') {
      if (!auth) throw new RequestError(503, 'Authentication is not configured');
      const current = await auth.protect(request);
      if (!current.publicUser.residentVerified) throw new RequestError(403, 'Only verified residents can leave comments.');
      const visitorId = current.userId;
      await consumeLimit(prisma, 'comment', current.userId, 1, 30000);
      const body = await readJson(request);
      const commentText = typeof body.body === 'string' ? body.body.trim() : '';
      const displayName = current.publicUser.name;
      const language = body.language === 'ar' ? 'ar' : 'en';
      if (commentText.length < 3 || commentText.length > 500) return send(response, 400, { error: 'Comment must be between 3 and 500 characters.' });
      if (!commentLimit.take(visitorId)) return send(response, 429, { error: 'Please wait before posting another comment.' }, { 'retry-after': '30' });
      let comment;
      try {
        comment = await prisma.comment.create({ data: { contentType, contentId, userId: current.userId, body: commentText, displayName, language, status: 'HIDDEN' }, select: { id: true, displayName: true, body: true, language: true, createdAt: true } });
      } catch (error) {
        commentLimit.release(visitorId);
        throw error;
      }
      return send(response, 201, { comment: { ...comment, verifiedResident: true } });
    }
    return send(response, 404, { error: 'Not found' });
  }

  async function serveStatic(request, response) {
    const requested = normalize(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '');
    const relative = requested && !requested.includes('..') ? requested : 'index.html';
    const filePath = join(distDirectory, relative);
    try {
      const content = await readFile(filePath);
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.webmanifest': 'application/manifest+json' };
      response.writeHead(200, { 'content-type': types[extname(filePath)] || 'application/octet-stream', 'cache-control': relative.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache', ...securityHeaders });
      if (request.method !== 'HEAD') response.end(content);
      else response.end();
    } catch (error) {
      if (!['ENOENT', 'EISDIR', 'ENOTDIR'].includes(error.code)) throw error;
      if (extname(relative) || relative.startsWith('assets/')) return send(response, 404, { error: 'Not found' });
      const content = await readFile(join(distDirectory, 'index.html'));
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', ...securityHeaders });
      if (request.method !== 'HEAD') response.end(content);
      else response.end();
    }
  }

  return async (request, response) => {
    if (request.method === 'OPTIONS') return send(response, 204, {}, { 'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type,x-visitor-id,x-csrf-token,x-file-name' });
    try {
      const parts = routeParts(request.url);
      if (parts[0] === 'api') return await handleApi(request, response, parts);
      if (request.method === 'GET' || request.method === 'HEAD') return await serveStatic(request, response);
      return send(response, 405, { error: 'Method not allowed' });
    } catch (error) {
      if (error instanceof RequestError) return send(response, error.status, { error: error.message });
      console.error('Request failed', error.code || error.name);
      return send(response, 500, { error: 'Internal server error' });
    }
  };
}
