# Deployment

The Node application serves the built frontend and `/api` from one origin. It requires PostgreSQL, SMTP, private S3-compatible storage and ClamAV. Use Node 22.13+ (22.x) or a supported Node 24+ release; the container uses Node 22.

## Isolated integration stack

The test override adds Mailpit (local email capture), MinIO (private S3 storage) and ClamAV. It uses an explicitly local configuration; no real email is sent.

```bash
docker compose --env-file .env.test.example -p madinaty-validation \
  -f docker-compose.yml -f docker-compose.test.yml up -d --build --wait --wait-timeout 900
npm run test:integration
```

Open `http://localhost:43187` and the local email inbox at `http://localhost:48025`. The integration script exercises email login, code replay, sessions, CSRF, private storage, ClamAV, verification review, rental quotas and logout. It is restricted to localhost URLs. Run it against a fresh test project: authentication throttles intentionally persist in PostgreSQL across restarts and repeated runs.

To inspect migrations and verify idempotent seeding:

```bash
docker compose --env-file .env.test.example -p madinaty-validation -f docker-compose.yml -f docker-compose.test.yml exec app npm run db:migrate
docker compose --env-file .env.test.example -p madinaty-validation -f docker-compose.yml -f docker-compose.test.yml exec app npm run db:seed
```

Stop the stack with the same Compose arguments followed by `down`. Add `-v` only when intentionally deleting this disposable test database, storage and virus-definition volumes. ClamAV downloads signatures on its first start; allow several minutes and at least 5 GB of VM memory for the full stack.

## Production configuration

Copy `.env.example` to a private `.env` and supply these values:

- `APP_ORIGIN`: exact HTTPS origin. Use a TLS reverse proxy; the container port binds to loopback on the host.
- `AUTH_SECRET`: at least 32 random characters. Generate with `openssl rand -hex 32`. Store it securely; changing it invalidates outstanding codes and CSRF tokens.
- `POSTGRES_PASSWORD`: a long URL-safe random password; Compose interpolates it into the database URL. `DATABASE_URL` is needed for non-Compose commands.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, and provider credentials. Production SMTP requires TLS; port 465 uses implicit TLS. Verify your sender domain with the provider.
- Phone sign-in uses SMS delivery through the Twilio Messages API. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM` to enable the required phone-only registration path. Keep these values private; without them phone code requests fail safely.
- `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`: configure the deployed hostname in Cloudflare. The server checks successful validation, hostname and the `login` action. Only `APP_ENV=local` permits running without CAPTCHA for isolated tests.
- `OBJECT_STORAGE_BUCKET`, `AWS_REGION`, optional HTTPS `OBJECT_STORAGE_ENDPOINT`, and credentials or a workload role with access to that private bucket. Keep public access blocked. Production writes request AES256 server-side encryption; confirm support with your storage provider. Allow only `PutObject`, `GetObject` and `DeleteObject` for the app's `photo/` and `verification/` prefixes.
- `CLAMAV_HOST` and optional `CLAMAV_PORT`: private network address of ClamAV with current signatures. Uploads fail closed when scanning is unavailable. Do not expose ClamAV publicly.
- `TRUSTED_PROXY_IPS`: optional comma-separated exact socket peer addresses. Set only for proxies you control; they must overwrite forwarded headers. The server walks the forwarded chain from the trusted side. With no setting, forwarded headers are ignored.
- `ADMIN_EMAIL`: initial admin email for one-time seeding. Signing in still requires control of that mailbox. Set `RUN_SEED=false` after first seed; re-seeding resets commercial plan defaults.

```bash
docker compose up -d --build --wait
```

The entrypoint applies checked-in migrations, optionally seeds, then starts the application as a non-root user on a read-only filesystem. `/api/health` is process liveness; `/api/ready` checks PostgreSQL. Neither proves SMTP, storage or scanner readiness; the integration test covers those services.

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

Authentication and uploads are server-backed. Listing/service submissions and comments enter review states; they are not automatically published. Reviewer API routes list and decide resident verifications, with server role checks and audit records. A full moderation dashboard and a workflow to publish submitted marketplace content remain separate work.

The frontend still displays illustrative marketplace inventory. Payments are disabled. Before public release, test with your actual SMTP/storage/Turnstile providers, configure TLS and backups, and confirm document retention with the responsible team.

## Browser notifications

Web Push is optional. The site includes a bilingual consent prompt with Allow notifications / Not now, seven-day dismissal, and a notification settings button. Permission is requested only from the Allow button. Visitors do not need an account. Until the server is configured, the prompt reports temporary unavailability and does not request browser permission or claim success.

1. Generate a VAPID key pair once using `npx web-push generate-vapid-keys --json`. Store it securely; do not commit the keys.
2. Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT=mailto:your-real-contact@example.com` in the server environment. Compose passes these variables to the application. Never put the private key in a `VITE_*` variable. The subscription endpoint returns only the public key.
3. Apply migrations and restart the server. Existing SMTP/storage/auth configuration is still required by the main application. Serve production over HTTPS.
4. On Safari for iPhone/iPad, add the website to the Home Screen and launch it from that icon before subscribing. The manifest and a push-only service worker are included. No pages, API responses or private documents are cached by this worker.
5. Test with your own consenting browser first: allow notifications, verify the subscription in PostgreSQL, send a reviewed test campaign, click it, then turn notifications off and confirm delivery stops.

Create a private JSON campaign file with a new UUID for each distinct message:

```json
{
  "id": "3fbf4c50-9a58-425e-b5f2-fdf44f6e52cf",
  "advertiserName": "Studio 8 Pilates",
  "offerTitle": "New member class offer",
  "offerDetails": "15% off a first reformer session. Show this notification at reception.",
  "category": "Health & fitness",
  "zone": "All zones",
  "startsAt": "2026-10-01T00:00:00.000Z",
  "endsAt": "2026-10-15T23:59:59.000Z",
  "feeCents": 50000,
  "title": "Madinaty Deals",
  "body": "Replace this with the update or offer you want to send.",
  "language": "ar",
  "url": "/?lang=ar"
}
```

`language` selects subscribed browsers with that language (`ar`, `en`, or `all`). The message is sent exactly as written, not automatically translated. Links must stay on the configured `APP_ORIGIN`. The campaign category and zone define the audience; subscribers who choose category preferences receive only matching campaigns, while subscribers with no category selection remain eligible for all categories. A subscriber receives at most two promotional campaigns per category in seven days.

With `DATABASE_URL`, `APP_ORIGIN` and the VAPID variables exported in the shell:

```bash
# Preview message and matching subscription count. This sends nothing.
npm run notifications:send -- /path/to/campaign.json

# After reviewing the preview, explicitly send that campaign.
npm run notifications:send -- /path/to/campaign.json --send
```

The sending command is operator-only; there is no public broadcast endpoint or dashboard composer. Access requires the server environment/database credentials. A reviewer creates a campaign through `POST /api/admin/notification-campaigns`, then reviews it through `POST /api/admin/notification-campaigns/:id/review`. An admin confirms the manually agreed fee through `POST /api/admin/notification-campaigns/:id/payment` with `{ "status": "PAID" }`. A campaign cannot send until its review status is `APPROVED`, payment status is `PAID`, and the current time is inside its start/end window. Do not execute a campaign simply to test the installation. Notifications go only to saved subscriptions with recorded consent and the current VAPID public key.

Deliveries are recorded before sending, so rerunning a campaign skips previously attempted devices. Campaign records expose delivery counts for `ACCEPTED`, `FAILED`, `EXPIRED` and `SKIPPED` outcomes through `GET /api/admin/notification-campaigns`. A crash or transient error can leave a device without a notification; automatic retry is deliberately avoided because delivery may have succeeded before the error. Reusing a campaign ID with different content is rejected. Each successful count means the push service accepted the message, not that a person saw it. Messages expire after one hour at the push service. Endpoints returning 404/410 are removed. Revoking permission in browser settings stops delivery; the server learns of expiry on a subsequent attempt.

The browser may rotate or expire a subscription; visitors can re-enable it with the Notifications button. Rotating the VAPID key pair requires fresh consent/subscription enrollment; old-key subscriptions are excluded from broadcasts. Subscription keys/endpoints are private capabilities: do not expose them in logs or admin exports. Campaign delivery history keeps only subscription UUIDs, status and timestamps after a subscription is removed.

Real push delivery and migration execution remain unverified in this workspace until PostgreSQL, VAPID configuration, and a consenting browser are available.
