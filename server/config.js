/* global process, URL */
export function loadConfig(env = process.env) {
  const local = env.APP_ENV === 'local';
  const origin = new URL(env.APP_ORIGIN || 'http://localhost:3000');
  if (!local && origin.protocol !== 'https:') throw new Error('APP_ORIGIN must use HTTPS outside APP_ENV=local');
  if (origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) throw new Error('APP_ORIGIN must be an origin only');
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) throw new Error('AUTH_SECRET must contain at least 32 characters');
  for (const key of ['SMTP_HOST', 'SMTP_FROM', 'OBJECT_STORAGE_BUCKET', 'AWS_REGION', 'CLAMAV_HOST']) {
    if (!env[key]) throw new Error(`${key} is required`);
  }
  if (!local && (!env.TURNSTILE_SECRET_KEY || !env.TURNSTILE_SITE_KEY)) throw new Error('Turnstile keys are required outside local testing');
  if (!local && env.OBJECT_STORAGE_ENDPOINT && !env.OBJECT_STORAGE_ENDPOINT.startsWith('https://')) throw new Error('Storage endpoint must use HTTPS');
  return {
    trustedProxyIps: (env.TRUSTED_PROXY_IPS || '').split(',').map(ip => ip.trim()).filter(Boolean),
    local, origin: origin.origin, secret: env.AUTH_SECRET,
    cookieName: local ? 'madinaty_session' : '__Host-madinaty_session',
    turnstileSecret: env.TURNSTILE_SECRET_KEY, turnstileSiteKey: env.TURNSTILE_SITE_KEY || '',
    smtp: { host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 587), secure: env.SMTP_PORT === '465', requireTLS: !local, auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined, connectionTimeout: 10000, socketTimeout: 15000 },
    from: env.SMTP_FROM,
    sms: { accountSid: env.TWILIO_ACCOUNT_SID || '', authToken: env.TWILIO_AUTH_TOKEN || '', from: env.TWILIO_FROM || '' },
    storage: { region: env.AWS_REGION, endpoint: env.OBJECT_STORAGE_ENDPOINT || undefined, forcePathStyle: Boolean(env.OBJECT_STORAGE_ENDPOINT) },
    bucket: env.OBJECT_STORAGE_BUCKET,
    clamav: { host: env.CLAMAV_HOST, port: Number(env.CLAMAV_PORT || 3310) },
  };
}
