/* global process, URL */
import { createECDH, createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { RequestError, readJson } from './request.js';
import { consumeLimit, isReviewer } from './auth.js';

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

export function createPush({ prisma, origin, config, auth }) {
  return { async handle(request, response, parts, send) {
    const route = parts.join('/');
    if (route === 'api/push/config' && request.method === 'GET') return send(response, 200, { enabled: Boolean(config), publicKey: config?.publicKey || null });
    if (route !== 'api/push/subscriptions' && !route.startsWith('api/admin/notification-campaigns')) throw new RequestError(404, 'Not found');
    if (request.headers.origin !== origin) throw new RequestError(403, 'Request origin is not allowed');
    if (route === 'api/admin/notification-campaigns') {
      const current = await auth.protect(request);
      if (!isReviewer(current.user)) throw new RequestError(403, 'Reviewer access required');
      if (request.method === 'GET') {
        const campaigns = await prisma.pushCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { deliveries: { select: { status: true } } } });
        return send(response, 200, { campaigns: campaigns.map(item => ({ ...item, metrics: item.deliveries.reduce((result, delivery) => ({ ...result, [delivery.status]: (result[delivery.status] || 0) + 1 }), {}) })) });
      }
      if (request.method !== 'POST') throw new RequestError(404, 'Not found');
      const campaign = validateCampaign(await readJson(request), origin);
      const created = await prisma.pushCampaign.create({ data: { id: campaign.id, payloadHash: campaign.hash, advertiserName: campaign.advertiserName, offerTitle: campaign.offerTitle, offerDetails: campaign.offerDetails, category: campaign.category, zone: campaign.zone, language: campaign.language, startsAt: campaign.startsAt, endsAt: campaign.endsAt, feeCents: campaign.feeCents, reviewStatus: 'PENDING', paymentStatus: 'PENDING' } });
      return send(response, 201, { campaign: { id: created.id, reviewStatus: created.reviewStatus, paymentStatus: created.paymentStatus } });
    }
    const campaignMatch = route.match(/^api\/admin\/notification-campaigns\/([a-f0-9-]+)\/(review|payment)$/);
    if (campaignMatch && request.method === 'POST') {
      const current = await auth.protect(request);
      if (!isReviewer(current.user)) throw new RequestError(403, 'Reviewer access required');
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(campaignMatch[1])) throw new RequestError(400, 'Invalid campaign ID');
      const body = await readJson(request);
      if (campaignMatch[2] === 'review') {
        if (!['APPROVED', 'REJECTED'].includes(body.status)) throw new RequestError(400, 'Invalid review status');
        const changed = await prisma.pushCampaign.updateMany({ where: { id: campaignMatch[1], reviewStatus: 'PENDING' }, data: { reviewStatus: body.status, reviewReason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : null, reviewedAt: new Date() } });
        if (!changed.count) throw new RequestError(409, 'Campaign has already been reviewed');
      } else {
        if (current.user.role !== 'ADMIN') throw new RequestError(403, 'Admin payment confirmation required');
        if (!['PAID', 'FAILED', 'REFUNDED'].includes(body.status)) throw new RequestError(400, 'Invalid payment status');
        const changed = await prisma.pushCampaign.updateMany({ where: { id: campaignMatch[1] }, data: { paymentStatus: body.status, paidAt: body.status === 'PAID' ? new Date() : null } });
        if (!changed.count) throw new RequestError(404, 'Campaign not found');
      }
      return send(response, 200, { ok: true });
    }
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
    const categories = Array.isArray(body.categories) ? body.categories.filter(item => typeof item === 'string').slice(0, 20) : [];
    const zones = Array.isArray(body.zones) ? body.zones.filter(item => typeof item === 'string').slice(0, 30) : [];
    const data = { ...subscription, language: body.language, categories, zones, consentVersion: 'updates-offers-v1', consentedAt: new Date(), applicationServerKey: config.publicKey };
    await prisma.pushSubscription.upsert({ where: { endpoint: subscription.endpoint }, create: data, update: data });
    return send(response, 201, { ok: true });
  } };

}

export function validateCampaign(input, origin) {
  if (!input || typeof input !== 'object' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(input.id || '')) throw new Error('Campaign requires a permanent UUID id');
  for (const [key, max] of [['title', 80], ['body', 240]]) {
    if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > max) throw new Error(`Invalid campaign ${key}`);
  }
  for (const [key, max] of [['advertiserName', 120], ['offerTitle', 120], ['offerDetails', 1000]]) {
    if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > max) throw new Error(`Invalid campaign ${key}`);
  }
  if (!['ar', 'en', 'all'].includes(input.language)) throw new Error('Choose ar, en or all for campaign language');
  if (typeof input.category !== 'string' || input.category.length > 80 || typeof input.zone !== 'string' || input.zone.length > 80) throw new Error('Campaign audience is required');
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 31 * 86400000) throw new Error('Campaign dates must be valid and no longer than 31 days');
  if (!Number.isInteger(input.feeCents) || input.feeCents < 0 || input.feeCents > 100000000) throw new Error('Campaign fee is invalid');
  const base = new URL(origin);
  const target = new URL(input.url || '/', base);
  if (target.origin !== base.origin || target.username || target.password || !['http:', 'https:'].includes(target.protocol)) throw new Error('Notifications must link to this website');
  const payload = { title: input.title.trim(), body: input.body.trim(), url: target.pathname + target.search + target.hash, tag: input.id };
  const hash = createHash('sha256').update(JSON.stringify({ ...payload, language: input.language })).digest('hex');
  const campaign = { id: input.id, language: input.language, advertiserName: input.advertiserName.trim(), offerTitle: input.offerTitle.trim(), offerDetails: input.offerDetails.trim(), category: input.category.trim(), zone: input.zone.trim(), startsAt, endsAt, feeCents: input.feeCents, payload, hash };
  return { ...campaign, payload: { ...payload, title: campaign.offerTitle, body: `${campaign.advertiserName}: ${campaign.offerDetails}`, tag: campaign.id } };
}
