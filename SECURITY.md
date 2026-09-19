# Security implementation status

## Implemented controls

- Email login codes are hashed, expire after ten minutes, allow at most five guesses and are consumed once. Opaque session tokens are stored as hashes; production cookies use Secure, HttpOnly and SameSite=Lax.
- Mutations require the configured origin and session-derived CSRF token. Production login verifies Turnstile hostname and action on the server.
- PostgreSQL counters limit authentication, uploads, verification requests, submissions and comments across instances. The general request limiter remains per process. Forwarded addresses are trusted only through explicitly configured proxy peers.
- Uploads require authentication, size limits and malware scanning. Images are decoded and re-encoded; files use random private storage keys. Reads require ownership or reviewer privileges and create audit records.
- Photo attachment checks enforce ownership, purpose, readiness and size. Verified residents can submit one rental per Cairo calendar month; account-level database locks serialize quota and attachment operations.
- Resident verification decisions require reviewer roles, prevent self-review and reject already-decided requests. Listing/service submissions await review; comments start hidden.
- Streaming request limits, security headers and a non-root, read-only container provide additional controls.

## Remaining release work

Configure and validate SMTP, Turnstile, private storage, scanner signatures, trusted proxies and TLS using [DEPLOYMENT.md](./DEPLOYMENT.md). Run the integration script against actual local services, then validate staging with production providers. Unit tests use database doubles and cannot establish database concurrency guarantees or service readiness.

Build the moderation dashboard and marketplace publication workflow. Agree on retention/deletion for submitted identity documents; the cleanup job only removes expired auth records and old unattached uploads. Configure backups and restoration checks, dependency audits and a release security review. Public inventory remains illustrative and payments are disabled.
