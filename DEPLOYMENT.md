# Deployment

The Node application serves the built frontend and `/api` from one origin. It requires PostgreSQL, SMTP and a Docker-managed local upload volume. Use Node 22.13+ (22.x) or a supported Node 24+ release; the container uses Node 22.

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
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, and provider credentials. Production SMTP requires TLS; port 465 uses implicit TLS. Use `hello@madinatydeals.com` as the verified sender once the domain is configured with your mail provider.
- Account registration and sign-in use one-time codes sent through the configured SMTP service. Phone/SMS sign-in is not enabled.
- Uploaded photos and verification documents are stored in the `madinaty-uploads` Docker volume on the Ubuntu server. Back up this volume with the database; it is private and is served only through authenticated API routes.
- `ADMIN_EMAIL`: initial admin email for one-time seeding. Signing in still requires control of that mailbox. Set `RUN_SEED=false` after first seed; re-seeding resets commercial plan defaults. The admin dashboard can later assign `MODERATOR`, `SERVICE_PROVIDER`, `BUSINESS_OWNER`, `RESIDENT` or `ADMIN` roles and suspend accounts. Changes are recorded in the audit log; the last active administrator cannot be removed.

The entrypoint applies checked-in migrations, optionally seeds, then starts the application as a non-root user on a read-only filesystem. `/api/health` is process liveness; `/api/ready` checks PostgreSQL. Neither proves SMTP or Turnstile readiness.

Run `npm run maintenance:cleanup` daily using a scheduler with the same server environment. It deletes expired auth records and up to 100 unsubmitted uploads older than 24 hours per run. Repeat for larger backlogs. Submitted identity documents require a separately agreed retention/deletion policy; they are not deleted automatically.

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
