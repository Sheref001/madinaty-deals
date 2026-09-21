import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createAuth, normalizePhone } from './auth.js';
import { loadConfig } from './config.js';

const config = { local: false, origin: 'https://madinatydeals.com', cookieName: '__Host-madinaty_session', secret: 'test-secret-longer-than-thirty-two-characters', from: 'noreply@example.test', registrationEnabled: true };
const account = { id: 'user-1', email: 'test@example.test', emailVerifiedAt: new Date(), role: 'RESIDENT', status: 'ACTIVE', profile: { displayName: 'Neighbour' } };
const request = (body, headers = {}) => Object.assign(Readable.from([JSON.stringify(body)]), { method: 'POST', headers: { origin: config.origin, ...headers }, socket: { remoteAddress: '127.0.0.1' } });
function fixture(overrides = {}) {
  let challenge;
  const prisma = {
    $queryRaw: vi.fn().mockResolvedValue([{ count: 1 }]),
    otpChallenge: {
      create: vi.fn(async ({ data }) => { challenge = { ...data, attempts: 0, consumedAt: null }; return challenge; }),
      findUnique: vi.fn(async () => challenge),
      delete: vi.fn(),
      updateMany: vi.fn(async ({ data }) => {
        if (!challenge || challenge.consumedAt || challenge.attempts >= 5 || challenge.expiresAt <= new Date()) return { count: 0 };
        if (data.attempts) challenge.attempts++;
        if (data.consumedAt) challenge.consumedAt = data.consumedAt;
        return { count: 1 };
      }),
    },
    user: { findUnique: vi.fn().mockResolvedValue(account), upsert: vi.fn().mockResolvedValue(account), update: vi.fn().mockResolvedValue(account) },
    session: { create: vi.fn().mockResolvedValue({}), findUnique: vi.fn(), deleteMany: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  prisma.$transaction = async callback => callback(prisma);
  const mailer = { sendMail: vi.fn().mockResolvedValue({}) };
  const auth = createAuth({ prisma, config: { ...config, ...overrides }, mailer });
  const send = vi.fn();
  const call = (route, body, headers) => auth.handle(request(body, headers), {}, ['api', 'auth', route], send);
  const start = async () => {
    await call('request-code', { email: 'test@example.test', name: 'Neighbour' });
    return { challengeId: challenge.id, code: mailer.sendMail.mock.calls[0][0].text.match(/\b\d{6}\b/)[0] };
  };
  return { auth, prisma, mailer, send, call, start, challenge: () => challenge };
}

describe('authentication boundaries', () => {
  it('normalizes Egyptian and international phone numbers to E.164', () => {
    expect(normalizePhone('010 1234 5678')).toBe('+201012345678');
    expect(normalizePhone('+1 (202) 555-0123')).toBe('+12025550123');
    expect(() => normalizePhone('12345')).toThrow('valid phone number');
  });
  it('fails closed when production configuration is incomplete or uses HTTP', () => {
    expect(() => loadConfig({})).toThrow('HTTPS');
    expect(() => loadConfig({ APP_ORIGIN: config.origin })).toThrow('AUTH_SECRET');
  });
  it('accepts delegated Microsoft Graph configuration without SMTP or app-secret credentials', () => {
    const loaded = loadConfig({
      APP_ENV: 'production', APP_ORIGIN: config.origin, AUTH_SECRET: 'a'.repeat(48),
      MAIL_PROVIDER: 'microsoft-graph-delegated', SMTP_FROM: 'hello@madinatydeals.com',
      MS_TENANT_ID: 'tenant-id', MS_CLIENT_ID: 'client-id',
    });
    expect(loaded.mailProvider).toBe('microsoft-graph-delegated');
    expect(loaded.from).toBe('hello@madinatydeals.com');
    expect(() => loadConfig({
      APP_ENV: 'production', APP_ORIGIN: config.origin, AUTH_SECRET: 'a'.repeat(48),
      MAIL_PROVIDER: 'microsoft-graph-delegated', SMTP_FROM: 'hello@madinatydeals.com',
    })).toThrow('MS_TENANT_ID');
  });
  it('validates the Cognito issuer and same-origin callback before enabling Cognito', () => {
    const loaded = loadConfig({
      APP_ENV: 'production', APP_ORIGIN: config.origin, AUTH_SECRET: 'a'.repeat(48),
      MAIL_PROVIDER: 'microsoft-graph-delegated', SMTP_FROM: 'hello@madinatydeals.com',
      MS_TENANT_ID: 'tenant-id', MS_CLIENT_ID: 'client-id', COGNITO_ENABLED: 'true', REGISTRATION_ENABLED: 'true',
      COGNITO_ISSUER_URL: 'https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_example',
      COGNITO_CLIENT_ID: 'cognito-client-id', COGNITO_CALLBACK_URL: `${config.origin}/api/auth/cognito/callback`,
    });
    expect(loaded.cognitoEnabled).toBe(true);
    expect(loaded.cognito.clientId).toBe('cognito-client-id');
    expect(() => loadConfig({
      APP_ENV: 'production', APP_ORIGIN: config.origin, AUTH_SECRET: 'a'.repeat(48),
      MAIL_PROVIDER: 'microsoft-graph-delegated', SMTP_FROM: 'hello@madinatydeals.com',
      MS_TENANT_ID: 'tenant-id', MS_CLIENT_ID: 'client-id', COGNITO_ENABLED: 'true', REGISTRATION_ENABLED: 'true',
      COGNITO_ISSUER_URL: 'https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_example',
      COGNITO_CLIENT_ID: 'cognito-client-id', COGNITO_CALLBACK_URL: `${config.origin}/?lang=ar`,
    })).toThrow('COGNITO_CALLBACK_URL');
    expect(() => loadConfig({
      APP_ENV: 'production', APP_ORIGIN: config.origin, AUTH_SECRET: 'a'.repeat(48),
      MAIL_PROVIDER: 'microsoft-graph-delegated', SMTP_FROM: 'hello@madinatydeals.com',
      MS_TENANT_ID: 'tenant-id', MS_CLIENT_ID: 'client-id', COGNITO_ENABLED: 'true', REGISTRATION_ENABLED: 'false',
      COGNITO_ISSUER_URL: 'https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_example',
      COGNITO_CLIENT_ID: 'cognito-client-id', COGNITO_CALLBACK_URL: `${config.origin}/api/auth/cognito/callback`,
    })).toThrow('REGISTRATION_ENABLED=true');
  });
  it('rejects cross-origin login before sending email', async () => {
    const f = fixture();
    await expect(f.call('request-code', {}, { origin: 'https://other.example' })).rejects.toMatchObject({ status: 403 });
    expect(f.mailer.sendMail).not.toHaveBeenCalled();
  });
  it('blocks new registrations while allowing existing accounts to request a code', async () => {
    const f = fixture({ registrationEnabled: false });
    f.prisma.user.findUnique.mockResolvedValue(null);
    await expect(f.call('request-code', { email: 'new@example.test' })).rejects.toMatchObject({ status: 403, message: 'Account creation is temporarily paused. Please try again later.' });
    expect(f.mailer.sendMail).not.toHaveBeenCalled();
    expect(f.prisma.otpChallenge.create).not.toHaveBeenCalled();

    f.prisma.user.findUnique.mockResolvedValue(account);
    await f.call('request-code', { email: account.email });
    expect(f.mailer.sendMail).toHaveBeenCalledTimes(1);
  });
  it('hashes codes and sessions, consumes codes once, and issues a secure cookie', async () => {
    const f = fixture();
    const body = await f.start();
    expect(f.challenge().codeHash).not.toContain(body.code);
    await f.call('verify-code', body);
    const [, status, result, headers] = f.send.mock.calls.at(-1);
    expect(status).toBe(200);
    expect(result.user.email).toBe(account.email);
    expect(headers['set-cookie']).toContain('HttpOnly; SameSite=Lax; Max-Age=604800; Secure');
    expect(headers['set-cookie']).toMatch(/^__Host-madinaty_session=[a-f0-9]{64}; Path=\//);
    const token = headers['set-cookie'].split(';')[0].split('=')[1];
    expect(f.prisma.session.create.mock.calls[0][0].data.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    await expect(f.call('verify-code', body)).rejects.toMatchObject({ status: 400 });
    expect(f.prisma.session.create).toHaveBeenCalledTimes(1);
  });
  it('locks a challenge after five wrong guesses', async () => {
    const f = fixture(); const body = await f.start();
    for (let index = 0; index < 5; index++) await expect(f.call('verify-code', { ...body, code: body.code === '000000' ? '111111' : '000000' })).rejects.toMatchObject({ status: 400 });
    await expect(f.call('verify-code', body)).rejects.toMatchObject({ status: 400 });
    expect(f.prisma.session.create).not.toHaveBeenCalled();
  });
  it('rejects expired challenges', async () => {
    const f = fixture(); const body = await f.start(); f.challenge().expiresAt = new Date(0);
    await expect(f.call('verify-code', body)).rejects.toMatchObject({ status: 400 });
  });
  it('rejects missing, expired, suspended sessions and forged CSRF tokens', async () => {
    const f = fixture();
    await expect(f.auth.protect(request({}))).rejects.toMatchObject({ status: 401 });
    const cookie = `${config.cookieName}=${'a'.repeat(64)}`;
    f.prisma.session.findUnique.mockResolvedValue({ user: account, expiresAt: new Date(0) });
    await expect(f.auth.protect(request({}, { cookie }))).rejects.toMatchObject({ status: 401 });
    f.prisma.session.findUnique.mockResolvedValue({ user: { ...account, status: 'SUSPENDED' }, expiresAt: new Date(Date.now() + 10000) });
    await expect(f.auth.protect(request({}, { cookie }))).rejects.toMatchObject({ status: 401 });
    f.prisma.session.findUnique.mockResolvedValue({ user: account, expiresAt: new Date(Date.now() + 10000) });
    await expect(f.auth.protect(request({}, { cookie, 'x-csrf-token': 'forged' }))).rejects.toMatchObject({ status: 403 });
  });
});
