# Madinaty Deals — Codex Instructions

This repository contains the Madinaty Deals application.

Codex must treat this as a production-grade system handling real users,
authentication, user-generated content, and business data.

## Required Documentation

Before making relevant changes, read:

- `docs/ARCHITECTURE.md` for system architecture.
- `docs/SECURITY.md` for security requirements.
- `docs/DEVELOPMENT.md` for development and Git procedures.
- `docs/DEPLOYMENT.md` for Docker, deployment, CI/CD, and production 
rules.

## Standard Workflow

Before modifying code:

1. Inspect the relevant existing implementation.
2. Run `git status`.
3. Confirm the current branch.
4. Pull safely using `git pull --ff-only`.
5. Read the relevant documentation.
6. Preserve existing architecture and production data.

After implementing a requested change:

1. Run relevant tests.
2. Run linting, type checks, and builds where applicable.
3. Review `git diff`.
4. Run `git diff --check`.
5. Check that no secrets or credentials were introduced.
6. Commit only files related to the current task.
7. Push the commit to the configured Git remote.
8. Report the commit hash, validation results, and push status.

## Git Rules

Never discard existing uncommitted work without explicit authorization.

Do not use destructive commands such as:

- `git reset --hard`
- `git clean -fd`
- `git restore .`
- `git checkout -- .`

unless explicitly instructed.

Do not blindly use `git add .` when unrelated changes exist.

## Security

Security and data integrity take priority over implementation speed.

Never:

- commit secrets or credentials,
- expose private credentials in frontend code,
- bypass authentication or authorization,
- solve CORS issues by allowing all origins without justification,
- disable TLS verification,
- expose database ports unnecessarily,
- weaken security controls merely to make a feature work.

Follow `docs/SECURITY.md`.

## Production Deployment

A Git push and a production deployment are different operations.

Codex may commit and push successfully completed work.

Codex must not manually deploy to production unless explicitly requested
or unless the repository contains an approved automated deployment 
pipeline.

## Definition of Done

A task is complete only when applicable checks have passed and:

- implementation is complete,
- security implications have been reviewed,
- tests have passed,
- build succeeds where applicable,
- diff has been reviewed,
- commit has been created,
- commit has been pushed successfully.

Never claim a test, build, commit, push, or deployment succeeded unless
it was actually executed successfully.
