/* global URL */
import { describe, expect, it, vi } from 'vitest';
import { createCognitoAuth } from './cognito.js';
import { createAuth } from './auth.js';

const config = {
  origin: 'https://madinatydeals.com', local: false, secret: 'test-secret-longer-than-thirty-two-characters', cookieName: '__Host-madinaty_session',
  registrationEnabled: true, cognitoEnabled: true,
  cognito: {
    issuerUrl: 'https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_example',
    clientId: 'client-id', clientSecret: '', callbackUrl: 'https://madinatydeals.com/api/auth/cognito/callback', domainUrl: '',
  },
};
const response = () => ({ writeHead: vi.fn(), end: vi.fn() });
const oidcClient = () => ({
  discovery: vi.fn().mockResolvedValue({ issuer: 'cognito', serverMetadata: () => ({ authorization_endpoint: 'https://eu-north-1rxbhvvk07.auth.eu-north-1.amazoncognito.com/oauth2/authorize' }) }),
  randomState: vi.fn().mockReturnValue('secure-state'),
  randomNonce: vi.fn().mockReturnValue('secure-nonce'),
  randomPKCECodeVerifier: vi.fn().mockReturnValue('pkce-verifier'),
  calculatePKCECodeChallenge: vi.fn().mockResolvedValue('pkce-challenge'),
  buildAuthorizationUrl: vi.fn(() => new URL('https://example.auth.eu-north-1.amazoncognito.com/oauth2/authorize')),
  authorizationCodeGrant: vi.fn().mockResolvedValue({ claims: () => ({ sub: 'cognito-subject', email: 'new@example.com', email_verified: true, name: 'New Neighbour' }) }),
});
function setup({ registrationEnabled = true, existingUser = null, useRealAuth = false, domainUrl = '' } = {}) {
  const oidc = oidcClient();
  const createdUser = { id: 'user-1', email: 'new@example.com', emailVerifiedAt: new Date(), status: 'ACTIVE', profile: { displayName: 'New Neighbour' } };
  const tx = {
    user: { upsert: vi.fn().mockResolvedValue(createdUser), update: vi.fn().mockResolvedValue(createdUser) },
    profile: { create: vi.fn().mockResolvedValue({}) },
    session: { create: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(existingUser) },
    session: { findUnique: vi.fn(async ({ where }) => {
      const saved = tx.session.create.mock.calls.at(-1)?.[0].data;
      return saved?.tokenHash === where.tokenHash ? { ...saved, id: 'session-1', user: createdUser } : null;
    }) },
    $transaction: vi.fn(async callback => callback(tx)),
  };
  const auth = useRealAuth ? createAuth({ prisma, config }) : {
    createLoginSession: vi.fn().mockResolvedValue('__Host-madinaty_session=token; Path=/; HttpOnly; Secure'),
    logout: vi.fn().mockResolvedValue({}),
  };
  const logger = { warn: vi.fn(), error: vi.fn() };
  const cognito = createCognitoAuth({ prisma, auth, config: { ...config, registrationEnabled, cognito: { ...config.cognito, domainUrl } }, oidcClient: oidc, logger });
  return { cognito, oidc, prisma, auth, tx, logger, createdUser };
}

async function completeSignIn(f, query = 'code=one-time-code&state=secure-state') {
  const started = response();
  await f.cognito.handle({ method: 'GET', url: '/api/auth/cognito/start?lang=ar', headers: {} }, started, ['api', 'auth', 'cognito', 'start']);
  const cookie = started.writeHead.mock.calls[0][1]['set-cookie'].split(';')[0];
  const completed = response();
  await f.cognito.handle({ method: 'GET', url: `/api/auth/cognito/callback?${query}`, headers: { cookie } }, completed, ['api', 'auth', 'cognito', 'callback']);
  return completed.writeHead.mock.calls[0][1];
}

describe('Cognito sign-in', () => {
  it('starts authorization with PKCE, nonce, state and encrypted short-lived state cookie', async () => {
    const f = setup();
    const res = response();
    await f.cognito.handle({ method: 'GET', url: '/api/auth/cognito/start?lang=ar', headers: {} }, res, ['api', 'auth', 'cognito', 'start']);
    expect(f.oidc.discovery).toHaveBeenCalledWith(new URL(config.cognito.issuerUrl), config.cognito.clientId, undefined);
    expect(f.oidc.buildAuthorizationUrl.mock.calls[0][1]).toMatchObject({
      redirect_uri: config.cognito.callbackUrl, response_type: 'code', scope: 'openid email profile',
      state: 'secure-state', nonce: 'secure-nonce', code_challenge: 'pkce-challenge', code_challenge_method: 'S256', lang: 'ar',
    });
    expect(res.writeHead.mock.calls[0][1].location).toContain('example.auth');
    const cookie = res.writeHead.mock.calls[0][1]['set-cookie'];
    expect(cookie).toMatch(/^__Host-madinaty_oauth=[A-Za-z0-9_-]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=600; Secure$/);
    expect(cookie).not.toContain('pkce-verifier');
  });

  it('routes the branded Google button directly through the configured Google provider', async () => {
    const f = setup();
    const res = response();
    await f.cognito.handle({ method: 'GET', url: '/api/auth/cognito/start?lang=en&provider=google', headers: {} }, res, ['api', 'auth', 'cognito', 'start']);
    expect(f.oidc.buildAuthorizationUrl.mock.calls[0][1]).toMatchObject({ identity_provider: 'Google', lang: 'en' });
  });

  it('uses the branded Cognito domain for authorization when configured', async () => {
    const f = setup({ domainUrl: 'https://auth.madinatydeals.com' });
    const res = response();
    await f.cognito.handle({ method: 'GET', url: '/api/auth/cognito/start?provider=google', headers: {} }, res, ['api', 'auth', 'cognito', 'start']);
    expect(new URL(res.writeHead.mock.calls[0][1].location).origin).toBe('https://auth.madinatydeals.com');
  });

  it('opens Cognito signup directly and refuses signup while registration is paused', async () => {
    const f = setup();
    const res = response();
    await f.cognito.handle({ method: 'GET', url: '/api/auth/cognito/start?mode=signup', headers: {} }, res, ['api', 'auth', 'cognito', 'start']);
    expect(new URL(res.writeHead.mock.calls[0][1].location).pathname).toBe('/signup');
    const paused = setup({ registrationEnabled: false });
    await expect(paused.cognito.handle({ method: 'GET', url: '/api/auth/cognito/start?mode=signup', headers: {} }, response(), ['api', 'auth', 'cognito', 'start'])).rejects.toMatchObject({ status: 403 });
  });

  it('creates only a normal resident account after a verified Cognito email and issues a local session', async () => {
    const f = setup();
    const startResponse = response();
    await f.cognito.handle({ method: 'GET', url: '/api/auth/cognito/start?lang=ar', headers: {} }, startResponse, ['api', 'auth', 'cognito', 'start']);
    const cookie = startResponse.writeHead.mock.calls[0][1]['set-cookie'].split(';')[0];
    const callbackResponse = response();
    await f.cognito.handle({ method: 'GET', url: '/api/auth/cognito/callback?code=one-time-code&state=secure-state', headers: { cookie } }, callbackResponse, ['api', 'auth', 'cognito', 'callback']);
    expect(f.oidc.authorizationCodeGrant.mock.calls[0][2]).toMatchObject({ expectedState: 'secure-state', expectedNonce: 'secure-nonce', pkceCodeVerifier: 'pkce-verifier' });
    expect(f.tx.user.upsert.mock.calls[0][0]).toMatchObject({
      where: { email: 'new@example.com' }, update: {},
      create: { email: 'new@example.com', profile: { create: { displayName: 'New Neighbour' } } },
    });
    expect(callbackResponse.writeHead.mock.calls[0][1].location).toBe('https://madinatydeals.com/?lang=ar');
    expect(callbackResponse.writeHead.mock.calls[0][1]['set-cookie']).toHaveLength(2);
    expect(f.auth.createLoginSession).toHaveBeenCalledWith(f.tx, 'user-1');
  });

  it('rejects tampered state without contacting Cognito token endpoint', async () => {
    const f = setup();
    const startResponse = response();
    await f.cognito.handle({ method: 'GET', url: '/api/auth/cognito/start', headers: {} }, startResponse, ['api', 'auth', 'cognito', 'start']);
    const [name, value] = startResponse.writeHead.mock.calls[0][1]['set-cookie'].split(';')[0].split('=');
    const callbackResponse = response();
    const tampered = `${value[0] === 'A' ? 'B' : 'A'}${value.slice(1)}`;
    await f.cognito.handle({ method: 'GET', url: '/api/auth/cognito/callback?code=x&state=secure-state', headers: { cookie: `${name}=${tampered}` } }, callbackResponse, ['api', 'auth', 'cognito', 'callback']);
    expect(f.oidc.authorizationCodeGrant).not.toHaveBeenCalled();
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
    expect(callbackResponse.writeHead.mock.calls[0][1].location).toContain('auth_error=signin_state_invalid');
    expect(f.logger.warn).toHaveBeenCalledWith('Cognito sign-in rejected', 'signin_state_invalid');
  });

  it.each([undefined, false, 'true'])('rejects an unverified or missing email flag (%s) before creating a session and logs only the reason', async verified => {
    const f = setup();
    f.oidc.authorizationCodeGrant.mockResolvedValue({ claims: () => ({ sub: 'google-user', email: 'private@example.com', email_verified: verified }) });
    const headers = await completeSignIn(f);
    expect(headers.location).toBe(`${config.origin}/?lang=ar&auth_error=email_not_verified`);
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
    expect(f.auth.createLoginSession).not.toHaveBeenCalled();
    expect(f.logger.warn.mock.calls).toEqual([['Cognito sign-in rejected', 'email_not_verified']]);
    expect(headers['set-cookie']).not.toContain('madinaty_session=');
  });

  it('returns a readable local session from the real session code after verified Google claims', async () => {
    const f = setup({ useRealAuth: true });
    const headers = await completeSignIn(f);
    const sessionCookie = headers['set-cookie'][0];
    expect(sessionCookie).toMatch(/^__Host-madinaty_session=[a-f0-9]{64}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=604800; Secure$/);
    const rawToken = sessionCookie.split(';')[0].split('=')[1];
    expect(f.tx.session.create.mock.calls[0][0].data.tokenHash).not.toBe(rawToken);
    const send = vi.fn();
    await f.auth.handle({ method: 'GET', headers: { cookie: sessionCookie.split(';')[0] } }, response(), ['api', 'auth', 'session'], send);
    expect(send.mock.calls[0][2]).toMatchObject({ user: { id: 'user-1', email: 'new@example.com' }, csrfToken: expect.any(String) });
    expect(f.tx.auditLog.create).toHaveBeenCalledWith({ data: { actorId: 'user-1', action: 'auth.login.cognito', targetType: 'User', targetId: 'user-1' } });
    expect(f.logger.warn).not.toHaveBeenCalled();
  });

  it('preserves an existing administrator role when signing in with the same verified email', async () => {
    const f = setup({ existingUser: { id: 'user-1' }, useRealAuth: true });
    f.createdUser.role = 'ADMIN';
    await completeSignIn(f);
    expect(f.tx.user.upsert.mock.calls[0][0].update).toEqual({});
    expect(f.tx.user.upsert.mock.calls[0][0].create).not.toHaveProperty('role');
    expect(f.createdUser.role).toBe('ADMIN');
  });

  it('logs provider rejection without exposing its error description or calling the token endpoint', async () => {
    const f = setup();
    const headers = await completeSignIn(f, 'error=access_denied&error_description=PRIVATE_PROVIDER_RESPONSE');
    expect(headers.location).toContain('auth_error=provider_rejected');
    expect(f.logger.warn.mock.calls).toEqual([['Cognito sign-in rejected', 'provider_rejected']]);
    expect(f.oidc.authorizationCodeGrant).not.toHaveBeenCalled();
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('reports missing OAuth state without creating a user', async () => {
    const f = setup();
    const res = response();
    await f.cognito.handle({ method: 'GET', url: '/api/auth/cognito/callback?code=x', headers: {} }, res, ['api', 'auth', 'cognito', 'callback']);
    expect(f.logger.warn).toHaveBeenCalledWith('Cognito sign-in rejected', 'signin_state_invalid');
    expect(f.oidc.authorizationCodeGrant).not.toHaveBeenCalled();
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('keeps existing Cognito sign-in available while registrations are disabled', async () => {
    const f = setup({ registrationEnabled: false });
    const startResponse = response();
    await f.cognito.handle({ method: 'GET', url: '/api/auth/cognito/start', headers: {} }, startResponse, ['api', 'auth', 'cognito', 'start']);
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
    expect(f.oidc.discovery).toHaveBeenCalled();
  });

  it('clears the local session and redirects through Cognito managed logout', async () => {
    const f = setup();
    const request = { method: 'POST', url: '/api/auth/cognito/logout', headers: {} };
    const res = response();
    const send = vi.fn();
    await f.cognito.handle(request, res, ['api', 'auth', 'cognito', 'logout'], send);
    const logoutUrl = new URL(f.auth.logout.mock.calls[0][3].logoutUrl);
    expect(logoutUrl.origin).toBe('https://eu-north-1rxbhvvk07.auth.eu-north-1.amazoncognito.com');
    expect(logoutUrl.pathname).toBe('/logout');
    expect(logoutUrl.searchParams.get('client_id')).toBe(config.cognito.clientId);
    expect(logoutUrl.searchParams.get('logout_uri')).toBe(`${config.origin}/`);
    expect(f.auth.logout.mock.calls[0][0]).toBe(request);
    expect(f.auth.logout.mock.calls[0][2]).toBe(send);
    expect(f.auth.logout.mock.calls[0][4]['set-cookie']).toHaveLength(1);
  });

  it('uses the branded Cognito domain for logout when configured', async () => {
    const f = setup({ domainUrl: 'https://auth.madinatydeals.com' });
    await f.cognito.handle({ method: 'POST', url: '/api/auth/cognito/logout', headers: {} }, response(), ['api', 'auth', 'cognito', 'logout'], vi.fn());
    expect(new URL(f.auth.logout.mock.calls[0][3].logoutUrl).origin).toBe('https://auth.madinatydeals.com');
  });
});
