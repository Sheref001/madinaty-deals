/* global process, console, setTimeout, fetch, URLSearchParams, AbortSignal */
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const tenantId = process.env.MS_TENANT_ID;
const clientId = process.env.MS_CLIENT_ID;
const tokenFile = process.env.MS_TOKEN_FILE || '/app/data/mail-auth/token.json';
if (!tenantId || !clientId) throw new Error('Set MS_TENANT_ID and MS_CLIENT_ID in the server .env file first');

const baseUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0`;
const deviceResponse = await fetch(`${baseUrl}/devicecode`, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ client_id: clientId, scope: 'offline_access https://graph.microsoft.com/Mail.Send' }),
  signal: AbortSignal.timeout(15000),
});
if (!deviceResponse.ok) throw new Error(`Microsoft device authorization could not start (${deviceResponse.status})`);
const device = await deviceResponse.json();
if (!device.device_code || !device.user_code || !device.verification_uri) throw new Error('Microsoft device authorization response was incomplete');

console.log(`Open ${device.verification_uri} in a browser and enter this code: ${device.user_code}`);
console.log('Sign in as hello@madinatydeals.com and approve the Mail.Send request. Do not share the code.');

let delay = Math.max(Number(device.interval) || 5, 5) * 1000;
const expiresAt = Date.now() + Number(device.expires_in || 900) * 1000;
let refreshToken;
while (Date.now() < expiresAt) {
  await new Promise(resolve => setTimeout(resolve, delay));
  const response = await fetch(`${baseUrl}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      client_id: clientId,
      device_code: device.device_code,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (response.ok) {
    if (!result.refresh_token) throw new Error('Microsoft did not return a refresh token; ensure offline_access is enabled');
    refreshToken = result.refresh_token;
    break;
  }
  if (result.error === 'authorization_pending') continue;
  if (result.error === 'slow_down') { delay += 5000; continue; }
  if (result.error === 'authorization_declined') throw new Error('Microsoft sign-in was declined');
  if (result.error === 'expired_token') break;
  throw new Error(`Microsoft device authorization failed (${response.status}: ${result.error || 'unknown error'})`);
}
if (!refreshToken) throw new Error('Microsoft device code expired; run the setup command again');

await mkdir(dirname(tokenFile), { recursive: true, mode: 0o700 });
const temporaryFile = `${tokenFile}.${process.pid}.tmp`;
await writeFile(temporaryFile, `${JSON.stringify({ refreshToken })}\n`, { mode: 0o600 });
await rename(temporaryFile, tokenFile);
console.log('Microsoft delegated mail authorization saved securely in the Docker mail-auth volume.');
