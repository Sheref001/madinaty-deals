# Madinaty Deals Security Policy

Security is a mandatory requirement for all changes.

## Secrets

Never commit:

- database passwords,
- AWS access keys,
- AWS secret keys,
- API keys,
- JWT secrets,
- OAuth secrets,
- SMTP credentials,
- SSH private keys,
- production `.env` files,
- admin passwords.

Use environment variables or an approved secrets-management system.

## Authentication

Authentication must use the project's established authentication 
architecture.

Authentication changes must verify:

- token validity,
- expiration,
- issuer,
- audience/client,
- account status,
- session behavior.

## Authorization

Every sensitive backend operation must enforce authorization server-side.

Frontend restrictions are not sufficient.

Special care is required for:

- admin operations,
- moderation,
- user suspension,
- listing modification,
- listing deletion,
- reports,
- account management.

## Input Validation

Treat all user input as untrusted.

Validate inputs server-side.

Use parameterized queries or the established ORM/query layer.

## Common Vulnerabilities

Consider where relevant:

- SQL injection
- XSS
- CSRF
- SSRF
- IDOR
- broken access control
- privilege escalation
- path traversal
- insecure file uploads
- insecure CORS
- credential leakage
- brute-force attacks
- account enumeration
- denial-of-service risks

## Logging

Never log:

- passwords,
- OTP codes,
- authentication tokens,
- refresh tokens,
- authorization headers,
- AWS credentials,
- database credentials.

## Error Handling

Production responses must not expose:

- stack traces,
- database queries,
- internal paths,
- secrets,
- infrastructure details.

## Rate Limiting

Evaluate rate limiting for:

- login,
- registration,
- OTP requests,
- verification,
- password reset,
- posting listings,
- messaging,
- reports,
- search.

## File Uploads

Validate:

- MIME type,
- extension,
- file size,
- storage path,
- generated filename.

Do not trust user-supplied filenames.

## AWS

Follow least-privilege IAM principles.

AWS credentials must never be placed in frontend code or committed to Git.

## Security Review

Before committing security-sensitive changes:

1. inspect the diff,
2. verify authorization,
3. verify input validation,
4. inspect for secret leakage,
5. test failure conditions,
6. consider abuse cases.
