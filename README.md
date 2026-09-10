# Madinaty Deals · A Community Solutions product

Madinaty Deals is the first product from Community Solutions: a mobile-first hyperlocal marketplace and local discovery MVP for Madinaty, Egypt. It combines resident-to-resident listings, trusted services, businesses and time-limited offers without attempting to replace WhatsApp or Facebook.

## Run locally

Requirements: Node.js 20+ and npm.

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

- Arabic is the default interface, with an English/العربية switch in the header. The selection is remembered on this browser.
- Navigation, forms, messages and sample content support both languages; Arabic uses a right-to-left layout. Search matches Arabic and English sample content. User-entered text stays in its original language.
- Translation copy lives in `src/ar.ts`; form values and stored category/zone identifiers remain independent of display language.

- Ordinary resident listings are free in the validation UI.
- Contact actions are represented as instrumented WhatsApp/phone/quote actions; no phone number is exposed in public card markup.
- Verification submissions explicitly stay private and are shown as pending manual review.
- Resident verification is optional and applies to resident sellers; external service providers (tutors, plumbers, carpenters, movers, etc.) are not asked to prove that they live in Madinaty. Their service details and contact information can be reviewed instead.
- Apartment rentals are a resident-only category: brokers and dealers are prohibited, and a verified resident may publish at most one rental post per calendar month. The current MVP demonstrates this limit in local browser storage; production enforcement must be implemented server-side with account verification, moderation and an auditable monthly quota.
- A pre-publication content safety layer screens listing and service text for prohibited drugs, sexual/pornographic content, nudity and illegal weapons. The MVP does not currently accept photos; before image uploads are enabled, images must pass an image-safety classifier and human review path before public storage or display. Automated screening is a first layer and must be paired with reports, moderation queues, appeals and server-side enforcement in production.
- Paid placement is not active. Any future Featured/Sponsored inventory must be clearly labeled and controlled by feature flags.
- Offers are currently disabled while the marketplace builds its initial customer and merchant base. Set `featureFlags.offers` to `true` in `src/featureFlags.ts` only after offer inventory, review, expiry, and attribution workflows are ready.
- No production credentials, legal approvals, prices, verification rules or official zone dataset are included.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the status report and next implementation milestones, and [DEPLOYMENT.md](./DEPLOYMENT.md) for environment and third-party setup requirements.
