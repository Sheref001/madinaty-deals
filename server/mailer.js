/* global AbortSignal, URLSearchParams, process */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import nodemailer from 'nodemailer';

const GRAPH_SCOPE = 'offline_access https://graph.microsoft.com/Mail.Send';

async function storeRefreshToken(tokenFile, refreshToken) {
  await mkdir(dirname(tokenFile), { recursive: true, mode: 0o700 });
  const temporaryFile = `${tokenFile}.${process.pid}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify({ refreshToken })}\n`, { mode: 0o600 });
  await rename(temporaryFile, tokenFile);
}

export function createMailer(config, fetchImpl = globalThis.fetch, tokenStore = {
  read: async () => {
    try {
      return JSON.parse(await readFile(config.graph.tokenFile, 'utf8')).refreshToken;
    } catch (error) {
      if (error.code === 'ENOENT') throw new Error('Microsoft delegated mail is not authorized; complete the browser-login setup in DEPLOYMENT.md', { cause: error });
      throw new Error('Microsoft delegated mail token file is invalid', { cause: error });
    }
  },
  write: token => storeRefreshToken(config.graph.tokenFile, token),
}) {
  if (config.mailProvider !== 'microsoft-graph-delegated') return nodemailer.createTransport(config.smtp);

  let accessToken;
  let tokenExpiresAt = 0;
  let pendingToken;
  const getAccessToken = async () => {
    if (accessToken && Date.now() < tokenExpiresAt - 60000) return accessToken;
    if (pendingToken) return pendingToken;
    pendingToken = (async () => {
      const savedToken = await tokenStore.read();
      if (!savedToken) throw new Error('Microsoft delegated mail token file is invalid');
      const response = await fetchImpl(`https://login.microsoftonline.com/${encodeURIComponent(config.graph.tenantId)}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.graph.clientId,
          refresh_token: savedToken,
          scope: GRAPH_SCOPE,
          grant_type: 'refresh_token',
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`Microsoft token request failed (${response.status})`);
      const token = await response.json();
      if (!token.access_token || !Number.isFinite(Number(token.expires_in))) throw new Error('Microsoft token response was incomplete');
      if (token.refresh_token) await tokenStore.write(token.refresh_token);
      accessToken = token.access_token;
      tokenExpiresAt = Date.now() + Number(token.expires_in) * 1000;
      return accessToken;
    })().finally(() => { pendingToken = undefined; });
    return pendingToken;
  };

  return {
    async sendMail({ to, subject, text }) {
      const token = await getAccessToken();
      const response = await fetchImpl('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: 'Text', content: text },
            toRecipients: [{ emailAddress: { address: to } }],
          },
          saveToSentItems: false,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`Microsoft Graph sendMail failed (${response.status})`);
      return { accepted: [to], provider: 'microsoft-graph-delegated' };
    },
  };
}
