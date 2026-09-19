/* global process, URL */
import { createECDH, createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { RequestError, readJson } from './request.js';
import { consumeLimit } from './auth.js';

export function loadPushConfig(env = process.env) {
  const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: subject } = env;
  if (!publicKey && !privateKey && !subject) return null;
  if (!publicKey || !privateKey || !subject) throw new Error('Configure all three VAPID variables');
  const contact = new URL(subject);
  if (!['mailto:', 'https:'].includes(contact.protocol)) throw new Error('VAPID_SUBJECT must be mailto: or HTTPS');
  const curve = createECDH('prime256v1');
  curve.setPrivateKey(Buffer.from(privateKey, 'base64url'));
  if (curve.getPublicKey().toString('base64url') !== publicKey) throw new Error('VAPID keys do not match');
  return { publicKey, privateKey, subject };
}

export function validateSubscription(body) {
  const subscription = body.subscription;
  if (!subscription || typeof subscription.endpoint !== 'string' || subscription.endpoint.length > 2048) throw new RequestError(400, 'Invalid notification subscription');
  let endpoint;
  try { endpoint = new URL(subscription.endpoint); } catch { throw new RequestError(400, 'Invalid notification subscription'); }
  const allowed = endpoint.hostname === 'fcm.googleapis.com' || endpoint.hostname === 'updates.push.services.mozilla.com' || endpoint.hostname.endsWith('.push.apple.com') || endpoint.hostname.endsWith('.notify.windows.com');
  if (!allowed || endpoint.protocol !== 'https:' || endpoint.port || endpoint.username || endpoint.password || endpoint.hash) throw new RequestError(400, 'Unsupported notification service');
  const keys = subscription.keys;
  if (!keys || typeof keys.p256dh !== 'string' || !/^[A-Za-z0-9_-]{87}$/.test(keys.p256dh) || Buffer.from(keys.p256dh, 'base64url')[0] !== 4 || typeof keys.auth !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(keys.auth)) throw new RequestError(400, 'Invalid notification keys');
  return { endpoint: endpoint.href, p256dh: keys.p256dh, auth: keys.auth };
}

export function createPush({ prisma, origin, config }) {
  return { async handle(request, response, parts, send) {
    const route = parts.join('/');
    if (route === 'api/push/config' && request.method === 'GET') return send(response, 200, { enabled: Boolean(config), publicKey: config?.publicKey || null });
    if (route !== 'api/push/subscriptions' || !['POST', 'DELETE'].includes(request.method)) throw new RequestError(404, 'Not found');
    if (request.headers.origin !== origin) throw new RequestError(403, 'Request origin is not allowed');
    await consumeLimit(prisma, 'push-subscription', request.clientIp || request.socket.remoteAddress || 'unknown', 30, 3600000);
    const body = await readJson(request);
    const subscription = validateSubscription(body);
    if (request.method === 'DELETE') {
      await prisma.pushSubscription.deleteMany({ where: { endpoint: subscription.endpoint, auth: subscription.auth, p256dh: subscription.p256dh } });
      return send(response, 200, { ok: true });
    }
    if (!config) throw new RequestError(503, 'Notifications are currently unavailable. Please try again later.');
    if (body.consent !== true || !['ar', 'en'].includes(body.language)) throw new RequestError(400, 'Notification consent is required');
    // Re-confirmation updates language/keys but does not invent consent on page load.
    const data = { ...subscription, language: body.language, consentVersion: 'updates-offers-v1', consentedAt: new Date(), applicationServerKey: config.publicKey };
    await prisma.pushSubscription.upsert({ where: { endpoint: subscription.endpoint }, create: data, update: data });
    return send(response, 201, { ok: true });
  } };

}

export function validateCampaign(input, origin) {
  if (!input || typeof input !== 'object' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(input.id || '')) throw new Error('Campaign requires a permanent UUID id');
  for (const [key, max] of [['title', 80], ['body', 240]]) {
    if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > max) throw new Error(`Invalid campaign ${key}`);
  }
  if (!['ar', 'en', 'all'].includes(input.language)) throw new Error('Choose ar, en or all for campaign language');
  const base = new URL(origin);
  const target = new URL(input.url || '/', base);
  if (target.origin !== base.origin || target.username || target.password || !['http:', 'https:'].includes(target.protocol)) throw new Error('Notifications must link to this website');
  const payload = { title: input.title.trim(), body: input.body.trim(), url: target.pathname + target.search + target.hash, tag: input.id };
  const hash = createHash('sha256').update(JSON.stringify({ ...payload, language: input.language })).digest('hex');
  return { id: input.id, language: input.language, payload, hash };
}
