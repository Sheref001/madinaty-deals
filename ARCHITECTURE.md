# Madinaty Deals — architecture/status

## Repository status

This repository started as a blank workspace containing only `Madinaty_Deals_Codex_Product_Brief.docx`. The current milestone includes a runnable frontend with seeded domain data and a Node/Prisma API for authentication, private uploads, submissions, verification review, views and comments. There is no production database, auth provider, object storage, payment gateway, SMS provider, or deployed environment configured yet.

## Current shape

```text
src/
  App.tsx          UI composition and local interaction state
  data.ts          seed content and configurable zones/categories
  domain.ts        query/filter/view rules; API-independent
  analytics.ts     provider abstraction seam for consent-aware events
  types.ts         domain contracts and explicit status/type unions
  styles.css       responsive design system and RTL-safe layout primitives
```

The app uses Vite + React + TypeScript. The current local data layer is intentionally replaceable: future API calls should provide the same `SearchResult` contracts to the UI. Business rules such as search filtering and saved-state transitions are kept outside components where practical.

## Implemented in this milestone

- Mobile-first home, marketplace, services, businesses, offers and saved views.
- Global and collection search with zone, verified-only and sort filters.
- Responsive semantic UI with keyboard focus states, labels, dialog semantics and mobile navigation.
- Resident listing flow with review-queue language; service providers use a separate path and are not required to prove Madinaty residency.
- Save/favorite, contact lead, verification submission and report flows.
- A small trust-desk shell for reports, verification reviews and business claims.
- Analytics event instrumentation through a replaceable `track()` provider abstraction.
- Seed categories, zones, listings, providers, businesses and offers for local validation.

## Next mergeable milestones

1. Run the isolated integration stack against real PostgreSQL, SMTP capture, private storage and ClamAV. Account and submission flows now call the API; public marketplace inventory remains sample data.
2. Build the moderation dashboard and a publication workflow connecting approved submissions and photos to public marketplace inventory. Private uploads, image sanitization, scanning, audit records and verification review endpoints are implemented.
3. Add interaction-linked reviews, business claims, plan/entitlement/promotion models and a gateway adapter.
4. Add consent-aware analytics, retention/deletion jobs, SEO route generation, CI and staging deployment.

## Deliberate TODOs

- Configure SMTP, Turnstile and production secrets. Email codes, sessions, CSRF protection and PostgreSQL-backed action limits are implemented.
- Configure private local upload storage. Upload processing and retrieval permissions are implemented; validate the real services before release.
- `TODO: verify and seed official/common Madinaty zone labels` — the current labels are illustrative configuration.
- `TODO: obtain Egyptian legal advice before production` — verification, marketing, payments and business obligations need review.
- `TODO: configure a consent-aware analytics provider` — local development logs only.
