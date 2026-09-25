201~200~# Madinaty Deals Deployment Policy

This document defines how Madinaty Deals changes move from local development to Git and eventually to production.

The optional S3 photo path is off by default. Provision and test the private bucket and Lambda worker per `docs/S3_PHOTOS.md` before setting `PHOTO_STORAGE=s3` in the production environment. A Git push or normal app rebuild does not create these AWS resources. Keep the existing upload volume because private verification evidence and any older local photos still use it.

Deployment safety, data integrity, and rollback capability take priority over speed.

## 1. Core Deployment Principle

These are separate operations:

1. editing code,
2. testing code,
3. committing code,
4. pushing code to Git,
5. deploying code to production.

Codex must not treat them as equivalent.

A successful push does not automatically mean that production should be changed.

---

## 2. Default Codex Responsibility

Unless explicitly instructed otherwise, Codex may:

* inspect the repository,
* modify source code,
* modify documentation,
* run tests,
* run linting,
* run type checks,
* run builds,
* inspect Git diffs,
* commit completed work,
* push completed commits.

Codex must not manually deploy to production unless:

* the user explicitly requests it, or
* the repository contains an approved automated deployment pipeline that intentionally deploys after push.

---

## 3. Standard Local Workflow

Before making changes:

```bash
git status
git branch --show-current
git pull --ff-only
```

Confirm that:

* the repository is clean or existing changes are understood,
* the correct branch is active,
* the latest remote changes are present.

Never overwrite unrelated local work.

---

## 4. Implementation

Codex should make the smallest correct change required by the task.

Avoid:

* unrelated refactoring,
* unnecessary dependency additions,
* infrastructure changes unrelated to the request,
* manual production changes during ordinary feature work.

---

## 5. Validation Before Commit

Run the checks that actually exist in the project.

Examples may include:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

or equivalent backend commands.

Before committing:

```bash
git diff
git diff --check
git status
```

Verify:

* only intended files changed,
* no debug code remains,
* no secret values were introduced,
* tests pass,
* builds succeed where applicable,
* migrations have been reviewed,
* security-sensitive changes have been checked.

---

## 6. Commit

Stage only task-related files.

Prefer:

```bash
git add path/to/file1 path/to/file2
```

Avoid blindly using:

```bash
git add .
```

when unrelated changes exist.

Use descriptive commit messages, for example:

```text
feat: add admin report resolution workflow
fix: correct production CORS validation
security: add authentication rate limiting
docs: document deployment process
```

---

## 7. Push

After a successful commit:

```bash
git push
```

If push fails, Codex must:

* report the failure,
* preserve the local commit,
* not claim the task was pushed successfully.

---

## 8. Production Deployment

Production deployment must be treated as a separate controlled operation.

Before deploying, determine:

* what commit will be deployed,
* whether the database schema changes,
* whether environment variables change,
* whether containers will restart,
* whether downtime is expected,
* whether rollback is possible,
* whether persistent data is affected.

---

## 9. Ubuntu Production Server

The production Ubuntu server must be treated as sensitive infrastructure.

Codex must not:

* modify production files casually,
* change firewall rules without understanding impact,
* expose internal ports unnecessarily,
* store production credentials in shell history or Git,
* disable TLS,
* remove authentication,
* expose database services publicly without justification,
* run destructive shell commands without understanding their impact.

---

## 10. Docker Deployment

Before Docker-related deployment changes, inspect:

* Dockerfile,
* docker-compose files,
* environment configuration,
* service dependencies,
* ports,
* networks,
* volumes,
* restart policies.

Deployment must preserve persistent data.

Never remove production volumes merely to fix a container problem unless data loss has been explicitly understood and authorized.

---

## 11. Environment Variables

Production configuration should be stored outside Git.

Examples may include:

```text
DATABASE_URL
AWS_REGION
COGNITO_USER_POOL_ID
COGNITO_CLIENT_ID
SES_FROM_EMAIL
ALLOWED_ORIGINS
APP_ENV
```

Actual variable names must be verified from the repository.

Never commit:

* production `.env` files,
* AWS credentials,
* database passwords,
* API secrets,
* JWT secrets,
* private keys.

---

## 12. Database Migrations

Database migrations require special care.

Before applying a migration to production:

1. inspect the migration,
2. determine whether it is destructive,
3. consider current data,
4. consider rollback,
5. confirm application compatibility,
6. confirm backup availability where appropriate.

Avoid production schema changes that require simultaneous incompatible application changes when a backward-compatible sequence is possible.

---

## 13. Backups

Before high-risk production changes, confirm that adequate backups exist.

High-risk changes include:

* destructive database migrations,
* major schema changes,
* storage migrations,
* container-volume changes,
* bulk data updates.

Backup procedures should eventually be documented in a dedicated operational document.

---

## 14. Rollback

Every meaningful deployment should have a rollback strategy.

Possible rollback mechanisms include:

* redeploying the previous Git commit,
* reverting the current commit,
* restoring the previous container image,
* rolling back a database migration where safe,
* restoring from backup if necessary.

Do not assume application rollback automatically reverses database changes.

---

## 15. Health Checks

After deployment, verify application health.

Depending on the architecture, this may include:

* frontend loads successfully,
* backend API responds,
* authentication works,
* database connectivity works,
* listing creation works,
* admin area works,
* email sending works,
* container health is normal,
* logs show no major errors.

---

## 16. Logs After Deployment

Inspect relevant logs after production deployment.

Examples may include:

```bash
docker compose ps
docker compose logs --tail=100
```

Use actual service names and commands appropriate to the repository.

Do not expose secret values from logs.

---

## 17. Production Testing

After deployment, use low-risk smoke tests.

Examples:

* open the website,
* log in with a test account,
* verify a public listing,
* verify search,
* verify admin dashboard access,
* verify key API endpoints.

Avoid destructive testing against real production user data.

---

## 18. Deployment Failure

If a deployment fails:

1. stop making unrelated changes,
2. inspect logs,
3. identify the failing component,
4. determine whether rollback is safer than forward-fixing,
5. preserve production data,
6. report the exact failure.

Do not repeatedly restart or rebuild services without understanding the failure.

---

## 19. Security During Deployment

Never solve deployment issues by weakening security controls.

Do not:

* allow all CORS origins,
* disable authentication,
* disable TLS verification,
* expose the database publicly,
* hard-code secrets,
* make admin APIs public,
* disable validation.

Fix the underlying configuration problem instead.

---

## 20. SSH Access

Production SSH access must be treated as privileged.

Prefer:

* SSH keys,
* restricted users,
* least privilege,
* controlled sudo access.

Avoid sharing long-lived production passwords unnecessarily.

Never commit SSH private keys.

---

## 21. CI/CD Future State

The preferred future model is:

```text
Developer / Codex
        ↓
        Local validation
                ↓
                Git commit
                        ↓
                        Push to repository
                                ↓
                                Automated tests
                                        ↓
                                        Build
                                                ↓
                                                Security checks
                                                        ↓
                                                        Controlled deployment
                                                                ↓
                                                                Health verification
                                                                ```

                                                                Production deployment should eventually be automated only after the pipeline is stable and well understood.

                                                                ---

                                                                ## 22. Branch Policy

                                                                The primary production branch is expected to be:

                                                                ```text
                                                                main
                                                                ```

                                                                Codex must verify this from Git before relying on it.

                                                                If branch protection or staging branches are later introduced, this document must be updated.

                                                                ---

                                                                ## 23. Manual Deployment Policy

                                                                Until a trusted CI/CD pipeline exists:

                                                                * Codex may commit,
                                                                * Codex may push,
                                                                * Codex must not manually deploy to the production Ubuntu server unless explicitly requested.

                                                                This restriction is intentional.

                                                                ---

                                                                ## 24. Definition of Deployment Done

                                                                A production deployment is complete only when:

                                                                * the intended commit is deployed,
                                                                * required migrations are complete,
                                                                * containers/services are healthy,
                                                                * logs have been checked,
                                                                * application smoke tests pass,
                                                                * critical functionality works,
                                                                * no severe security issue is introduced,
                                                                * rollback remains understood.

                                                                ---

                                                                ## 25. Deployment Reporting

                                                                After any production deployment, report:

                                                                ```text
                                                                Deployed commit:
                                                                Deployment method:
                                                                Database migration:
                                                                Services restarted:
                                                                Health checks:
                                                                Smoke tests:
                                                                Errors:
                                                                Rollback status:
                                                                Manual follow-up:
                                                                ```

                                                                Never state that deployment succeeded unless production was actually verified.

                                                                ---

                                                                ## 26. Documentation Maintenance

                                                                Whenever the deployment architecture changes, update this file.

                                                                Examples include:

                                                                * adding CI/CD,
                                                                * changing hosting provider,
                                                                * changing Docker topology,
                                                                * adding staging,
                                                                * adding a reverse proxy,
                                                                * changing production branches,
                                                                * changing database hosting,
                                                                * adding automated migrations,
                                                                * adding rollback automation.

                                                                This document must reflect the actual deployment process, not an outdated intended process.
                                                                
