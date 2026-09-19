# Validation — 18 September 2026

## Completed locally

- 80 tests passed across ten files, including UI/domain tests and backend tests using database doubles.
- TypeScript type checking, ESLint, production build and `git diff --check` passed.
- Prisma schema validation and client generation passed.
- Entrypoint shell syntax passed.
- A real Node server started and stopped successfully. HTTP checks passed for the homepage, health endpoint, robots.txt, sitemap.xml, missing assets, incomplete content routes, malformed URL escapes, invalid JSON bodies and oversized request bodies.
- The language-switch test checks homepage navigation in both directions, instant scrolling, retained saved items and the selected language after reload.

## Fixes completed during validation

- Included Prisma CLI and tsx in runtime dependencies; entrypoint uses the configured npm migration and seed scripts. Added OpenSSL to both Alpine image stages.
- Extracted the request handler for backend tests without a database connection.
- Enforced JSON byte limits while reading, preserved UTF-8 across chunks and returned client errors for invalid requests.
- Bounded and expired rate-limit state, ignored untrusted forwarded-IP headers and prevented concurrent comment submissions from bypassing the throttle.
- Removed the default wildcard/credentials CORS combination; same-origin requests need no CORS headers.
- Allowed blob photo previews in the content security policy, corrected crawler-file MIME types, cached bundled assets and returned 404 for missing assets.

## Still unverified or not implemented

- Docker image build, Compose startup, real PostgreSQL migrations, seeding and database-backed API writes: Docker and PostgreSQL executables are unavailable in this environment.
- Browser visual inspection was not performed; UI behavior was checked with jsdom tests.
- Validation ran on installed Node 23.6.0, which is outside some tooling support ranges. The container targets Node 22; repeat the checks in that environment before release.
- Email-code authentication, sessions, private scanned uploads, submission queues, verification review and server-side rental quotas are implemented. Real service integration remains unverified here; the public inventory still uses sample data, and marketplace publication and the full moderation dashboard remain unfinished.
- General request limits remain per process. Sensitive action limits use PostgreSQL counters, and proxy identification supports explicitly trusted peers; production proxy configuration and multi-instance behavior still require integration validation.

## Continuation checks

- Added 19 focused submission/review tests covering authentication, account-scoped history, client ownership/status tampering, external service providers, rental eligibility and Cairo month boundaries, repeat rentals, photo ownership/readiness/size, reviewer access, self-review and already-decided requests.
- Tightened photo and verification-request UUID validation so malformed identifiers are rejected before database queries.
- Updated README, architecture and security status to reflect implemented authentication and private uploads.
- Re-ran the complete 80-test suite, TypeScript, ESLint, build, schema validation and diff whitespace checks. One run alongside other checks timed out in the existing language-switch test; the standalone rerun passed all 80 tests in 9.68 seconds. These tests use database doubles; the monthly concurrency guarantee still needs the real integration stack.

This validates local behavior and API boundaries; it does not establish production readiness.

## Promotional notification campaigns

- Added campaign fields for advertiser, concrete offer details, category/zone audience, language, start/end window, agreed fee, review state, payment state and delivery outcomes.
- Added reviewer campaign creation/listing and review endpoints. Payment confirmation is restricted to admins and is currently manual; no gateway is claimed.
- Sending is blocked unless the campaign is approved, marked paid and inside its validity window. Subscribers can select optional category preferences; empty preferences mean all categories. Delivery skips category/zone mismatches and caps promotional deliveries at two per category per seven days.
- Delivery metrics expose accepted, failed, expired and skipped counts. Full tests, Prisma validation, type checking, ESLint, build and whitespace checks remain required after deployment configuration changes.

## Category subcategories

- Added Individuals and Small businesses discovery sections for Tutoring & education and Electronics, with Arabic and English copy. Health & fitness is now business-only: its audience banner is removed, forms use the agreed-fee business flow, and the API rejects individual submissions.
- Submission forms retain advertiser type and business requests for posting, authentication or both. Server validation records business fees as awaiting agreement and authentication requests as pending review; client-supplied payment or authentication approvals are ignored.
- Added discovery, form-preview and server validation coverage. No payment collection or business authentication approval workflow is enabled by this change.
- All 92 tests passed with `npm test -- --maxWorkers=2`; TypeScript, ESLint, production build and diff whitespace checks also passed. Default test concurrency again hit the existing five-second language-switch timeout; reducing workers resolved it without changing assertions.
