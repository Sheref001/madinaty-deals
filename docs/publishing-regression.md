# Publishing database regression — 23 September 2026

## Root cause

Publishing, uploading files, deleting unattached uploads, and submitting residence
verification all acquire a per-user PostgreSQL advisory transaction lock. The
previous query returned PostgreSQL's `void` type directly to Prisma `$queryRaw`.
Prisma failed to deserialize it and aborted the transaction before saving data:

```text
P2010: Failed to deserialize column of type 'void'.
POST /api/submissions: 500 {"error":"Internal server error"}
```

This was reproduced with the application's actual Prisma client and PostgreSQL
16.13, both as a direct SQL query and through the HTTP publishing endpoint. The
old unit-test database doubles returned successful query results, masking the
failure. Healthy `/api/ready` responses only test `SELECT 1`, so they could not
detect this problem either.

All four lock queries now cast their return value to `text`. The lock key,
transaction lifetime, and concurrency protection remain unchanged. No schema
migration, authentication change, or production data repair is required.

## Run the real database regression

Create a disposable local PostgreSQL database whose name ends in `_test`. Run:

```bash
TEST_DATABASE_URL='postgresql://TEST_USER:TEST_PASSWORD@127.0.0.1:5432/madinaty_publish_test' npm run test:publishing
```

Use credentials for that local test database only. The runner refuses remote
hosts and database names without the `_test` suffix. It migrates a uniquely named
schema, starts the actual HTTP handlers on a temporary loopback port, and uses
real database sessions and local file storage. It removes only its own schema
and temporary uploads afterward. It neither uses Cognito nor sends email.

The regression exercises:

- Authenticated Arabic tutoring service publication and database/audit persistence.
- Unauthenticated and invalid-CSRF rejection.
- Image upload, product publication, and retrieval of the resulting public image.
- Another account's image ownership boundary and rejection of already attached photos.
- Business submissions remaining in review and invalid prices being rejected.
- Concurrent free promotions: exactly one succeeds and the other receives HTTP 409.
- Deletion of unattached photos and rejection of attached-photo deletion.
- Residence document submission and rejection of duplicate pending verification.

On the original code the first valid service submission returned 500. With the
cast correction the complete regression passes. The focused submission/upload
unit tests also pass (46 tests). Final checks passed: all 179 existing tests,
ESLint, TypeScript checking, and the production Vite build. Local validation used
Node 23.6.0; the production Docker image uses Node 22.

## Production confirmation

After deploying the fix, publish one normal service or ad using the website.
Confirm it is saved and appears in the appropriate category (or review queue for
business posts). A successful local regression does not prove deployment or
production storage configuration; those still require this production check.
