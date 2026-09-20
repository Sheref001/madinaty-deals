import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { RequestError, readJson } from './request.js';

const digest = value => createHash('sha256').update(value).digest('hex');
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const publicUser = user => ({ id: user.id, email: user.email, phone: user.phone, role: user.role, name: user.profile?.displayName || 'Neighbour', residentVerified: user.profile?.verificationState === 'VERIFIED' });
export function normalizePhone(value) {
  const raw = typeof value === 'string' ? value.trim().replace(/[\s().-]/g, '') : '';
  const candidate = raw.startsWith('00') ? `+${raw.slice(2)}` : raw.startsWith('01') ? `+20${raw.slice(1)}` : raw;
  if (!/^\+[1-9]\d{7,14}$/.test(candidate)) throw new RequestError(400, 'Enter a valid phone number');
  return candidate;
}
export const isReviewer = user => ['ADMIN', 'MODERATOR'].includes(user.role);

// Atomic PostgreSQL counters are shared by every application instance.
export async function consumeLimit(prisma, namespace, identifier, limit, windowMs) {
  const now = Date.now();
  const key = digest(`${namespace}:${identifier}:${Math.floor(now / windowMs)}`);
  const expiresAt = new Date(Math.floor(now / windowMs) * windowMs + windowMs);
  const rows = await prisma.$queryRaw`INSERT INTO "RateLimit" ("key", "count", "expiresAt") VALUES (${key}, 1, ${expiresAt}) ON CONFLICT ("key") DO UPDATE SET "count" = "RateLimit"."count" + 1 RETURNING "count"`;
  if (rows[0].count > limit) throw new RequestError(429, 'Too many attempts. Please try again later.');
}

export function createAuth({ prisma, config, mailer }) {
  const hmac = value => createHmac('sha256', config.secret).update(value).digest('hex');
  const csrf = token => hmac(`csrf:${token}`);
  const cookie = (token, maxAge = 604800) => `${config.cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${config.local ? '' : '; Secure'}`;
  const assertOrigin = request => {
    if (request.headers.origin !== config.origin) throw new RequestError(403, 'Request origin is not allowed');
  };
  async function session(request, required = true) {
    const token = String(request.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith(config.cookieName + '='))?.slice(config.cookieName.length + 1);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      if (!required) return null;
      throw new RequestError(401, 'Please sign in to continue');
    }
    const record = await prisma.session.findUnique({ where: { tokenHash: digest(token) }, include: { user: { include: { profile: true } } } });
    if (!record || record.expiresAt <= new Date() || record.user.status !== 'ACTIVE' || (!record.user.emailVerifiedAt && !record.user.phoneVerifiedAt)) {
      if (!required) return null;
      throw new RequestError(401, 'Please sign in to continue');
    }
    return { ...record, token, csrfToken: csrf(token), publicUser: publicUser(record.user) };
  }
  async function protect(request) {
    assertOrigin(request);
    const current = await session(request);
    if (!same(request.headers['x-csrf-token'], current.csrfToken)) throw new RequestError(403, 'Invalid security token. Reload and try again.');
    return current;
  }
  async function handle(request, response, parts, send) {
    const route = parts.slice(1).join('/');
    if (route === 'auth/session' && request.method === 'GET') {
      const current = await session(request, false);
      return send(response, 200, { user: current?.publicUser || null, csrfToken: current?.csrfToken || null });
    }
    if (request.method !== 'POST') throw new RequestError(404, 'Not found');
    assertOrigin(request);
    if (route === 'auth/logout') {
      const current = await protect(request);
      await prisma.$transaction([
        prisma.session.deleteMany({ where: { id: current.id } }),
        prisma.auditLog.create({ data: { actorId: current.userId, action: 'auth.logout', targetType: 'Session', targetId: current.id } }),
      ]);
      return send(response, 200, { ok: true }, { 'set-cookie': cookie('', 0) });
    }
    const body = await readJson(request);
    const peer = request.clientIp || request.socket.remoteAddress || 'unknown';
    if (route === 'auth/request-code') {
      const requestedChannel = 'email';
      const destination = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination) || destination.length > 254) throw new RequestError(400, 'Enter a valid email address');
      const existingUser = config.registrationEnabled ? null : await prisma.user.findUnique({ where: { email: destination }, select: { id: true } });
      if (!config.registrationEnabled && !existingUser) throw new RequestError(403, 'Account creation is temporarily paused. Please try again later.');
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (config.registrationEnabled && (name.length < 2 || name.length > 80)) throw new RequestError(400, 'Enter a valid name');
      await consumeLimit(prisma, 'login-ip', peer, 20, 3600000);
      await consumeLimit(prisma, `login-${requestedChannel}-minute`, destination, 1, 60000);
      await consumeLimit(prisma, `login-${requestedChannel}-hour`, destination, 5, 3600000);
      const id = randomUUID();
      const code = String(randomInt(0, 1000000)).padStart(6, '0');
      await prisma.otpChallenge.create({ data: { id, destination, channel: requestedChannel, displayName: name || 'Madinaty Deals member', codeHash: hmac(`${id}:${code}`), expiresAt: new Date(Date.now() + 600000) } });
      try {
        if (requestedChannel === 'email') await mailer.sendMail({ from: config.from, to: destination, subject: 'Madinaty Deals sign-in code', text: `Your Madinaty Deals sign-in code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email.` });
      } catch {
        await prisma.otpChallenge.delete({ where: { id } });
        throw new RequestError(503, 'Code delivery is unavailable. Please try again later.');
      }
      return send(response, 202, { challengeId: id });
    }
    if (route === 'auth/verify-code') {
      if (typeof body.challengeId !== 'string' || !/^[a-f0-9-]{36}$/.test(body.challengeId) || typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) throw new RequestError(400, 'Enter the six-digit code');
      await consumeLimit(prisma, 'verify-ip', peer, 60, 3600000);
      // Increment independently of the later transaction so failed guesses persist.
      const attempts = await prisma.otpChallenge.updateMany({ where: { id: body.challengeId, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: 5 } }, data: { attempts: { increment: 1 } } });
      if (!attempts.count) throw new RequestError(400, 'Invalid or expired code');
      const challenge = await prisma.otpChallenge.findUnique({ where: { id: body.challengeId } });
      if (!same(hmac(`${challenge.id}:${body.code}`), challenge.codeHash)) throw new RequestError(400, 'Invalid or expired code');
      const token = randomBytes(32).toString('hex');
      const user = await prisma.$transaction(async tx => {
        const used = await tx.otpChallenge.updateMany({ where: { id: challenge.id, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
        if (!used.count) throw new RequestError(400, 'Invalid or expired code');
        const account = challenge.channel === 'phone'
          ? await tx.user.upsert({ where: { phone: challenge.destination }, update: {}, create: { phone: challenge.destination, phoneVerifiedAt: new Date(), profile: { create: { displayName: challenge.displayName } } }, include: { profile: true } })
          : await tx.user.upsert({ where: { email: challenge.destination }, update: {}, create: { email: challenge.destination, emailVerifiedAt: new Date(), profile: { create: { displayName: challenge.displayName } } }, include: { profile: true } });
        if (account.status !== 'ACTIVE') throw new RequestError(400, 'Invalid or expired code');
        await tx.user.update({ where: { id: account.id }, data: challenge.channel === 'phone' ? { phoneVerifiedAt: account.phoneVerifiedAt || new Date() } : { emailVerifiedAt: account.emailVerifiedAt || new Date() } });
        await tx.session.create({ data: { userId: account.id, tokenHash: digest(token), expiresAt: new Date(Date.now() + 604800000) } });
        await tx.auditLog.create({ data: { actorId: account.id, action: 'auth.login', targetType: 'User', targetId: account.id } });
        return account;
      });
      return send(response, 200, { user: publicUser(user), csrfToken: csrf(token) }, { 'set-cookie': cookie(token) });
    }
    throw new RequestError(404, 'Not found');
  }
  return { handle, session, protect, assertOrigin };
}
