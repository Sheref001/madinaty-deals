/* global console, URL */
import { Buffer } from 'node:buffer';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import * as oidc from 'openid-client';
import { RequestError } from './request.js';

const digestKey = secret => createHash('sha256').update('madinaty-deals:cognito-state:').update(secret).digest();

function createStateCookie(config, value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', digestKey(config.secret), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const sealed = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
  const name = config.local ? 'madinaty_oauth' : '__Host-madinaty_oauth';
  return `${name}=${sealed}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${config.local ? '' : '; Secure'}`;
}

function clearStateCookie(config) {
  const name = config.local ? 'madinaty_oauth' : '__Host-madinaty_oauth';
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${config.local ? '' : '; Secure'}`;
}

function readStateCookie(config, header = '') {
  const name = config.local ? 'madinaty_oauth' : '__Host-madinaty_oauth';
  const value = String(header).split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
  if (!value || value.length > 2000) return null;
  try {
    const sealed = Buffer.from(value, 'base64url');
    if (sealed.length < 29) return null;
    const decipher = createDecipheriv('aes-256-gcm', digestKey(config.secret), sealed.subarray(0, 12));
    decipher.setAuthTag(sealed.subarray(12, 28));
    const payload = JSON.parse(Buffer.concat([decipher.update(sealed.subarray(28)), decipher.final()]).toString('utf8'));
    if (!payload || typeof payload !== 'object' || payload.expiresAt <= Date.now() || typeof payload.state !== 'string' || typeof payload.nonce !== 'string' || typeof payload.verifier !== 'string' || !['ar', 'en'].includes(payload.language)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createCognitoAuth({ prisma, auth, config, oidcClient = oidc, logger = console }) {
  let clientConfiguration;
  const getClientConfiguration = () => {
    if (!clientConfiguration) {
      clientConfiguration = oidcClient.discovery(
        new URL(config.cognito.issuerUrl),
        config.cognito.clientId,
        config.cognito.clientSecret || undefined,
      ).catch(error => {
        clientConfiguration = undefined;
        throw error;
      });
    }
    return clientConfiguration;
  };

  const callbackError = (response, language, reason = 'signin_failed') => {
    // Log only our fixed reason codes, never provider descriptions, claims or cookies.
    logger.warn('Cognito sign-in rejected', reason);
    const path = language === 'ar' ? '/?lang=ar' : '/';
    response.writeHead(302, { location: `${config.origin}${path}${path.includes('?') ? '&' : '?'}auth_error=${reason}`, 'cache-control': 'no-store', 'set-cookie': clearStateCookie(config), 'referrer-policy': 'no-referrer' });
    response.end();
  };

  async function start(request, response) {
    if (!config.cognitoEnabled || !config.registrationEnabled) throw new RequestError(404, 'Not found');
    const language = new URL(request.url, config.origin).searchParams.get('lang') === 'ar' ? 'ar' : 'en';
    const state = oidcClient.randomState();
    const nonce = oidcClient.randomNonce();
    const verifier = oidcClient.randomPKCECodeVerifier();
    const challenge = await oidcClient.calculatePKCECodeChallenge(verifier);
    const authorizationUrl = oidcClient.buildAuthorizationUrl(await getClientConfiguration(), {
      redirect_uri: config.cognito.callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    const stateCookie = createStateCookie(config, { state, nonce, verifier, language, expiresAt: Date.now() + 600000 });
    response.writeHead(302, { location: authorizationUrl.href, 'cache-control': 'no-store', 'set-cookie': stateCookie, 'referrer-policy': 'no-referrer' });
    response.end();
  }

  async function callback(request, response) {
    const stored = readStateCookie(config, request.headers.cookie);
    const language = stored?.language || 'en';
    if (!stored) return callbackError(response, language, 'signin_state_invalid');
    if (new URL(request.url, config.origin).searchParams.has('error')) return callbackError(response, language, 'provider_rejected');

    try {
      const tokens = await oidcClient.authorizationCodeGrant(await getClientConfiguration(), new URL(request.url, config.origin), {
        expectedState: stored.state,
        expectedNonce: stored.nonce,
        pkceCodeVerifier: stored.verifier,
      });
      const claims = tokens.claims();
      const email = typeof claims?.email === 'string' ? claims.email.trim().toLowerCase() : '';
      if (!claims?.sub || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return callbackError(response, language, 'invalid_identity');
      if (claims.email_verified !== true) return callbackError(response, language, 'email_not_verified');

      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (!existing && !config.registrationEnabled) return callbackError(response, language, 'registration_paused');

      const profileName = typeof claims.name === 'string' ? claims.name.trim().slice(0, 80) : '';
      const displayName = profileName.length >= 2 ? profileName : email.split('@')[0].slice(0, 80);
      let sessionCookie;
      await prisma.$transaction(async tx => {
        const user = await tx.user.upsert({
          where: { email },
          update: {},
          create: { email, emailVerifiedAt: new Date(), profile: { create: { displayName } } },
          include: { profile: true },
        });
        if (user.status !== 'ACTIVE') throw new RequestError(403, 'Account is unavailable');
        if (!user.emailVerifiedAt) await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
        if (!user.profile) await tx.profile.create({ data: { userId: user.id, displayName } });
        sessionCookie = await auth.createLoginSession(tx, user.id);
      });

      const path = language === 'ar' ? '/?lang=ar' : '/';
      response.writeHead(302, { location: `${config.origin}${path}`, 'cache-control': 'no-store', 'set-cookie': [sessionCookie, clearStateCookie(config)], 'referrer-policy': 'no-referrer' });
      response.end();
    } catch (error) {
      if (error instanceof RequestError && error.message === 'Account is unavailable') return callbackError(response, language, 'account_unavailable');
      logger.error('Cognito sign-in failed', error?.code || error?.name || 'unknown');
      return callbackError(response, language);
    }
  }

  async function logout(request, response, send) {
    const metadata = (await getClientConfiguration()).serverMetadata();
    if (typeof metadata.authorization_endpoint !== 'string') throw new RequestError(503, 'Sign-out is temporarily unavailable');
    const logoutUrl = new URL('/logout', metadata.authorization_endpoint);
    logoutUrl.searchParams.set('client_id', config.cognito.clientId);
    logoutUrl.searchParams.set('logout_uri', `${config.origin}/`);
    return auth.logout(request, response, send, { logoutUrl: logoutUrl.href }, { 'set-cookie': [clearStateCookie(config)] });
  }

  async function handle(request, response, parts, send) {
    if (!config.cognitoEnabled || !config.registrationEnabled) throw new RequestError(404, 'Not found');
    const route = parts.slice(1).join('/');
    if (route === 'auth/cognito/start' && request.method === 'GET') return start(request, response);
    if (route === 'auth/cognito/callback' && request.method === 'GET') return callback(request, response);
    if (route === 'auth/cognito/logout' && request.method === 'POST') return logout(request, response, send);
    throw new RequestError(404, 'Not found');
  }

  return { handle };
}
