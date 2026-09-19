import { validateSubscription } from './push.js';

// The CLI previews by default. No push service is contacted without send=true.
export async function deliverCampaign({ prisma, config, campaign, sendNotification, send = false }) {
  const where = { applicationServerKey: config.publicKey, ...(campaign.language === 'all' ? {} : { language: campaign.language }) };
  const recipients = await prisma.pushSubscription.count({ where });
  const counts = { recipients, accepted: 0, expired: 0, failed: 0, skipped: 0, dryRun: !send };
  if (!send) return counts;
  const stored = await prisma.pushCampaign.upsert({ where: { id: campaign.id }, create: { id: campaign.id, payloadHash: campaign.hash }, update: {} });
  if (stored.payloadHash !== campaign.hash) throw new Error('Campaign ID already belongs to different content; use a new ID');
  let cursor;
  const cutoff = new Date();
  for (;;) {
    const batch = await prisma.pushSubscription.findMany({ where: { ...where, consentedAt: { lte: cutoff }, ...(cursor ? { id: { gt: cursor } } : {}) }, orderBy: { id: 'asc' }, take: 100 });
    if (!batch.length) break;
    // Use ID comparison instead of a cursor row, which may be removed on expiry.
    cursor = batch.at(-1).id;
    for (let offset = 0; offset < batch.length; offset += 5) {
      const results = await Promise.allSettled(batch.slice(offset, offset + 5).map(async subscription => {
        const key = { campaignId: campaign.id, subscriptionId: subscription.id };
        try { await prisma.pushDelivery.create({ data: key }); }
        catch (error) { if (error.code === 'P2002') { counts.skipped++; return; } throw error; }
        let status;
        try {
          const clean = validateSubscription({ subscription: { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } } });
          await sendNotification({ endpoint: clean.endpoint, keys: { p256dh: clean.p256dh, auth: clean.auth } }, JSON.stringify(campaign.payload), { vapidDetails: config, TTL: 3600, timeout: 10000 });
          counts.accepted++; status = 'ACCEPTED';
        } catch (error) {
          if ([404, 410].includes(error.statusCode)) {
            await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
            counts.expired++; status = 'EXPIRED';
          } else { counts.failed++; status = 'FAILED'; }
        }
        await prisma.pushDelivery.update({ where: { campaignId_subscriptionId: key }, data: { status } });
      }));
      const failed = results.find(result => result.status === 'rejected');
      if (failed) throw failed.reason;
    }
  }
  return counts;
}
