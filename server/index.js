/* global process, console, setInterval, clearInterval */
import { createServer } from 'node:http';
import { PrismaClient } from '@prisma/client';
import { createRequestHandler } from './app.js';
import nodemailer from 'nodemailer';
import { S3Client } from '@aws-sdk/client-s3';
import { loadConfig } from './config.js';
import { createAuth } from './auth.js';
import { createUploads } from './uploads.js';
import { createPush, loadPushConfig } from './push.js';
import { createSubmissions } from './submissions.js';

const prisma = new PrismaClient();
const port = Number(process.env.PORT || 3000);
const config = loadConfig();
const auth = createAuth({ prisma, config, mailer: nodemailer.createTransport(config.smtp) });
const uploads = createUploads({ prisma, config, auth, storage: new S3Client(config.storage) });
const submissions = createSubmissions({ prisma, auth });
const push = createPush({ prisma, origin: config.origin, config: loadPushConfig(), auth });
const server = createServer(createRequestHandler({ prisma, auth, uploads, submissions, push, corsOrigin: config.origin, trustedProxyIps: config.trustedProxyIps }));
server.requestTimeout = 45000;
server.headersTimeout = 15000;

server.listen(port, () => console.log(`Madinaty Deals server listening on port ${port}`));
const cleanup = setInterval(() => {
  const now = new Date();
  prisma.$transaction([prisma.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } }), prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }), prisma.otpChallenge.deleteMany({ where: { expiresAt: { lt: now } } })]).catch(() => console.error('Authentication cleanup failed'));
}, 3600000);
cleanup.unref();
const shutdown = () => { clearInterval(cleanup); server.close(async () => { await prisma.$disconnect(); }); };
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
