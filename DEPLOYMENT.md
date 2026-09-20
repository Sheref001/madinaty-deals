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

- `APP_ORIGIN`: exact HTTPS origin. Use a TLS reverse proxy; the container port binds to loopback on the host.
- `AUTH_SECRET`: at least 32 random characters. Generate with `openssl rand -hex 32`. Store it securely; changing it invalidates outstanding codes and CSRF tokens.
- `POSTGRES_PASSWORD`: a long URL-safe random password; Compose interpolates it into the database URL. `DATABASE_URL` is needed for non-Compose commands.
- For SMTP, set `MAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_FROM`, and provider credentials. Production SMTP requires TLS; port 465 uses implicit TLS.
- For Microsoft 365 delegated Graph mail, set `MAIL_PROVIDER=microsoft-graph-delegated`, `SMTP_FROM=hello@madinatydeals.com`, `MS_TENANT_ID`, and `MS_CLIENT_ID`. In the existing single-tenant Entra app, add the **delegated** Microsoft Graph `Mail.Send` permission (not the Application permission), enable **Allow public client flows**, and do not create an Exchange Application RBAC assignment or add a client secret. If an unscoped Graph `Mail.Send` **Application** permission was added during setup, remove it. The app signs in as `hello@` once; it saves a refresh token in the persistent `madinaty-mail-auth` Docker volume and rotates it as Microsoft returns updated tokens.
- After deploying the updated image, run `docker compose --env-file .env run --rm --no-deps --entrypoint node app scripts/microsoft-device-login.js`. Open the printed Microsoft URL, enter the one-time code, sign in as `hello@madinatydeals.com`, and approve the `Mail.Send` request. The code is short-lived and must not be shared. The command stores the refresh token in the named Docker volume; it does not print the token. If authorization is revoked or expires, rerun this command. Back up the `madinaty-mail-auth` volume securely alongside the database and uploads.
- Account registration and sign-in use one-time codes sent through the configured email provider. Phone/SMS sign-in is not enabled.
- Uploaded photos and verification documents are stored in the `madinaty-uploads` Docker volume on the Ubuntu server. Back up this volume with the database; it is private and is served only through authenticated API routes.
- `ADMIN_EMAIL`: initial admin email for one-time seeding. Signing in still requires control of that mailbox. Set `RUN_SEED=false` after first seed; re-seeding resets commercial plan defaults. The admin dashboard can later assign `MODERATOR`, `SERVICE_PROVIDER`, `BUSINESS_OWNER`, `RESIDENT` or `ADMIN` roles and suspend accounts. Changes are recorded in the audit log; the last active administrator cannot be removed.

The entrypoint applies checked-in migrations, optionally seeds, then starts the application as a non-root user on a read-only filesystem. `/api/health` is process liveness; `/api/ready` checks PostgreSQL. Neither proves SMTP or Turnstile readiness.

Run `npm run maintenance:cleanup` daily using a scheduler with the same server environment. It deletes expired auth records and up to 100 unsubmitted uploads older than 24 hours per run. Repeat for larger backlogs. Submitted identity documents require a separately agreed retention/deletion policy; they are not deleted automatically.

## Automatic deployment from GitHub

The repository includes `.github/workflows/deploy.yml`. Every push to `main` runs typecheck, lint, build and tests. Only after those checks pass does GitHub connect to the Ubuntu server, copy the tested source, rebuild the Compose app and wait for `/api/ready`. The workflow preserves the server-only `.env` and Docker volumes.

Create a dedicated deployment user on the server with write access to the repository directory and permission to run Docker Compose. Do not use `root` for GitHub Actions. Add the public SSH key to that user’s `~/.ssh/authorized_keys`. The workflow copies the tested source directly, so the server does not need a separate GitHub pull key. In the GitHub repository, create a `production` environment and add these secrets:

- `DEPLOY_HOST`: server hostname or IP.
- `DEPLOY_PORT`: SSH port, usually `22`.
- `DEPLOY_USER`: dedicated deployment username.
- `DEPLOY_PATH`: absolute repository path, such as `/opt/madinaty-deals`.
- `DEPLOY_SSH_KEY`: the private key for the deployment user, including its complete header and footer.
- `DEPLOY_KNOWN_HOSTS`: the exact output of `ssh-keyscan -H <server-host>` collected from a trusted machine.

Keep the production `.env` only on the server. The workflow never copies or prints it. Test the connection once from a trusted machine, then push a small change to `main` or run the workflow manually from GitHub Actions.

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
