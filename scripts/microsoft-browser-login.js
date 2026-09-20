/* global process, console, fetch, URL, URLSearchParams, AbortSignal, setTimeout, clearTimeout */
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const tenantId = process.env.MS_TENANT_ID;
const clientId = process.env.MS_CLIENT_ID;
const tokenFile = resolve(process.env.MS_TOKEN_FILE || './microsoft-mail-token.json');
if (!tenantId || !clientId) throw new Error('Set MS_TENANT_ID and MS_CLIENT_ID before running this setup on your Mac');

const baseUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0`;
const state = randomBytes(32).toString('base64url');
const verifier = randomBytes(32).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');
const server = createServer();

const callback = new Promise((resolveCallback, rejectCallback) => {
  const timeout = setTimeout(() => rejectCallback(new Error('Microsoft sign-in timed out; run the setup command again')), 10 * 60 * 1000);
  server.on('request', (request, response) => {
    const url = new URL(request.url || '/', 'http://localhost');
    if (url.pathname !== '/') {
      response.writeHead(404).end('Not found');
      return;
    }
    if (url.searchParams.get('state') !== state) {
      response.writeHead(400).end('Sign-in state did not match. Close this tab and retry the setup command.');
      return;
    }
    if (url.searchParams.has('error')) {
      response.writeHead(400).end('Microsoft sign-in was not completed. You can close this tab.');
      clearTimeout(timeout);
      rejectCallback(new Error(`Microsoft sign-in was not completed (${url.searchParams.get('error')})`));
      return;
    }
    const code = url.searchParams.get('code');
    if (!code) {
      response.writeHead(400).end('Microsoft did not return an authorization code.');
      clearTimeout(timeout);
      rejectCallback(new Error('Microsoft did not return an authorization code'));
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><title>Sign-in complete</title><p>Microsoft sign-in is complete. Return to the Terminal.</p>');
    clearTimeout(timeout);
    resolveCallback(code);
  });
});

server.listen(0, 'localhost');
await new Promise((resolveListen, rejectListen) => {
  server.once('listening', resolveListen);
  server.once('error', rejectListen);
});

try {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not start the local sign-in listener');
  const redirectUri = `http://localhost:${address.port}`;
  const authorizeUrl = new URL(`${baseUrl}/authorize`);
  authorizeUrl.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: 'offline_access https://graph.microsoft.com/Mail.Send',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  }).toString();

  console.log('On this Mac, open the following Microsoft sign-in link in Safari:');
  console.log(authorizeUrl.toString());
  console.log('Sign in as hello@madinatydeals.com and approve Mail.Send. Do not share the link or the token file.');

  const code = await callback;
  const tokenResponse = await fetch(`${baseUrl}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      scope: 'offline_access https://graph.microsoft.com/Mail.Send',
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!tokenResponse.ok) throw new Error(`Microsoft token exchange failed (${tokenResponse.status})`);
  const token = await tokenResponse.json();
  if (!token.refresh_token) throw new Error('Microsoft did not return a refresh token; check that offline_access is permitted');

  await mkdir(dirname(tokenFile), { recursive: true, mode: 0o700 });
  const temporaryFile = `${tokenFile}.${process.pid}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify({ refreshToken: token.refresh_token })}\n`, { mode: 0o600 });
  await rename(temporaryFile, tokenFile);
  console.log(`Sign-in complete. The refresh token was saved to ${tokenFile}. Keep that file private.`);
} finally {
  server.close();
}
