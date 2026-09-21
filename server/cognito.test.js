/* global URL */
import { describe, expect, it, vi } from 'vitest';
import { createCognitoAuth } from './cognito.js';

const config = {
  origin: 'https://madinatydeals.com', local: false, secret: 'test-secret-longer-than-thirty-two-characters',
  registrationEnabled: true, cognitoEnabled: true,
  cognito: {
    issuerUrl: 'https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_example',
    clientId: 'client-id', clientSecret: '', callbackUrl: 'https://madinatydeals.com/api/auth/cognito/callback',
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
function setup({ registrationEnabled = true, existingUser = null } = {}) {
  const oidc = oidcClient();
  const createdUser = { id: 'user-1', email: 'new@example.com', emailVerifiedAt: new Date(), status: 'ACTIVE', profile: { displayName: 'New Neighbour' } };
  const tx = {
    user: { upsert: vi.fn().mockResolvedValue(createdUser), update: vi.fn().mockResolvedValue(createdUser) },
    profile: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(existingUser) },
    $transaction: vi.fn(async callback => callback(tx)),
  };
  const auth = {
    createLoginSession: vi.fn().mockResolvedValue('__Host-madinaty_session=token; Path=/; HttpOnly; Secure'),
    logout: vi.fn().mockResolvedValue({}),
  };
  const cognito = createCognitoAuth({ prisma, auth, config: { ...config, registrationEnabled }, oidcClient: oidc });
  return { cognito, oidc, prisma, auth, tx };
}

describe('Cognito sign-in', () => {
  it('starts authorization with PKCE, nonce, state and encrypted short-lived state cookie', async () => {
    const f = setup();
    const res = response();
    await f.cognito.handle({ method: 'GET', url: '/api/auth/cognito/start?lang=ar', headers: {} }, res, ['api', 'auth', 'cognito', 'start']);
    expect(f.oidc.discovery).toHaveBeenCalledWith(new URL(config.cognito.issuerUrl), config.cognito.clientId, undefined);
    expect(f.oidc.buildAuthorizationUrl.mock.calls[0][1]).toMatchObject({
      redirect_uri: config.cognito.callbackUrl, response_type: 'code', scope: 'openid email profile',
      state: 'secure-state', nonce: 'secure-nonce', code_challenge: 'pkce-challenge', code_challenge_method: 'S256',
    });
    expect(res.writeHead.mock.calls[0][1].location).toContain('example.auth');
    const cookie = res.writeHead.mock.calls[0][1]['set-cookie'];
    expect(cookie).toMatch(/^__Host-madinaty_oauth=[A-Za-z0-9_-]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=600; Secure$/);
    expect(cookie).not.toContain('pkce-verifier');
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
    await f.cognito.handle({ method: 'GET', url: '/api/auth/cognito/callback?code=x&state=secure-state', headers: { cookie: `${name}=${value.slice(0, -1)}x` } }, callbackResponse, ['api', 'auth', 'cognito', 'callback']);
    expect(f.oidc.authorizationCodeGrant).not.toHaveBeenCalled();
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
    expect(callbackResponse.writeHead.mock.calls[0][1].location).toContain('auth_error=signin_failed');
  });

  it('keeps the Cognito flow unavailable while registrations are disabled', async () => {
    const f = setup({ registrationEnabled: false });
    const startResponse = response();
    await expect(f.cognito.handle({ method: 'GET', url: '/api/auth/cognito/start', headers: {} }, startResponse, ['api', 'auth', 'cognito', 'start'])).rejects.toMatchObject({ status: 404 });
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
    expect(f.oidc.discovery).not.toHaveBeenCalled();
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
});
