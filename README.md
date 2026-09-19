# Madinaty Deals · A Community Solutions product

Madinaty Deals is the first product from Community Solutions: a mobile-first hyperlocal marketplace and local discovery MVP for Madinaty, Egypt. It combines resident-to-resident listings, trusted services, businesses and time-limited offers without attempting to replace WhatsApp or Facebook.

## Run locally

Requirements: Node.js 22.13+ (22.x) or a supported Node.js 24+ release, and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The app is seeded with illustrative local content so the core validation journeys can be explored immediately.

## Checks

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

## Product notes

- Arabic is the default interface, with an English/العربية switch in the header. Changing language immediately returns to the top of the homepage. The selection is remembered on this browser and in the URL.
- Navigation, forms, messages and sample content support both languages; Arabic uses a right-to-left layout. Search matches Arabic and English sample content. User-entered text stays in its original language.
- Translation copy lives in `src/ar.ts`; form values and stored category/zone identifiers remain independent of display language.

- Tutoring & education has Individuals and Tutoring centres subcategories. Tutoring-centre submissions create an account and enter the owner approval queue; publication remains subject to manual fee confirmation. Electronics retains Individuals and Small businesses subcategories. Health & fitness (including gyms) is business-only.
- Contact actions are represented as instrumented WhatsApp/phone/quote actions; no phone number is exposed in public card markup.
- Verification submissions explicitly stay private and are shown as pending manual review.
- Resident verification is optional and applies to resident sellers; external service providers (tutors, plumbers, carpenters, movers, etc.) are not asked to prove that they live in Madinaty. Their service details and contact information can be reviewed instead.
- Apartment rentals are a resident-only category: brokers and dealers are prohibited, and a verified resident may publish at most one rental post per calendar month. The API enforces verified resident eligibility and one rental submission per Cairo calendar month under a database lock. Submissions await review; public inventory remains illustrative.
- Services include housekeeping and cleaning, plus local delivery riders who can pick up and bring items within Madinaty by motorcycle. These providers do not need to prove that they are Madinaty residents; their service details and contact information are reviewed instead.
- Paid placement is not active. Any future Featured/Sponsored inventory must be clearly labeled and controlled by feature flags.
- Offers are currently disabled while the marketplace builds its initial customer and merchant base. Set `featureFlags.offers` to `true` in `src/featureFlags.ts` only after offer inventory, review, expiry, and attribution workflows are ready.
- No production credentials, legal approvals, prices, verification rules or official zone dataset are included.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the status report and next implementation milestones, and [DEPLOYMENT.md](./DEPLOYMENT.md) for environment and third-party setup requirements.

## Backend and deployment status

The Node/Prisma API supports email-code authentication, cookie sessions, private scanned uploads, resident verification review, listing/service submissions, view counts and moderated comments. Run `npm run server:dev` alongside Vite after configuring PostgreSQL and applying migrations. Docker Compose configuration is included; see [DEPLOYMENT.md](./DEPLOYMENT.md).

Sign-in and submissions require PostgreSQL, SMTP, local Docker upload storage and Turnstile outside local testing. Registration uses email one-time codes; phone/SMS sign-in is disabled. Uploaded photos and verification documents remain private. Listing/service submissions enter a review queue; a workflow to publish them and a full moderation dashboard remain to be built. The frontend still browses sample inventory. API unit tests use database doubles; the included local integration script requires the Docker test stack and has not yet been run here.

