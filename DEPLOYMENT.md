# Deployment

The Node application serves the built frontend and `/api` from one origin. It requires PostgreSQL, an email provider and a Docker-managed local upload volume. Use Node 22.13+ (22.x) or a supported Node 24+ release; the container uses Node 22.

## Isolated integration stack

The test override adds Mailpit for local email capture. It uses an explicitly local configuration; no real email is sent.

```bash
docker compose --env-file .env.test.example -p madinaty-validation \
  -f docker-compose.yml -f docker-compose.test.yml up -d --build --wait --wait-timeout 900
npm run test:integration
```

Open `http://localhost:43187` and the local email inbox at `http://localhost:48025`. The integration script exercises email login, code replay, sessions, CSRF, local uploads, verification review, rental quotas and logout. It is restricted to localhost URLs. Run it against a fresh test project: authentication throttles intentionally persist in PostgreSQL across restarts and repeated runs.

To inspect migrations and verify idempotent seeding:

```bash
docker compose --env-file .env.test.example -p madinaty-validation -f docker-compose.yml -f docker-compose.test.yml exec app npm run db:migrate
docker compose --env-file .env.test.example -p madinaty-validation -f docker-compose.yml -f docker-compose.test.yml exec app npm run db:seed
```

Stop the stack with the same Compose arguments followed by `down`. Add `-v` only when intentionally deleting this disposable test database and upload volume.

## Production configuration

Copy `.env.example` to a private `.env` and supply these values:

Run this on the Linux server from the cloned repository directory. Do not commit the resulting `.env` file:

```bash
cp .env.example .env
openssl rand -hex 32  # use this for AUTH_SECRET
openssl rand -hex 32  # use a different value for POSTGRES_PASSWORD
docker compose --env-file .env config >/dev/null
docker compose --env-file .env up -d --build --wait
```

Paste the two generated values into `AUTH_SECRET` and `POSTGRES_PASSWORD`. The `config` command is a safe preflight check: it resolves Compose variables without starting containers. It will identify any remaining missing setting before deployment.

- `APP_ORIGIN`: exact HTTPS origin. Use a TLS reverse proxy; the container port binds to loopback on the host. Set `TRUSTED_PROXY_PEERS` to the exact socket peer address(es) of proxies that overwrite `X-Forwarded-For` (usually `127.0.0.1` for the local Nginx setup). Enforce HTTP-to-HTTPS and `www`-to-apex redirects at Cloudflare or Nginx; do not add an origin-level redirect when Cloudflare uses an HTTP origin connection.
- `AUTH_SECRET`: at least 32 random characters. Generate with `openssl rand -hex 32`. Store it securely; changing it invalidates outstanding codes and CSRF tokens.
- `POSTGRES_PASSWORD`: a long URL-safe random password; Compose interpolates it into the database URL. `DATABASE_URL` is needed for non-Compose commands.
- `REGISTRATION_ENABLED=false` pauses new account creation while allowing existing Cognito accounts to sign in. The server rejects legacy OTP requests for unknown email addresses while paused. Set it to `true` after OTP/SES delivery is restored to reopen public registration.
- Cognito sign-up is integrated as a server-side OpenID Connect authorization-code flow with PKCE. In the Cognito user pool, enable self-service sign-up and verified email, configure the app client for the authorization-code grant and `openid`, `email`, and `profile` scopes, and set its callback URL to exactly `https://madinatydeals.com/api/auth/cognito/callback`; set the sign-out URL to `https://madinatydeals.com/`. The user pool also needs a managed-login domain. The app client ID is public; if that app client has a client secret, put it only in the server `.env` as `COGNITO_CLIENT_SECRET` (leave it blank when no client secret was created). Do not use the homepage with `?lang=ar` as the callback. Set `COGNITO_ISSUER_URL=https://cognito-idp.<region>.amazonaws.com/<user-pool-id>`, `COGNITO_CLIENT_ID`, and `COGNITO_CALLBACK_URL=https://madinatydeals.com/api/auth/cognito/callback`. `COGNITO_ENABLED=true` enables Cognito sign-in; `REGISTRATION_ENABLED=true` additionally opens public account creation, while setting it to `false` keeps existing Cognito sign-in available and pauses new registrations. With Cognito enabled, the old email-code endpoints are disabled so they cannot bypass Cognito. Cognito identities are linked to local accounts only by verified email; existing roles (including ADMIN) are preserved, and new accounts receive the normal RESIDENT role. The app signs users out of its local session and Cognito managed login. This integration requires a verified email claim; phone-only Cognito identities are not supported by this flow.
- After Cognito's custom domain and DNS record are active, set `COGNITO_DOMAIN_URL=https://auth.madinatydeals.com`. The app will use that domain for authorization, signup and logout while retaining the regional issuer for token verification. Leave this variable empty until AWS reports the custom domain as active.
- For transactional email via Amazon SES, set `MAIL_PROVIDER=smtp`, `SMTP_HOST=email-smtp.<region>.amazonaws.com`, `SMTP_PORT=587`, `SMTP_USER` and `SMTP_PASSWORD` to SES SMTP credentials for that same region, and `SMTP_FROM=hello@madinatydeals.com`. The existing generic SMTP transport supports SES; no application code change is needed. Use the SES SMTP credentials, not your AWS console password or ordinary AWS access keys. Production SMTP requires TLS; port 465 uses implicit TLS.
- Before switching production OTPs to SES, create and verify the `madinatydeals.com` domain identity in SES in the selected AWS Region, publish SES's exact DKIM DNS records in Cloudflare, and request production access with mail type **Transactional** and website URL `https://madinatydeals.com`. New SES accounts are sandboxed per Region and can only send to verified recipients until production access is granted. Keep Microsoft 365's existing mail DNS records; merge SPF authorization if SES asks for an SPF record, and do not create a second SPF TXT record at the domain root. See [AWS domain identity setup](https://docs.aws.amazon.com/ses/latest/dg/creating-identities.html), [production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html), and [SES SMTP credentials](https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html).
- For Microsoft 365 delegated Graph mail, set `MAIL_PROVIDER=microsoft-graph-delegated`, `SMTP_FROM=hello@madinatydeals.com`, `MS_TENANT_ID`, and `MS_CLIENT_ID`. In the existing single-tenant Entra app, add the **delegated** Microsoft Graph `Mail.Send` permission (not the Application permission), enable **Allow public client flows**, and add `http://localhost` under **Authentication → Add a platform → Mobile and desktop applications**. Do not create an Exchange Application RBAC assignment or add a client secret. If an unscoped Graph `Mail.Send` **Application** permission was added during setup, remove it. Security Defaults blocks device-code sign-in, so use the browser-based PKCE setup below; do not disable Security Defaults.
- Run `MS_TENANT_ID=<tenant-id> MS_CLIENT_ID=<client-id> node scripts/microsoft-browser-login.js` on your Mac from this repository. Open the printed sign-in link in Safari, sign in as `hello@madinatydeals.com`, and approve `Mail.Send`. This writes `microsoft-mail-token.json` locally; keep it private. Copy it to the server with `scp -P <ssh-port> ./microsoft-mail-token.json <server-user>@<server-ip>:/tmp/microsoft-mail-token.json`. On the server, from the project directory, copy it into the running app container and set its permissions: `docker cp /tmp/microsoft-mail-token.json madinaty-deals-app-1:/app/data/mail-auth/token.json`, then `docker compose exec -u 0 app chown appuser:appgroup /app/data/mail-auth/token.json` and `docker compose exec -u 0 app chmod 600 /app/data/mail-auth/token.json`; remove the temporary host copy with `rm /tmp/microsoft-mail-token.json`. The token is kept in the persistent `madinaty-mail-auth` volume and rotated as Microsoft returns updated tokens. If authorization is revoked, repeat the browser flow and copy the new token. Back up the volume securely alongside the database and uploads.
- Account registration and sign-in use one-time codes sent through the configured email provider. Phone/SMS sign-in is not enabled.
- Uploaded photos and verification documents are stored in the `madinaty-uploads` Docker volume on the Ubuntu server. Back up this volume with the database; it is private and is served only through authenticated API routes.
- `ADMIN_EMAIL`: initial admin email for one-time seeding. Signing in still requires control of that mailbox. Set `RUN_SEED=false` after first seed; re-seeding resets commercial plan defaults. The admin dashboard can later assign `MODERATOR`, `SERVICE_PROVIDER`, `BUSINESS_OWNER`, `RESIDENT` or `ADMIN` roles and suspend accounts. Changes are recorded in the audit log; the last active administrator cannot be removed.

The entrypoint applies checked-in migrations, optionally seeds, then starts the application as a non-root user on a read-only filesystem. `/api/health` is process liveness; `/api/ready` checks PostgreSQL. Neither proves SMTP or Turnstile readiness.

Run `npm run maintenance:cleanup` daily using a scheduler with the same server environment. It deletes expired auth records and up to 100 unsubmitted uploads older than 24 hours per run. Repeat for larger backlogs. Submitted identity documents require a separately agreed retention/deletion policy; they are not deleted automatically.

## Manual deployment

Deploy updates from the Ubuntu server with `git pull` followed by `docker compose --env-file .env up -d --build --wait`. GitHub Actions deployment is not used.

## Google sign-in through Cognito

In the existing user pool's Google identity provider, map **Google `email` to Cognito `email`**, **Google `email_verified` to Cognito `email_verified`**, and optionally `name` to `name`. Mapping the email address alone does not verify it. AWS documents that [mapped email addresses are unverified by default](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-specifying-attribute-mapping.html). Keep the verified-email check in `server/cognito.js`; it protects account linking, including existing administrator accounts. The app client must allow Google and the `openid email profile` scopes, and must have the appropriate read/write permissions for the mapped attributes.

For the current replacement pool, inspect only the non-secret mapping in **AWS CloudShell**:

```bash
aws cognito-idp describe-identity-provider --user-pool-id eu-north-1_CQwYUlilX --provider-name Google --region eu-north-1 --query 'IdentityProvider.AttributeMapping' --output json --no-cli-pager
```

If `email_verified` is missing or mapped incorrectly, open **Cognito → this pool → Social and external providers → Google → Edit attribute mapping**. Add `email_verified` on both sides and save, preserving every existing mapping and the Google client credentials. This configuration change does not require a Docker rebuild or an SES approval. Start a new Google sign-in from the website after saving, so Cognito refreshes the mapped attributes. The website's local `/api/auth/session` must return a user before login is considered successful. Never publish that endpoint's CSRF token or any browser cookie values.

If the console doesn't offer the attribute, the same repair can be applied with CloudShell while preserving existing mappings:

```bash
aws cognito-idp describe-identity-provider --user-pool-id eu-north-1_CQwYUlilX --provider-name Google --region eu-north-1 --query 'IdentityProvider.AttributeMapping' --output json --no-cli-pager > madinaty-google-mapping.before.json
python3 -c 'import json; p=json.load(open("madinaty-google-mapping.before.json")); assert isinstance(p,dict) and p.get("email")=="email", "Review the current email mapping before continuing"; p["email_verified"]="email_verified"; json.dump(p,open("madinaty-google-mapping.fixed.json","w"))'
aws cognito-idp update-identity-provider --user-pool-id eu-north-1_CQwYUlilX --provider-name Google --region eu-north-1 --attribute-mapping file://madinaty-google-mapping.fixed.json --query 'IdentityProvider.AttributeMapping' --output json --no-cli-pager
```

Run each line in order and stop if any line fails. These files contain attribute names only. The update changes only the provider's attribute mapping; it does not update/reset the pool or app-client settings. Keep the `before` file for rollback.

Failed callbacks reopen the website account dialog with a persistent error instead of a disappearing toast. The server logs `Cognito sign-in rejected` and a fixed reason: `email_not_verified` (check provider mapping), `signin_state_invalid` (restart from the website to establish state), `provider_rejected` (Cognito returned an error), or `invalid_identity` (missing required identity claims). It never logs claims, codes, cookies or raw provider descriptions. A successful redirect alone does not prove a session exists. The old direct Cognito authorization link is not a valid end-to-end test because it bypasses the website's state/PKCE cookie setup.

## Local development

With the services configured, export server environment variables in your shell, then run:

```bash
npm ci
npm run db:generate
npm run db:migrate
npm run server:dev
# Separate terminal:
npm run dev
```

For Vite development use `APP_ENV=local` and `APP_ORIGIN=http://localhost:5173` (or Vite's actual port). Vite proxies `/api` to port 3000. The Node entrypoint does not automatically load `.env`; Compose does.

The recommended production setup is same-origin. Separate origins require an exact CORS origin, HTTPS, correct cookie behavior and frontend build configuration; this repository's deployment is designed and tested for same-origin use.

## Scope

Authentication, uploads and administrator user controls are server-backed. Listing/service submissions and comments enter review states; they are not automatically published. Reviewer API routes list and decide resident verifications, with server role checks and audit records. Publication workflow and deeper analytics remain separate work.

The frontend still displays illustrative marketplace inventory. Payments are disabled. Before public release, test with your actual SMTP/storage/Turnstile providers, configure TLS and backups, and confirm document retention with the responsible team.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the status report and next implementation milestones.
