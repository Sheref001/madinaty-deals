/* global process, console, setInterval, clearInterval */
import { createServer } from 'node:http';
import { PrismaClient } from '@prisma/client';
import { createRequestHandler } from './app.js';
import { loadConfig } from './config.js';
import { createMailer } from './mailer.js';
import { createAuth } from './auth.js';
import { createUploads } from './uploads.js';
import { createLocalStorage } from './local-storage.js';
import { createSubmissions } from './submissions.js';
import { createAdmin } from './admin.js';

const prisma = new PrismaClient();
const port = Number(process.env.PORT || 3000);
const config = loadConfig();
const auth = createAuth({ prisma, config, mailer: createMailer(config) });
const uploads = createUploads({ prisma, config, auth, storage: createLocalStorage(config.uploadDirectory) });
const submissions = createSubmissions({ prisma, auth });
const admin = createAdmin({ prisma, auth });
const server = createServer(createRequestHandler({ prisma, auth, uploads, submissions, admin, corsOrigin: config.origin }));
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
