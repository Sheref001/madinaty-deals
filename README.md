# Madinaty Deals

Madinaty Deals is a mobile-first hyperlocal marketplace and local discovery MVP for Madinaty, Egypt. It combines resident-to-resident listings, trusted services, businesses and time-limited offers without attempting to replace WhatsApp or Facebook.

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
- Paid placement is not active. Any future Featured/Sponsored inventory must be clearly labeled and controlled by feature flags.
- No production credentials, legal approvals, prices, verification rules or official zone dataset are included.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the status report and next implementation milestones, and [DEPLOYMENT.md](./DEPLOYMENT.md) for environment and third-party setup requirements.
