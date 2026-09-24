# Madinaty Deals Architecture

This document describes what is implemented in this repository. Production values and infrastructure that are not present in source or configuration are marked unknown; deployment notes are identified as documentation rather than independently verified live state.

## Repository layout

```text
src/                    React + TypeScript single-page application
server/                 Node.js HTTP API and service modules
prisma/                 PostgreSQL schema, migrations, and seed
scripts/                Cleanup, integration, and operational scripts
public/                 Static assets and legal pages
docs/                   Development, deployment, security, and architecture docs
docker-compose.yml      App and PostgreSQL services
docker-compose.test.yml Test-only Mailpit override
Dockerfile              Production build/runtime image
```

## Frontend

- React and TypeScript are built and served with Vite. The checked-in lockfile currently resolves React 19.3.0, Vite 8.2.2, and TypeScript 6.0.3; `package.json` uses `latest` for these packages, so those versions can change on dependency updates.
- `src/main.tsx` mounts `src/App.tsx`. Navigation is implemented with application state and URL query parameters; no routing library is configured.
- `src/api.ts` is the fetch client. It defaults to the same-origin `/api`; `VITE_API_BASE_URL` can override it at build time.
- Interface language is Arabic by default, with English support, translations in `src/ar.ts`, and RTL direction for Arabic. Language preference and URL state are managed in the frontend.
- Marketplace seed/sample inventory remains in `src/data.ts`. The client also loads published listing and service submissions from the API.
- Admin screens are frontend views; sensitive actions are authorized by the backend, not by frontend visibility alone.

## Backend and API

- The backend is an ES-module Node.js application using Node's built-in `node:http` server. It does not use Express, Fastify, or another HTTP framework.
- `server/index.js` constructs Prisma and the application services. `server/app.js` routes `/api` requests, applies common response/security headers, handles static frontend files, and maps known request errors to HTTP responses.
- API modules are separated by concern: authentication (`auth.js`, `cognito.js`), uploads (`uploads.js`), submissions (`submissions.js`), accounts/moderators (`admin.js`), moderation/operations (`operations.js`), reports (`reports.js`), and translation (`translation.js`).
- Implemented route groups include health/readiness/config, authentication, uploads and verification, submissions and public submissions, content visibility/views/comments, reports, translation, and admin users/moderators/verification/content/operations controls. Routes are explicitly matched in `server/app.js`; there is no generated API schema or separate API server.
- Request JSON parsing, route validation, and API error handling are implemented in `server/request.js` and the route modules. The app sets security headers and uses configured same-origin CORS behavior. The general API limiter is in-memory per Node process; authentication/action limits use PostgreSQL records.
- `/api/health` is process liveness. `/api/ready` executes a PostgreSQL query; neither endpoint verifies email delivery or external identity-provider availability.

## PostgreSQL and persistence

- Prisma ORM (`@prisma/client`/Prisma 6.19.3 in the lockfile) connects to PostgreSQL via `DATABASE_URL`. The production Compose file uses PostgreSQL 16 Alpine and persists it in the `madinaty-postgres` named volume.
- The checked-in schema includes user/profile, role/status, session/OTP, residency verification, uploads, submissions, moderation, reporting, audit, content interaction, business, subscription, payment, and related domain models. Migrations are under `prisma/migrations/` and are applied by the container entrypoint before server startup.
- Implemented backend workflows use Prisma queries and transactions. Per-user PostgreSQL advisory transaction locks protect selected upload, submission, verification, and quota operations.
- Several models (including payment, subscription, review, and business-claim models) exist in the schema without a complete corresponding public workflow in the current API. Their presence does not establish that payments or subscriptions are active; payments are disabled per the deployment notes.
- The production database host/provider outside the Compose topology, backup schedule, and restore procedure are not verifiable from this repository. The docs recommend preserving/backing up persistent data but do not configure a backup service.

## Authentication and sessions

- The application supports two server-side sign-in paths selected by configuration: email one-time codes and Amazon Cognito managed login. With Cognito enabled, the legacy email-code endpoints are disabled.
- The email-code implementation currently accepts email; phone/SMS sign-in is not enabled. Codes are generated by the server, HMAC-protected in PostgreSQL, expire after 10 minutes, allow at most five verification attempts, and are subject to PostgreSQL-backed rate limits.
- Successful sign-in creates a random opaque session token. Only its SHA-256 hash is stored in PostgreSQL. Sessions expire after seven days. Production cookies are `HttpOnly`, `Secure`, `SameSite=Lax`, and use the `__Host-` prefix; local mode relaxes `Secure` and uses a development cookie name.
- State-changing authenticated requests verify the configured request origin and an HMAC-derived CSRF token. Suspended/deleted accounts and expired sessions are rejected. Logging-out removes the session and records an audit entry.
- Cognito is integrated through `openid-client` discovery and an authorization-code flow with PKCE, state, nonce, and an encrypted short-lived state cookie. The callback requires a verified email claim, links identities by verified email, then creates the application's own local session. Google identity-provider selection is supported through Cognito.
- `COGNITO_ENABLED` defaults to false in `.env.example`; actual production environment values are not stored in Git and cannot be verified here. The root `DEPLOYMENT.md` describes Cognito as the current production sign-in provider, but this repository does not inspect the live environment.

## Authorization and administration

- User roles in Prisma are `RESIDENT`, `SERVICE_PROVIDER`, `BUSINESS_OWNER`, `MODERATOR`, and `ADMIN`; accounts also have active/suspended/deleted status.
- Admin endpoints require the `ADMIN` role. Moderators receive explicit `DASHBOARD`, `REPORTS`, `RESIDENT_VERIFICATIONS`, and/or `CONTENT_REVIEW` permissions, checked by server modules. Account-role/status changes and moderator assignment/revocation are admin-only.
- Implemented admin functions include user search/role/status changes, moderator assignment, residency verification review, content submission review and status controls, report review, publication pauses, public registration access, dashboard counts, and audit history.
- Sensitive changes are recorded in `AuditLog`. Suspending an account revokes sessions; the public submission and image paths check account/content state.
- The web app includes reporting, comments, resident verification, and listing/service submissions. New comments are stored hidden and public reads return only published comments; a comment-review endpoint is not currently implemented. Public inventory still includes illustrative frontend seed data; backend submission records provide additional public listing/service data when published.

## Email, Cognito email, and AWS services

- Application-generated email uses Nodemailer SMTP by default, or an optional Microsoft Graph delegated `Mail.Send` implementation. Graph refresh tokens are read from and rotated in a private server-side token file. The selected provider and credentials are runtime configuration, not committed values.
- There is no direct Amazon SES SDK integration in the application. Cognito confirmation/password-reset delivery through SES is described as external Cognito configuration in the root deployment notes; its live SES identity, region, and production-access state are not verifiable from the repository. SMTP could be configured to an SES SMTP endpoint, but that is not established by the code.
- AWS SDK v3 `@aws-sdk/client-translate` is used for optional on-demand translation. It is disabled by default, uses `TRANSLATION_REGION`/`AWS_REGION`, and caches successful translations in PostgreSQL. No S3 client, S3 presigning flow, CloudFront integration, or S3 image worker is implemented.
- AWS credentials, if needed by the runtime, are provided outside source through the AWS SDK credential chain/environment. Compose forwards optional AWS credential environment variables; no AWS keys are present in frontend code.

## Uploads and images

- Uploads are sent through the authenticated Node API as request bodies; they do not upload directly to S3. The server reads each file into memory before validation/processing.
- Photos are limited to 5 MiB; verification documents to 10 MiB. Photo input types are JPEG, PNG, WebP, AVIF, and GIF; verification documents may also be PDF. Generated storage keys use the purpose, user ID, and server-generated UUID; user-supplied filenames are sanitized and are not used as storage paths.
- `sharp` validates/decodes supported image data, rotates and resizes it, then emits WebP (up to 2000 px for photos and 4000 px for verification images). PDFs receive basic signature/EOF checks. No antivirus/ClamAV scanner is configured in the tracked application.
- Bytes are stored on local disk through `server/local-storage.js`, normally under `/app/data/uploads` in the persistent `madinaty-uploads` Docker volume. The database records object key, MIME type, size, hash, ownership, purpose, and association/status.
- Verification uploads remain private and are served only to their owner or an authorized reviewer. Published submission photos use `/api/public-uploads/:id`; the API checks publication, account, and moderation visibility before returning the file, and marks it `private, no-store`. This is not a public S3 bucket/CDN design.
- `scripts/cleanup.mjs` removes expired auth records and up to 100 unsubmitted uploads older than 24 hours per run. A daily external scheduler is recommended by root `DEPLOYMENT.md`; no scheduler is configured in this repository. Submitted verification documents have no automatic retention deletion.

## Runtime configuration

The actual production `.env` is not checked in. Names below are verified from `server/config.js`, Compose, and the example environment files; values must be supplied externally.

- Core/server: `APP_ENV`, `APP_ORIGIN`, `PORT`, `APP_PORT`, `AUTH_SECRET`, `TRUSTED_PROXY_PEERS`, `REGISTRATION_ENABLED`, `UPLOAD_DIRECTORY`.
- PostgreSQL/seed: `DATABASE_URL`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `RUN_SEED`, `ADMIN_EMAIL`.
- Cognito: `COGNITO_ENABLED`, `COGNITO_ISSUER_URL`, `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`, `COGNITO_CALLBACK_URL`, `COGNITO_DOMAIN_URL`.
- Mail: `MAIL_PROVIDER`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_TOKEN_FILE`.
- AWS translation: `TRANSLATION_ENABLED`, `TRANSLATION_REGION`, `AWS_REGION`; Compose also passes optional `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_SESSION_TOKEN`.
- Frontend build: `VITE_API_BASE_URL`. It is public client configuration, not a secret.

The application validates HTTPS `APP_ORIGIN` outside local mode and requires `AUTH_SECRET` of at least 32 characters. `server/index.js` does not load `.env` itself; Docker Compose injects it. `.env.example` is a template, not evidence of the deployed values.

## Docker, network, and reverse proxy

- The multi-stage `Dockerfile` builds the Vite assets and Prisma client in Node 22 Alpine, then runs the API/static server in a Node 22 Alpine runtime as a non-root user. The container filesystem is read-only except for `/tmp` and mounted data volumes.
- `docker-compose.yml` defines `db` and `app`. PostgreSQL is not host-published. The application is published only on host loopback (`127.0.0.1:${APP_PORT}:3000`); PostgreSQL, uploads, and Microsoft mail-auth data use named volumes. Both services have health checks and restart policies.
- `docker-compose.test.yml` adds Mailpit for an isolated local integration environment; it is not a production mail service.
- Vite development proxies `/api` to `http://localhost:3000`. The production server serves the frontend and API from one origin by default.
- No Nginx, Caddy, Traefik, Apache, or Cloudflare configuration is tracked. The root `DEPLOYMENT.md` documents an external host Nginx/Cloudflare setup and upload-size guidance; the active proxy configuration, TLS termination, DNS, and host operating-system version cannot be independently verified from this repository.

## Git and deployment

- The configured Git remote is GitHub (`Sheref001/madinaty-deals`); the inspected branch is `main`. Branch-protection settings are not available in the repository.
- No CI/CD workflow files are tracked; `.github/workflows/` is empty. Automated testing/build/deployment on push is therefore not configured in this repository.
- Root `DEPLOYMENT.md` documents manual production updates by fast-forwarding `main` on the Ubuntu host and rebuilding/starting Compose. It also documents that this is separate from Git push. The actual production host, current deployed commit, and whether the documented steps are still the live procedure are unknown here.
- Available local checks are `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`, and Prisma validation/migration scripts. The package uses Vitest for the unit test suite.

## Not currently implemented or not verifiable

- S3 storage, presigned browser uploads, CloudFront image delivery, and an asynchronous image-processing queue/worker are not implemented.
- A direct SES API integration, payment gateway, production analytics/monitoring provider, and in-repository reverse-proxy configuration are not present.
- Production environment values, live AWS/Cognito/SES configuration, production PostgreSQL hosting/backups, external scheduler state, DNS/TLS configuration, GitHub branch protection, and current deployed commit cannot be verified from checked-in files.
- Database models for business/review/payment/subscription features should not be read as proof that end-user workflows or external services for those features are live.
