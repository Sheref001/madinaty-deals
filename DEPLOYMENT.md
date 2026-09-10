# Deployment and environment setup

The current milestone is a static Vite front end. It can be deployed to any static host after `npm run build`; the generated `dist/` directory is the deploy artifact.

## Environment variables

There are no required environment variables for the local seeded demo.

The following are reserved for the backend integration and should be added only through local/staging/production secret management:

| Variable | Purpose | Required when |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Browser API origin | API integration is enabled |
| `VITE_ANALYTICS_PROVIDER` | Consent-aware analytics provider name | Analytics is enabled |
| `DATABASE_URL` | PostgreSQL connection string | Server/API is introduced |
| `OTP_PROVIDER_API_KEY` | SMS/OTP provider credential | Phone verification is introduced |
| `OBJECT_STORAGE_BUCKET` | Private image storage bucket | Image uploads are introduced |
| `PAYMENT_GATEWAY` | Replaceable payment gateway identifier | Payments are feature-flagged on |
| `PAYMENT_GATEWAY_SECRET` | Server-only gateway secret | Payments are feature-flagged on |

Do not put server-only secrets in `VITE_*` variables. Do not commit `.env` files.

## Static deployment

```bash
npm ci
npm run db:validate
npm run db:migrate
npm run build
```

`db:migrate` requires a real `DATABASE_URL` in the deployment environment and applies the checked-in migration under `prisma/migrations/`. The local placeholder URL used for schema validation must never be used for deployment. Publish `dist/` with SPA fallback to `index.html`. Set the host's cache policy so hashed assets are cacheable and `index.html` is revalidated.

## Before production

- Add a server-rendered/hybrid SEO layer and canonical category, service and business routes.
- Add PostgreSQL migrations and seed scripts for categories, configurable zones, plans, entitlements and the first admin user.
- Add secure OTP, session management, RBAC, object-aware authorization and server-side validation.
- Add private image processing (MIME/size validation, resize/compress, metadata stripping and thumbnails).
- Add an idempotent payment webhook adapter and auditable payment transitions before enabling checkout.
- Configure consent, marketing opt-out and retention/deletion workflows; obtain Egyptian legal advice before launch.
- Create staging secrets separately from production and run migrations as an explicit release step.
