# ADR-0002 — ERP Core Laravel Runtime Lifecycle & Security Upgrade

- Status: Accepted for Phase 0
- Date: 2026-09-13
- Scope: Callme Yoghurt ERP Core Runtime & Dependency Lifecycle
- Supersedes: Laravel major version selection in ADR-0001 (ADR-0001 remains authoritative for overall architecture)

## Context

During Gate 0C.1 dependency integrity hardening, reproducible dependency locking was established via `composer.lock`, and strict advisory enforcement (`composer audit --locked --no-interaction`) was added to CI without bypasses.

The audit failed closed on three upstream security advisories affecting `laravel/framework` v11.56.1:
- `PKSA-m5cs-t1y6-qpcs` (Medium) — Temporary Signed URL Path Confusion (affected: `<12.61.1|>=13.0.0,<13.12.0`)
- `PKSA-3r5d-mb8f-1qw9` (High) — CRLF injection in default email rule (affected: `<12.60.0|>=13.0.0,<=13.9.0`)
- `PKSA-mdq4-51ck-6kdq` / `CVE-2026-48019` — CRLF injection in default email rule (affected: `>=11.0.0,<12.0.0`)

Upstream Laravel maintainers fixed these issues only in Laravel 12 (`>=12.61.1`) and Laravel 13 (`>=13.12.0`), with no backport to the end-of-life Laravel 11 line. Consequently, Laravel 11:
1. Is outside its security-support window;
2. Cannot satisfy the mandatory zero-advisory Composer policy;
3. Fails closed under Gate 0C CI verification.

While Laravel 12 contains patched releases, its remaining maintenance window is relatively short. Laravel 13 is the current supported major release, providing a stable, supported foundation with a longer operational runway for Callme Yoghurt's enterprise ERP core.

## Decision

The ERP Core (`backend-core`) upgrades from Laravel 11 to Laravel 13.

### Technical Constraints:
1. **PHP Runtime**: `PHP >= 8.3` (required by Laravel 13).
2. **Framework Version**: `laravel/framework ^13.12` (minimum secure version clean of known CVEs and advisories).
3. **Test Framework**: `phpunit/phpunit ^12.0` (required for Laravel 13 compatibility).
4. **Dependency Locking**: A clean, reproducible `backend-core/composer.lock` must be committed to git, resolving `laravel/framework >= 13.12.0`.
5. **Security Enforcement**: `composer audit --locked --no-interaction` remains mandatory with zero bypasses or softening (`policy.advisories.block` remains untouched, no `|| true`).

## Consequences

### Positive
- Completely eliminates all 3 known security advisories on the framework layer.
- Establishes a supported, modern PHP 8.3 + Laravel 13 runtime with full vendor security maintenance.
- Retains reproducible, audited dependency locking for predictable CI and production deployments.

### Trade-offs & Operational Changes
- CI environment updates runner PHP version from 8.2 to 8.3 with all existing required extensions (`mbstring`, `pdo`, `pdo_pgsql`, `pgsql`, `openssl`).
- PHPUnit upgraded to 12.x in `backend-core/composer.json`.
- Framework breaking changes between 11 → 12 → 13 were reviewed (Request Forgery Protection, cache/Redis prefixes, container resolution, serialization safeguards); the lean modular monolith architecture of `backend-core` requires no destructive application rewrites.
- PostgreSQL remains the authoritative system of record; no Gate 0D schema changes or persistence changes are introduced.
- ADR-0001 remains fully authoritative for transactional boundaries, PostgreSQL persistence, Next.js BFF role, and AI layer governance; ADR-0002 supersedes only the framework major version specification.
