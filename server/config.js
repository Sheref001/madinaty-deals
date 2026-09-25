/* global process, URL */
export function loadConfig(env = process.env) {
  const local = env.APP_ENV === 'local';
  const origin = new URL(env.APP_ORIGIN || 'http://localhost:3000');
  if (!local && origin.protocol !== 'https:') throw new Error('APP_ORIGIN must use HTTPS outside APP_ENV=local');
  if (origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) throw new Error('APP_ORIGIN must be an origin only');
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) throw new Error('AUTH_SECRET must contain at least 32 characters');
  const mailProvider = env.MAIL_PROVIDER || 'smtp';
  const registrationEnabled = env.REGISTRATION_ENABLED !== 'false';
  const cognitoEnabled = env.COGNITO_ENABLED === 'true';
  const cognitoIssuerUrl = env.COGNITO_ISSUER_URL || '';
  const cognitoClientId = env.COGNITO_CLIENT_ID || '';
  const cognitoCallbackUrl = env.COGNITO_CALLBACK_URL || '';
  const cognitoDomainUrl = env.COGNITO_DOMAIN_URL || '';
  const translationEnabled = env.TRANSLATION_ENABLED === 'true';
  const translationRegion = env.TRANSLATION_REGION || env.AWS_REGION || 'eu-north-1';
  const s3Photos = env.PHOTO_STORAGE === 's3';
  if (env.PHOTO_STORAGE && !['local', 's3'].includes(env.PHOTO_STORAGE)) throw new Error('PHOTO_STORAGE must be local or s3');
  if (s3Photos && !env.S3_PHOTO_BUCKET) throw new Error('S3_PHOTO_BUCKET is required when PHOTO_STORAGE=s3');
  if (cognitoEnabled) {
    for (const [key, value] of [['COGNITO_ISSUER_URL', cognitoIssuerUrl], ['COGNITO_CLIENT_ID', cognitoClientId], ['COGNITO_CALLBACK_URL', cognitoCallbackUrl]]) {
      if (!value) throw new Error(`${key} is required when COGNITO_ENABLED=true`);
    }
    const issuer = new URL(cognitoIssuerUrl);
    const callback = new URL(cognitoCallbackUrl);
    const domain = cognitoDomainUrl ? new URL(cognitoDomainUrl) : null;
    if (issuer.protocol !== 'https:' || issuer.search || issuer.hash || issuer.username || issuer.password) throw new Error('COGNITO_ISSUER_URL must be a valid HTTPS issuer URL');
    if (callback.origin !== origin.origin || callback.protocol !== 'https:' && !local || callback.pathname !== '/api/auth/cognito/callback' || callback.search || callback.hash) throw new Error('COGNITO_CALLBACK_URL must be the HTTPS callback route on APP_ORIGIN');
    if (domain && (domain.protocol !== 'https:' || domain.pathname !== '/' || domain.search || domain.hash || domain.username || domain.password)) throw new Error('COGNITO_DOMAIN_URL must be an HTTPS origin only');
  }
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
    mailProvider, registrationEnabled, cognitoEnabled,
    translation: { enabled: translationEnabled, region: translationRegion },
    trustedProxyPeers: new Set(String(env.TRUSTED_PROXY_PEERS || '').split(',').map(value => value.trim()).filter(Boolean)),
    cognito: {
      issuerUrl: cognitoIssuerUrl,
      clientId: cognitoClientId,
      clientSecret: env.COGNITO_CLIENT_SECRET || '',
      callbackUrl: cognitoCallbackUrl,
      domainUrl: cognitoDomainUrl,
    },
    smtp: { host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 587), secure: env.SMTP_PORT === '465', requireTLS: !local, auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined, connectionTimeout: 10000, socketTimeout: 15000 },
    graph: { tenantId: env.MS_TENANT_ID, clientId: env.MS_CLIENT_ID, tokenFile: env.MS_TOKEN_FILE || '/app/data/mail-auth/token.json' },
    from,
    uploadDirectory: env.UPLOAD_DIRECTORY || '/app/data/uploads',
    photos: { s3: s3Photos, bucket: env.S3_PHOTO_BUCKET || '', region: env.S3_PHOTO_REGION || env.AWS_REGION || 'eu-north-1' },
  };
}
