/* global process, console */
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import webpush from 'web-push';
import { loadPushConfig, validateCampaign } from '../server/push.js';
import { deliverCampaign } from '../server/push-sender.js';

const args = process.argv.slice(2);
const file = args.find(arg => !arg.startsWith('--'));
if (!file || args.some(arg => arg.startsWith('--') && arg !== '--send') || args.filter(arg => !arg.startsWith('--')).length !== 1) {
  console.error('Usage: npm run notifications:send -- campaign.json [--send] (without --send: preview only)');
  process.exitCode = 1;
} else {
  const prisma = new PrismaClient();
  try {
    const config = loadPushConfig();
    if (!config || !process.env.APP_ORIGIN) throw new Error('Configure VAPID keys, VAPID_SUBJECT and APP_ORIGIN first');
    const campaign = validateCampaign(JSON.parse(await readFile(file, 'utf8')), process.env.APP_ORIGIN);
    console.log(JSON.stringify({ id: campaign.id, advertiserName: campaign.advertiserName, offerTitle: campaign.offerTitle, category: campaign.category, zone: campaign.zone, startsAt: campaign.startsAt, endsAt: campaign.endsAt, feeCents: campaign.feeCents, language: campaign.language, ...campaign.payload }, null, 2));
    const counts = await deliverCampaign({ prisma, config, campaign, sendNotification: webpush.sendNotification.bind(webpush), send: args.includes('--send') });
    console.log(JSON.stringify(counts, null, 2));
    console.log(counts.dryRun ? 'Preview only. No notifications sent. Add --send only after reviewing the content and audience.' : 'Accepted means accepted by the push service, not guaranteed delivery.');
    if (counts.failed) process.exitCode = 1;
  } catch (error) {
    // Never print subscription endpoints or encryption keys.
    console.error('Notification command failed:', error.code || error.name);
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
}
