import { Readable } from 'node:stream';
import { Buffer } from 'node:buffer';
import { createECDH } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createPush, loadPushConfig, validateCampaign, validateSubscription } from './push.js';
import { deliverCampaign } from './push-sender.js';

const curve = createECDH('prime256v1'); curve.generateKeys();
const config = { publicKey: curve.getPublicKey().toString('base64url'), privateKey: curve.getPrivateKey().toString('base64url'), subject: 'mailto:owner@example.test' };
const subscription = { endpoint: 'https://fcm.googleapis.com/wp/test-device', keys: { p256dh: config.publicKey, auth: Buffer.alloc(16, 1).toString('base64url') } };
const origin = 'https://madinatydeals.com';
const draft = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'New local offers', body: 'Discover this week’s offers.', language: 'en', url: '/?lang=en' };
function fixture(pushConfig = config) {
  const prisma = { $queryRaw: vi.fn().mockResolvedValue([{ count: 1 }]), pushSubscription: { upsert: vi.fn(), deleteMany: vi.fn() } };
  const handler = createPush({ prisma, config: pushConfig, origin });
  const send = vi.fn();
  const call = (body, method = 'POST', requestOrigin = origin, path = 'api/push/subscriptions') => handler.handle(Object.assign(Readable.from([JSON.stringify(body)]), { method, headers: { origin: requestOrigin }, socket: { remoteAddress: '127.0.0.1' } }), {}, path.split('/'), send);
  return { prisma, call, send };
}

describe('push subscription consent and validation', () => {
  it('remains disabled without keys and rejects partial or mismatched configuration', () => {
    expect(loadPushConfig({})).toBeNull();
    expect(() => loadPushConfig({ VAPID_PUBLIC_KEY: config.publicKey })).toThrow();
    expect(loadPushConfig({ VAPID_PUBLIC_KEY: config.publicKey, VAPID_PRIVATE_KEY: config.privateKey, VAPID_SUBJECT: config.subject })).toEqual(config);
    expect(() => loadPushConfig({ VAPID_PUBLIC_KEY: 'wrong', VAPID_PRIVATE_KEY: config.privateKey, VAPID_SUBJECT: config.subject })).toThrow();
  });
  it('publishes only the public key, never the private key', async () => {
    const f = fixture(); await f.call({}, 'GET', origin, 'api/push/config');
    expect(f.send).toHaveBeenCalledWith({}, 200, { enabled: true, publicKey: config.publicKey });
  });
  it('requires explicit consent and same-origin requests', async () => {
    const f = fixture();
    await expect(f.call({ subscription, language: 'en' })).rejects.toMatchObject({ status: 400 });
    await expect(f.call({ subscription, language: 'en', consent: true }, 'POST', 'https://attacker.test')).rejects.toMatchObject({ status: 403 });
    expect(f.prisma.pushSubscription.upsert).not.toHaveBeenCalled();
  });
  it('stores consent, language and key version only after acceptance', async () => {
    const f = fixture(); await f.call({ subscription, language: 'ar', consent: true });
    expect(f.prisma.pushSubscription.upsert.mock.calls[0][0].create).toMatchObject({ language: 'ar', consentVersion: 'updates-offers-v1', applicationServerKey: config.publicKey });
    expect(f.send).toHaveBeenCalledWith({}, 201, { ok: true });
  });
  it('does not accept subscriptions when delivery is unconfigured', async () => {
    const f = fixture(null);
    await expect(f.call({ subscription, language: 'ar', consent: true })).rejects.toMatchObject({ status: 503 });
    expect(f.prisma.pushSubscription.upsert).not.toHaveBeenCalled();
  });
  it.each(['http://fcm.googleapis.com/wp/a', 'https://127.0.0.1/internal', 'https://fcm.googleapis.com.attacker.test/a', 'https://attacker.test/push.apple.com', 'https://fcm.googleapis.com:8443/a', 'https://name:password@fcm.googleapis.com/a'])('rejects unsafe push endpoint %s', endpoint => {
    expect(() => validateSubscription({ subscription: { ...subscription, endpoint } })).toThrow();
  });
  it('requires matching device keys when removing a subscription', async () => {
    const f = fixture(); await f.call({ subscription }, 'DELETE');
    expect(f.prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { endpoint: subscription.endpoint, ...subscription.keys } });
  });
  it('enforces the shared subscription rate limit', async () => {
    const f = fixture(); f.prisma.$queryRaw.mockResolvedValue([{ count: 31 }]);
    await expect(f.call({ subscription, consent: true, language: 'en' })).rejects.toMatchObject({ status: 429 });
    expect(f.prisma.pushSubscription.upsert).not.toHaveBeenCalled();
  });
});

describe('notification sending', () => {
  function senderFixture() {
    const campaign = validateCampaign(draft, origin);
    const prisma = {
      pushSubscription: { count: vi.fn().mockResolvedValue(1), findMany: vi.fn().mockResolvedValueOnce([{ id: 'device', endpoint: subscription.endpoint, ...subscription.keys }]).mockResolvedValue([]), deleteMany: vi.fn() },
      pushCampaign: { upsert: vi.fn().mockResolvedValue({ payloadHash: campaign.hash }) },
      pushDelivery: { create: vi.fn(), update: vi.fn() },
    };
    const sendNotification = vi.fn().mockResolvedValue({ statusCode: 201 });
    return { prisma, campaign, config, sendNotification };
  }
  it('previews without sending or reserving any deliveries', async () => {
    const f = senderFixture(); const result = await deliverCampaign(f);
    expect(result).toMatchObject({ recipients: 1, dryRun: true, accepted: 0 });
    expect(f.sendNotification).not.toHaveBeenCalled();
    expect(f.prisma.pushCampaign.upsert).not.toHaveBeenCalled();
  });
  it('sends only to the selected language and current key with a bounded TTL', async () => {
    const f = senderFixture(); const result = await deliverCampaign({ ...f, send: true });
    expect(result.accepted).toBe(1);
    expect(f.prisma.pushSubscription.count.mock.calls[0][0].where).toEqual({ applicationServerKey: config.publicKey, language: 'en' });
    expect(f.sendNotification.mock.calls[0][2]).toMatchObject({ TTL: 3600, timeout: 10000 });
  });
  it('skips previously attempted deliveries rather than sending duplicates', async () => {
    const f = senderFixture(); f.prisma.pushDelivery.create.mockRejectedValue({ code: 'P2002' });
    expect((await deliverCampaign({ ...f, send: true })).skipped).toBe(1);
    expect(f.sendNotification).not.toHaveBeenCalled();
  });
  it('rejects reusing a campaign ID with different content', async () => {
    const f = senderFixture(); f.prisma.pushCampaign.upsert.mockResolvedValue({ payloadHash: 'old-content' });
    await expect(deliverCampaign({ ...f, send: true })).rejects.toThrow('different content');
    expect(f.sendNotification).not.toHaveBeenCalled();
  });
  it.each([404, 410])('removes expired subscriptions on %s', async statusCode => {
    const f = senderFixture(); f.sendNotification.mockRejectedValue({ statusCode });
    expect((await deliverCampaign({ ...f, send: true })).expired).toBe(1);
    expect(f.prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { id: 'device' } });
  });
  it('retains subscriptions after transient failures and records the failure', async () => {
    const f = senderFixture(); f.sendNotification.mockRejectedValue({ statusCode: 503 });
    expect((await deliverCampaign({ ...f, send: true })).failed).toBe(1);
    expect(f.prisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });
  it.each(['https://other.test/', '//other.test/', 'javascript:alert(1)'])('rejects campaign links outside the website: %s', url => {
    expect(() => validateCampaign({ ...draft, url }, origin)).toThrow();
  });
});
