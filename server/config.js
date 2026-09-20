/* global process, URL */
export function loadConfig(env = process.env) {
  const local = env.APP_ENV === 'local';
  const origin = new URL(env.APP_ORIGIN || 'http://localhost:3000');
  if (!local && origin.protocol !== 'https:') throw new Error('APP_ORIGIN must use HTTPS outside APP_ENV=local');
  if (origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) throw new Error('APP_ORIGIN must be an origin only');
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) throw new Error('AUTH_SECRET must contain at least 32 characters');
  const mailProvider = env.MAIL_PROVIDER || 'smtp';
  const registrationEnabled = env.REGISTRATION_ENABLED !== 'false';
  const from = env.SMTP_FROM || 'hello@madinatydeals.com';
  if (mailProvider === 'smtp') {
    for (const key of ['SMTP_HOST', 'SMTP_FROM']) {
      if (!env[key]) throw new Error(`${key} is required when MAIL_PROVIDER=smtp`);
    }
  } else if (mailProvider === 'microsoft-graph-delegated') {
    for (const key of ['MS_TENANT_ID', 'MS_CLIENT_ID']) {
      if (!env[key]) throw new Error(`${key} is required when MAIL_PROVIDER=microsoft-graph-delegated`);
    }
    if (!env.SMTP_FROM) throw new Error('SMTP_FROM is required when MAIL_PROVIDER=microsoft-graph-delegated');
  } else {
    throw new Error('MAIL_PROVIDER must be smtp or microsoft-graph-delegated');
  }
  return {
    local, origin: origin.origin, secret: env.AUTH_SECRET,
    cookieName: local ? 'madinaty_session' : '__Host-madinaty_session',
    mailProvider, registrationEnabled,
    smtp: { host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 587), secure: env.SMTP_PORT === '465', requireTLS: !local, auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined, connectionTimeout: 10000, socketTimeout: 15000 },
    graph: { tenantId: env.MS_TENANT_ID, clientId: env.MS_CLIENT_ID, tokenFile: env.MS_TOKEN_FILE || '/app/data/mail-auth/token.json' },
    from,
    uploadDirectory: env.UPLOAD_DIRECTORY || '/app/data/uploads',
  };
}
