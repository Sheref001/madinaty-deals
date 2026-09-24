201~200~# Madinaty Deals Architecture

This document describes the verified technical architecture of the Madinaty Deals platform.

Codex should keep this document aligned with the actual repository. Do not invent or assume architecture details that cannot be verified from source code, configuration, or deployment files.

## 1. Platform Purpose

Madinaty Deals is a local digital marketplace and community platform intended to support:

* classified listings,
* local business discovery,
* local services,
* community offers,
* commercial advertising,
* moderation and reporting,
* account management,
* and future expansion to similar community-focused platforms.

The application should be treated as a production system handling real users, user-generated content, authentication, and commercially relevant information.

---

## 2. Repository Structure

The current repository should be documented using the actual directory layout.

Expected high-level areas may include:

```text
/
├── frontend/
├── backend/
├── docs/
├── AGENTS.md
├── README.md
├── docker-compose.yml
└── other project files
```

Codex must inspect the repository before modifying this section.

If the repository structure differs, update this document accordingly.

---

## 3. Frontend

Document the actual frontend implementation after inspection.

Include:

* framework and version,
* frontend directory,
* routing approach,
* state management,
* API client,
* authentication integration,
* localization strategy,
* Arabic/English support,
* RTL support,
* form validation,
* build process,
* environment variables used by the frontend,
* static asset handling.

### Frontend Security Principles

The frontend must never contain:

* database credentials,
* AWS secret keys,
* private API keys,
* admin passwords,
* backend secrets,
* private signing keys.

Any value shipped to the browser must be considered public.

The frontend must not be trusted to enforce authorization.

Server-side authorization is mandatory for sensitive actions.

---

## 4. Backend

Document the actual backend implementation after inspection.

Include:

* framework and version,
* backend directory,
* API structure,
* middleware,
* request validation,
* authentication,
* authorization,
* logging,
* error handling,
* background jobs if any,
* email integration,
* file upload handling,
* database access layer,
* rate limiting,
* admin functionality.

### Backend Responsibilities

The backend is responsible for enforcing:

* authentication,
* authorization,
* input validation,
* moderation permissions,
* user suspension rules,
* admin-only operations,
* rate limiting,
* secure data access,
* data integrity.

Frontend restrictions alone must never be treated as sufficient access control.

---

## 5. Database

Primary database:

```text
PostgreSQL
```

Document the actual database implementation, including:

* database library or ORM,
* schema organization,
* migrations,
* relationships,
* indexes,
* constraints,
* transaction usage,
* backup strategy,
* production database location,
* connection management.

### Database Rules

All queries involving user input must use parameterized queries or safe ORM/query-builder mechanisms.

Schema changes must use migrations.

Avoid direct manual schema modification in production unless explicitly required and carefully reviewed.

Destructive migrations must consider:

* backups,
* rollback,
* existing production data,
* null values,
* foreign keys,
* unique constraints,
* application compatibility.

---

## 6. Authentication

Document the actual authentication system after repository inspection.

Current or planned external services may include AWS Cognito.

Document:

* account registration,
* email verification,
* login,
* logout,
* token validation,
* token expiration,
* refresh/session behavior,
* account suspension,
* account deletion,
* password reset,
* social login if implemented.

Do not assume that AWS Cognito is configured in a particular way unless verified from the repository or infrastructure.

---

## 7. Authorization

Authorization must be separate from authentication.

Document:

* user roles,
* admin roles,
* moderator roles,
* business account permissions if applicable,
* listing ownership rules,
* moderation permissions,
* report handling,
* suspension permissions.

All sensitive permissions must be enforced by the backend.

---

## 8. Email Infrastructure

Document the actual email architecture.

Amazon SES may be used for transactional email.

Document:

* sending provider,
* verified sender identities,
* email templates,
* email verification,
* OTP or account-verification workflows,
* bounce handling,
* complaint handling,
* unsubscribe handling where applicable,
* sending-domain configuration.

Never expose SES credentials in frontend code.

---

## 9. OTP and Verification

If OTP or verification codes are used, document:

* where codes are generated,
* expiration period,
* storage method,
* number of permitted attempts,
* rate limiting,
* resend rules,
* invalidation after successful use.

OTP codes must never be permanently stored in plaintext.

---

## 10. File and Image Uploads

If the application supports uploads, document:

* accepted file types,
* maximum size,
* storage provider,
* generated filenames,
* validation,
* image processing,
* public/private access,
* deletion behavior.

User-provided filenames must not determine arbitrary server paths.

---

## 11. Admin and Moderation

Document the admin architecture.

This should include:

* admin authentication,
* role checks,
* dashboard access,
* user suspension,
* listing moderation,
* report resolution,
* business management,
* ad management,
* audit logging.

Administrative actions should be traceable wherever practical.

---

## 12. Infrastructure

Current infrastructure includes an Ubuntu server and Docker.

Document the verified deployment topology, including:

* Ubuntu version if relevant,
* Docker services,
* reverse proxy,
* application containers,
* database service,
* persistent volumes,
* networks,
* exposed ports,
* SSL/TLS termination,
* DNS,
* health checks,
* restart policies.

Do not expose internal services publicly unless necessary.

---

## 13. Docker

Document:

* Dockerfiles,
* Docker Compose files,
* build stages,
* container responsibilities,
* environment injection,
* volumes,
* networking,
* production differences.

Docker configuration must support reproducible builds.

Sensitive values must not be hard-coded into images.

---

## 14. Reverse Proxy

If Nginx, Traefik, Caddy, Apache, or another reverse proxy is used, document:

* public ports,
* backend routing,
* frontend routing,
* TLS termination,
* forwarded headers,
* upload-size limits,
* security headers.

---

## 15. CORS

Document the actual allowed origins.

Authenticated APIs should use explicit trusted origins.

Avoid wildcard CORS for credentialed endpoints.

Allowed origins should normally be configurable by environment.

---

## 16. Environment Variables

Document required variables without storing secret values.

Example categories:

```text
DATABASE_URL
AWS_REGION
COGNITO_USER_POOL_ID
COGNITO_CLIENT_ID
SES_FROM_EMAIL
ALLOWED_ORIGINS
APP_ENV
PORT
```

Actual variable names must be taken from the repository.

Do not put production secret values in this document.

---

## 17. Logging and Monitoring

Document:

* application logs,
* container logs,
* error logs,
* access logs,
* monitoring services,
* alerting,
* retention.

Logs must not expose:

* passwords,
* OTP codes,
* access tokens,
* refresh tokens,
* authorization headers,
* private keys,
* AWS secrets,
* database credentials.

---

## 18. External Services

Document any verified external services, including:

* AWS Cognito,
* Amazon SES,
* storage providers,
* analytics,
* maps,
* payment providers,
* OAuth providers,
* monitoring services.

For each integration, document:

* purpose,
* responsible application component,
* configuration source,
* required environment variables,
* security considerations.

---

## 19. Git and Source Control

Document:

* Git provider,
* primary branch,
* development branches if used,
* branch protection,
* CI/CD integration,
* deployment triggers.

The current primary branch is expected to be:

```text
main
```

Codex should verify this before relying on it.

---

## 20. CI/CD

If CI/CD exists, document:

* provider,
* workflow files,
* test steps,
* build steps,
* security checks,
* deployment triggers,
* rollback behavior.

If CI/CD does not yet exist, state that clearly.

---

## 21. Production Boundaries

Source-code changes, Git pushes, and production deployments are separate actions.

A successful Git push does not necessarily mean production has changed.

This distinction must remain explicit in both architecture and deployment documentation.

---

## 22. Architecture Maintenance Rule

Whenever Codex makes a change that materially affects:

* frontend structure,
* backend structure,
* authentication,
* authorization,
* database design,
* AWS integration,
* email,
* Docker,
* deployment,
* admin functionality,
* infrastructure,

Codex should review whether this document also needs to be updated.

This document must describe the real system, not the intended system.
