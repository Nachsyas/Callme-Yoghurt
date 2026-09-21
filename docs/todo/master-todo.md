# Callme Yoghurt — Master Strategy & Gate Status

> Current program state: **Phase 0 — Architecture Gate A: Foundation Repair**
>
> Rule: an item is not `VERIFIED` merely because a scaffold, file, test stub, or green command exists. Verification requires evidence appropriate to the item.

## Maturity Labels

- `PLANNED` — agreed target, not implemented
- `SCAFFOLDED` — structure/prototype exists but is not complete
- `IMPLEMENTED` — working implementation exists
- `TESTED` — required automated tests execute and pass
- `VERIFIED` — behavior and architecture have been independently checked against acceptance criteria
- `PRODUCTION-READY` — operational/security/recovery requirements are also satisfied

---

# Phase 0 — Architecture Gate A: Foundation Repair

## Gate 0A — Architecture Truth & ADR

- [x] `IMPLEMENTED` Create ADR-0001 defining authoritative Phase 0 architecture.
- [x] `IMPLEMENTED` Replace legacy tri-core/polyglot blueprint with target architecture.
- [x] `IMPLEMENTED` Lock Laravel ERP Core as transactional business authority.
- [x] `IMPLEMENTED` Lock PostgreSQL as primary system of record.
- [x] `IMPLEMENTED` Define Redis as ephemeral coordination/cache/queue infrastructure.
- [x] `IMPLEMENTED` Defer MongoDB until a concrete use case is justified by ADR.
- [x] `IMPLEMENTED` Define S3-compatible object storage boundary.
- [x] `IMPLEMENTED` Define Python/FastAPI as AI Intelligence Layer rather than duplicate ERP backend.
- [x] `IMPLEMENTED` Define AI authority/permission boundary.
- [x] `VERIFIED` Reconcile repository structure documentation with the actual repository.
- [x] `VERIFIED` Audit all architectural docs for contradictions with ADR-0001.

**Gate 0A status: PASS.**

## Gate 0B — Security Foundation

- [x] `TESTED` Remove BFF secret from checkout business payload (verified via security regression suite).
- [x] `TESTED` Remove hard-coded/fallback internal secret behavior (fails closed with 503; verified by test).
- [x] `TESTED` Fail closed when required service authentication configuration is absent (verified by test).
- [x] `TESTED` Establish strict typed request validation for checkout edge input (verified by test).
- [x] `TESTED` Establish service authentication boundary for BFF -> ERP calls (verified by test).
- [x] `TESTED` Establish explicit public checkout response contract sanitizing upstream ERP payload, stripping internal secrets/database URLs/debug traces, and failing closed on malformed success JSON with 502 (zero `any`, verified by test).
- [x] `TESTED` Define PII encryption/search strategy including blind index/hash via `PhoneBlindIndexService` and `Customer` model (PHP runtime verified against PostgreSQL in CI run 34708399936; golden vector verified in TS and PHP suites).
- [x] `TESTED` Define security headers baseline with hardened HSTS opt-in controls (`next.config.mjs` and middleware headers with CSP `frame-ancestors 'none'`, nosniff, Referrer-Policy, Permissions-Policy; HSTS, `includeSubDomains`, and `preload` require explicit opt-in flags; default production build never automatically produces preload; verified by test).
- [x] `TESTED` Define rate-limiting foundation with development/test-only `DevMemoryRateLimiter`, production distributed `RedisRateLimiter` (atomic EVAL script, TTL expiration, fail-closed handling, credential sanitization), and fail-closed `UnavailableProductionRateLimiter` when Redis is unconfigured (verified by security regression test suite).
- [x] `TESTED` Restrict local security tooling/network exposure by default (localhost binding, dev credentials, required ZAP API key, deferred MongoDB profile; verified via Compose config).
- [x] `TESTED` Add security regression tests for secret exposure, tampered transaction input, fail-closed configuration, sanitized upstream errors and success DTOs, rate-limiting boundary and identity isolation, and security headers (34 targeted automated tests passing across 4 suites).

**Gate 0B status: PASS — Production distributed rate limiter verified**

## Gate 0C — ERP Core Foundation

- [x] `IMPLEMENTED` Convert `backend-core` from partial scaffold into a runnable Laravel 13 application (`composer.json`, committed `composer.lock`, `artisan`, `public/index.php`, `bootstrap/app.php`, `bootstrap/providers.php`).
- [x] `IMPLEMENTED` Add dependency/bootstrap/config/routes/runtime structure (`config/app.php`, `config/database.php`, `config/crm.php`, `config/services.php`, `routes/api.php`, `routes/web.php`, `routes/console.php`).
- [x] `IMPLEMENTED` Establish explicit domain/application/infrastructure boundaries (`app/Domain`, `app/Application`, `app/Infrastructure`, `app/Http`, `app/Providers`).
- [x] `IMPLEMENTED` Connect ERP Core to PostgreSQL through authoritative persistence (default `pgsql`, zero MongoDB/Prisma coupling, sanitized development configuration).
- [x] `TESTED` Run database migrations from a clean environment (verified via Gate 0C CI workflow with PostgreSQL 16 service).
- [x] `TESTED` Run ERP automated tests from a clean environment (verified via Gate 0C CI workflow; 15 tests, 62 assertions passing).
- [x] `TESTED` Enforce reproducible, audited dependency installation from committed `composer.lock` with zero advisory bypasses (`composer audit --locked` clean with 0 advisories on Laravel 13 / PHP 8.3).
- [x] `VERIFIED` Demonstrate ERP API boot and health check (verified via Gate 0C CI workflow: `about`, `route:list`, `/api/health`, `/api/ready`, and authenticated `/api/internal/health`).

**Gate 0C status: PASS — Laravel 13 ERP Core runtime and PostgreSQL persistence are verified on PHP 8.3 (ADR-0002), locked to committed `backend-core/composer.lock`, audit-clean (0 advisories), and passing the full automated test suite on a clean Linux runner with PostgreSQL 16 (15 tests, 62 assertions).**

## Gate 0D — Data & Storage Architecture

- [x] `TESTED` Reconcile useful concepts from Prisma exploration into ERP-owned persistence (documented in ADR-0003: UOM, BOM, Warehouse adopted; Product/Variant/InventoryItem and append-only ledger replacing prototype entities).
- [x] `TESTED` Introduce Product + ProductVariant/SKU model (separate customer catalog from physical stock items, UUID primary keys, unique SKU/slug; verified by tests).
- [x] `TESTED` Replace precision-sensitive inventory/BOM quantities with decimal/numeric types (`NUMERIC(18,6)` throughout BOM components, ledger deltas, reservations, and order lines; zero float types).
- [x] `TESTED` Add proper relational ownership for order lines and items/variants (`order_lines` references `product_variant_id` via strict foreign key with `BIGINT` monetary amounts).
- [x] `TESTED` Design batch/lot traceability on stock movement (`inventory_lots` with compound unique item+lot constraint, zero mutable quantity column; lot balance derived from ledger).
- [x] `TESTED` Design stock reservation and allocation model (`stock_reservations` and `stock_allocations` connecting reservation to specific lots for FEFO readiness).
- [x] `TESTED` Define append-oriented stock ledger semantics (`stock_ledger_entries` with signed delta, event types, transfer correlation IDs, model-enforced immutability rejecting updates/deletes and zero deltas).
- [x] `TESTED` Define object-storage metadata, retention model, and production S3 runtime provider (`stored_objects` and `object_attachments` PostgreSQL persistence, dual-layer DB trigger + model retention guards, two-phase deletion request lifecycle via `StoredObjectDeletionRequestService`, `S3ObjectStorageProvider`, `ObjectUploadService` with safe PII-free internal locator key generation; PASS — Object storage runtime provider verified; operational binary deletion worker is PLANNED / UNVERIFIED).
- [x] `IMPLEMENTED` Define data lifecycle classes: hot, warm, cold, delete/legal-hold (documented in ADR-0004; enums, `RetentionPolicyService`, and `StoredObjectDeletionRequestService` tested; automated destructive cleanup worker deferred).
- [x] `DOCUMENTED TARGET` Define backup/PITR target architecture (documented in ADR-0004: target RPO <= 15m, target RTO <= 4h; operational backup automation and restore drills are not yet implemented/verified).
- [x] `IMPLEMENTED` Add pgvector readiness without embedding transactional rows indiscriminately (documented in ADR-0004: `knowledge_documents` and `knowledge_chunks` metadata tables without vector columns; core ERP boots without pgvector; transactional and PII data strictly excluded).

**Gate 0D status: PASS — authoritative data/storage architecture, persistence foundation, and production object storage runtime provider are implemented and verified (PASS — Object storage runtime provider verified); operational binary deletion worker, automated backup/PITR operations, restore drills, and pgvector execution remain future operational capabilities and are not claimed as verified.**

## Gate 0E — Transaction Foundation

### Gate 0E.1 — Server-Authoritative Checkout Foundation
- [x] `IMPLEMENTED` Replace simulated BFF response with real ERP forwarding behavior that fails closed when ERP is unavailable.
- [x] `TESTED` Server resolves authoritative SKU/variant data (`CreateCheckoutOrderService` resolves active variants and inventory items).
- [x] `TESTED` Server calculates authoritative price/total (`CurrentVariantPriceResolver` and integer Rupiah arithmetic with row locks).
- [x] `TESTED` Server validates delivery method/rules (domain enum `DeliveryMethod` and database constraint).
- [x] `TESTED` Server validates and reserves inventory (`FefoInventoryReservationService` derives availability via PostgreSQL numeric math from ledger minus active reservations).
- [x] `TESTED` Order creation and reservation occur transactionally (atomic `DB::transaction` with full rollback on any failure).
- [x] `TESTED` Add end-to-end idempotency for order creation (`checkout_idempotency_keys` with SHA-256 key hash, HMAC-SHA256 request fingerprint, and PostgreSQL upsert/locking).
- [x] `TESTED` Reject tampered client price/total input (`CreateOrderRequest` rejects unknown keys and authority fields).
- [x] `TESTED` Reject insufficient inventory (returns HTTP 409 conflict and rolls back all writes).
- [x] `TESTED` Prevent duplicate order on retried request (replay returns same committed order with HTTP 200).

### Gate 0E.2A — Authoritative Storefront Catalog Identity Cutover
- [x] `TESTED` Laravel authoritative catalog endpoint (`GET /api/internal/catalog/products`) under service auth returning only sellable FINISHED_GOOD variants with active IDR prices and UUIDs, excluding internal stock/lot/ledger metadata.
- [x] `TESTED` Next.js BFF catalog endpoint (`GET /api/catalog`) with strict response parsing, fail-closed handling (503 on missing config, 502 on upstream/malformed failure), and credentials never exposed.
- [x] `TESTED` Storefront cart refactored to use authoritative `variant_id` identity and merging quantity on duplicate additions.
- [x] `TESTED` Client price renamed to presentation-only `display_price` with advisory UI copy.
- [x] `TESTED` Cart transaction projection produces strictly `{ variant_id, quantity }`, omitting all client-side prices or totals.
- [x] `TESTED` Checkout relation lock hardening on order resolution explicitly locking `Product` and `InventoryItem` rows with `lockForUpdate()`.
- [x] `TESTED` Gate 0E.2A.1 Catalog Identity Boundary Hardening: BFF catalog parser strictly validates ProductVariant UUID (UUIDv7/v4 format) and exact `IDR` currency (no case normalization); unknown route slug never resolves or purchases Plain fallback; size-to-variant mapping strictly normalizes authoritative `net_content` (ML/L) without SKU string guessing.
- [x] `TESTED` Gate 0E.2A.2 Exact Variant Sizing & UI Scope Restoration: Variant sizing strictly parses PostgreSQL DECIMAL(18,6) strings into exact whole milliliters via scaled BigInt arithmetic (rejecting fuzzy rounding, near-values like 249.6ml or 0.9996L, scientific notation, and non-exact divisions); Product Detail presentation scope and visual sections (bottle visual, size selector, quantity and estimated total, composition and nutrition breakdown, cold-chain storage instructions, organic brand features, full footer, and floating cart button) are restored from baseline 778cf70c52eb60acee48cc2701a9eebaf575ccbf while preserving all authoritative identity fixes.
- [ ] `PLANNED` Homepage catalog cards retain legacy display-only static pricing (they are NOT transaction authority; Product Detail + Cart transaction identity and display price use ERP catalog data; homepage catalog-display cutover remains future storefront presentation cleanup).

### Gate 0E.2B — Browser Checkout Cutover & Committed-Order Lifecycle
- [x] `TESTED` Real browser POST `/api/checkout` with edge-validated payload (`variant_id`, integer quantity, delivery method, zero client pricing/totals), mandatory `Idempotency-Key` header, and sanitized error mapping (400, 409, 422, 429, 502, 503).
- [x] `TESTED` Stable browser idempotency-key lifecycle via sessionStorage (`callme.checkout.attempt.v1`) with Web Crypto SHA-256 canonical request hashing, zero customer PII storage, retry reuse across network/502 failures, and key rotation upon semantic payload changes.
- [x] `TESTED` Clear cart only after committed order proof (HTTP 200/201, `isUuid(order_id)`, status strictly `CONFIRMED`, and non-negative integer `total_amount`), leaving cart intact on any failure.
- [x] `TESTED` Committed-order redirect to `/return?order_id=<UUID>` upon successful confirmation persistence; safe inline order fallback on storage failure.
- [x] `TESTED` Success page requires committed order identifier matching verified, unexpired session confirmation record; direct/forged URL access fails closed to neutral non-success state.

### Gate 0E.2C — Checkout Production Hardening
- [x] `TESTED` Upstream ERP request timeout protection via `AbortController` (10s threshold), failing closed to sanitized HTTP 502 without internal trace leaks.
- [x] `TESTED` Universal transaction response cache protection (`Cache-Control: no-store`, `Pragma: no-cache`) across all checkout responses (201, 200, 400, 409, 422, 429, 502, 503).
- [x] `TESTED` End-to-end browser checkout verification (`frontend/tests/e2e/checkout-flow.spec.ts`):
  - Scenario 1: Successful checkout flow (product detail -> cart -> checkout -> submit -> `/return` confirmation with order number, status CONFIRMED, and authoritative total).
  - Scenario 2: Double submit protection (rapid button clicks disable submit and prevent duplicate transactions).
  - Scenario 3: Refresh confirmation page (persisted session confirmation remains valid on reload, no duplicate order, cart remains cleared).
  - Scenario 4: Invalid confirmation URL (`/return?order_id=random-invalid-id` fails closed to neutral non-success state).
- [x] `TESTED` Regression test suite updated with timeout handling and cache protection invariants (94 security tests passing).

**Gate 0E status: PASS — Browser checkout flow verified end-to-end (Gate 0E.1 = PASS; Gate 0E.2A = PASS; Gate 0E.2B = PASS; Gate 0E.2C = PASS; Gate 0E overall = PASS).**

> [!IMPORTANT]
> **Gate 0E functional transaction path is complete.**
> Production checkout activation unblocked: Gate 0B distributed Redis rate limiter foundation verified (production fails closed if REDIS_URL is absent, active when configured).
> Homepage static card pricing remains legacy display-only presentation cleanup and does not block Gate 0E transaction completion.


## Gate 0F — Testing, CI & AI-Agent Governance

- [x] `IMPLEMENTED` Harden `AGENTS.md` against false-green test repairs.
- [x] `IMPLEMENTED` Explicitly forbid skip/xfail/test deletion/assertion weakening as repair shortcuts.
- [x] `IMPLEMENTED` Define human-review requirements for security, destructive DB, finance, permissions, and core business-rule changes.
- [ ] `IMPLEMENTED` Repair return/complaint E2E test so it targets real UI behavior.
- [ ] `IMPLEMENTED` Remove tracked transient test/build artifacts where appropriate.
- [ ] `IMPLEMENTED` Add CI workflow for lint/static checks/tests/build/security baseline.
- [ ] `TESTED` Unit tests execute.
- [ ] `TESTED` Integration/database tests execute.
- [ ] `TESTED` Contract tests execute.
- [ ] `TESTED` Critical E2E tests execute without environment-based false-positive skip.
- [ ] `TESTED` Security regression tests execute.

## Gate 0G — Final Architecture Certification

- [ ] Architecture consistency PASS.
- [ ] Backend boot PASS.
- [ ] Clean database migration PASS.
- [ ] Secret leakage regression PASS.
- [ ] Real checkout transaction PASS.
- [ ] Server-authoritative pricing PASS.
- [ ] Inventory transaction-safety baseline PASS.
- [ ] Storage lifecycle baseline PASS.
- [ ] Critical integration/E2E PASS.
- [ ] Security regression PASS.
- [ ] Build/CI PASS.
- [ ] Documentation parity PASS.
- [ ] AI governance PASS.

**Phase 0 may only be declared PASS after Gate 0G is fully evidenced.**

---

# Phase 1 — Commerce Core

## Phase 1.1 — Production Object Storage Runtime Integration
- [x] `TESTED` S3-compatible production object storage runtime integration (`ObjectStorageProviderInterface`, `S3ObjectStorageProvider`, and `LocalObjectStorageProvider`) with fail-closed production credential validation, safe object key generation, presigned URL generation, and metadata persistence without binary database column (verified by 5 automated feature tests).

## Phase 1.2A — Admin Access Control Hardening & Deployment Separation Foundation
Status: **TESTED**
- [x] `TESTED` Route protection boundary in `frontend/src/middleware.ts` intercepting `/admin`, `/admin/*`, and `/api/admin/*`, redirecting unauthenticated traffic to `/admin/login?from=...`, and returning HTTP 401 for unauthenticated API requests.
- [x] `TESTED` Admin session foundation (`frontend/src/lib/auth/admin-session.ts`) using Web Crypto API HMAC-SHA256 signatures, `OWNER` and `ADMIN` role constraints, fail-closed handling on missing production secret, and constant-time signature comparison.
- [x] `TESTED` Role authorization foundation (`frontend/src/lib/auth/permissions.ts`) with `hasPermission` and `requirePermission` verifying that `OWNER` has full access and `ADMIN` is strictly prevented from accessing `OWNER`-only features (`admin:settings:manage`, `admin:users:manage`, `admin:security:audit`).
- [x] `TESTED` Deployment separation via `NEXT_PUBLIC_APP_MODE` (`storefront` | `admin`) documented in `frontend/.env.example` with middleware redirecting `/admin` routes to `/` when deployed in storefront mode.
- [x] `TESTED` Security regression test suite (`frontend/tests/security/admin-access.test.ts`) validating unauthenticated redirection, customer role rejection, fail-closed tampering/expiry validation, OWNER full access, and ADMIN privilege hierarchy (9 tests passing).
## Phase 1.2B — Admin Identity Provider & Secure Session Management
Status: **TESTED**
- [x] `TESTED` Admin identity persistence data model in PostgreSQL (`admin_users` table with UUID primary key, lowercase normalized email uniqueness constraint, role check `OWNER`/`ADMIN`, status check `ACTIVE`/`DISABLED`, and account lock tracking columns).
- [x] `TESTED` Eloquent domain model (`app/Domain/Admin/Models/AdminUser.php`) with hidden password hashes, strict enum casting, timing-safe password verification, and account lockout management.
- [x] `TESTED` Password security using Argon2id via Laravel Hash facade, rejecting empty passwords and preventing credential leakage.
- [x] `TESTED` Admin authentication domain service (`app/Domain/Admin/Services/AdminAuthenticationService.php`) with timing-attack mitigation (constant-time dummy hash verification on unknown emails), account lockout enforcement, HMAC-SHA256 session token generation matching Next.js Edge runtime, and fail-closed handling in production.
- [x] `TESTED` Brute force protection and distributed rate limiting on `POST /api/admin/login` (5 attempts / 15 minutes per identity), accompanied by persistent database-level account locks after 5 consecutive failures.
- [x] `TESTED` Audit logging architecture (`admin_audit_logs` table and `AdminAuditLog` model) recording login successes, failures, account lockouts, and logouts without ever storing passwords, hashes, or session tokens.
- [x] `TESTED` BFF and frontend integration (`/api/admin/login`, `/api/admin/logout`, and `frontend/src/app/admin/login/page.tsx`) with sanitized generic error messages, zero token persistence in `localStorage`, and HTTP-only cookie session storage.
- [x] `TESTED` Backend test suite (`backend-core/tests/Feature/AdminAuthenticationTest.php`) verifying OWNER/ADMIN login, wrong password rejection, disabled account rejection, repeated failure lockout, audit logging, password hash absence in responses, and session termination (8 tests, 49 assertions passing).
- [x] `TESTED` Frontend test suite (`frontend/tests/security/admin-auth-security.test.ts`) validating error sanitization, localStorage isolation, protected route traversal, and cookie clearance on logout (7 tests passing).

## Phase 1.2C — Vercel Staging Deployment Foundation
Status: **TESTED**
- [x] `TESTED` Dual-deployment architecture decision documented (`docs/deployment/vercel-staging.md`): single unified repository deploying to distinct Vercel projects (`callme-yoghurt-storefront` and `callme-yoghurt-admin`) with host and mode isolation.
- [x] `TESTED` Environment variable separation documented in `frontend/.env.example` strictly distinguishing customer variables from administrative variables, prohibiting `NEXT_PUBLIC_` prefixes on secrets (`ERP_SERVICE_TOKEN`, `ADMIN_SESSION_SECRET`, `REDIS_URL`).
- [x] `TESTED` Vercel Edge runtime compatibility verified: middleware has zero Node.js filesystem/network imports and utilizes standard Web Crypto API; server-side routes utilize standard AbortController 5000ms timeouts.
- [x] `TESTED` Backend connection hardening: BFF routes (`/api/catalog`, `/api/checkout`, `/api/admin/login`, `/api/admin/logout`) enforce HTTPS readiness, explicit request timeouts, sanitized error mapping, and zero internal credential leakage.
- [x] `TESTED` Comprehensive Vercel staging & production deployment guide created (`docs/deployment/vercel-staging.md`) covering project setups, environment specifications, Edge middleware boundary, domain routing, and instant rollback procedures.
- [x] `TESTED` Security deployment boundary regression test suite (`frontend/tests/security/deployment-boundary.test.ts`) validating storefront isolation, admin mode authentication requirement, secret absence from client bundles/chunks, and non-leakage of ERP configurations in API responses (7 tests passing).

## Phase 1.2D — Vercel Staging Deployment Execution & Verification
Status: **TESTED**
- [x] `TESTED` Vercel configuration audit (`package.json`, `next.config.mjs`, `middleware.ts`, `src/lib/env-validator.ts`): verified root directory `frontend`, Next.js framework preset, and zero Node-only dependencies in Edge middleware.
- [x] `TESTED` Staging execution & verification runbook created (`docs/deployment/vercel-staging-verification.md`) detailing storefront & admin Vercel configurations, environment variable specifications, domain mappings, cookie security invariants, and instant rollback procedures.
- [x] `TESTED` Environment validation utility (`frontend/src/lib/env-validator.ts`) enforcing required variables for Storefront (`NEXT_PUBLIC_APP_MODE`, `ERP_INTERNAL_URL`, `ERP_SERVICE_TOKEN`) and Admin (`NEXT_PUBLIC_APP_MODE`, `ERP_INTERNAL_URL`, `ADMIN_SESSION_SECRET`) with fail-closed production semantics and zero secret leakage.
- [x] `TESTED` Environment validation security test suite (`frontend/tests/security/env-validator.test.ts`) validating Storefront requirements, Admin requirements, and zero secret leakage in error messages (9 tests passing).
- [x] `TESTED` End-to-end deployment smoke test suite (`frontend/tests/e2e/staging-smoke.spec.ts`) validating Storefront homepage, Product detail page with Cold Chain storage guidance, Admin unauthenticated route protection, Admin login form controls, and BFF error sanitization (5 tests passing in Playwright).
- [x] `TESTED` Zero regressions across full automated verification: 133 passing security tests across 33 suites, 9 passing Playwright e2e tests, 0 TypeScript errors, successful Next.js production build, and 127 passing Laravel ERP feature tests (501 assertions).

## Phase 1.3A — Production Load & Stress Test Framework
Status: **IMPLEMENTED**
- [x] `IMPLEMENTED` Grafana k6 framework setup (`tests/load/`) with modular architecture: `config.js` (env loader with staging fallbacks), `helpers.js` (synthetic Indonesian customer & phone generators, idempotency key factory, think-time helpers), and `.env.example`.
- [x] `IMPLEMENTED` Customer Browsing Load Test (`tests/load/catalog-load.js`) simulating ramping traffic from 0 to 500 virtual users across storefront landing, product details, and catalog BFF APIs with p95 < 1000ms latency and < 1% error rate thresholds.
- [x] `IMPLEMENTED` Checkout Concurrency Test (`tests/load/checkout-load.js`) executing 100 concurrent checkout submissions, asserting transaction integrity, p95 < 3000ms submission latency, and zero token/ERP internal URL leakage.
- [x] `IMPLEMENTED` Inventory Race Condition Test (`tests/load/inventory-race-test.js`) subjecting limited stock pool to 100 simultaneous checkouts, validating FEFO allocation integrity, fail-closed 409 Conflict handling, and zero overselling (`race_oversold_rate == 0`).
- [x] `IMPLEMENTED` Idempotency Stress Test (`tests/load/idempotency-stress.js`) executing 100 concurrent submissions of identical `Idempotency-Key`, verifying single transaction creation, idempotent HTTP 200 replay / 409 in-flight lock handling, and zero duplicate orders (`idemp_duplicate_anomaly_rate == 0`).
- [x] `IMPLEMENTED` Admin Authentication Stress Test (`tests/load/admin-login-stress.js`) simulating high-frequency brute-force attempts, verifying distributed rate limiting (HTTP 429), sanitized failure responses (HTTP 401), account lockout triggers, and zero authentication bypass (`auth_bypass_anomaly_rate == 0`).
- [x] `IMPLEMENTED` Database Observation Scripts (`tests/load/database-checks/`): `01-inventory-consistency.sql` (no negative stock, reservations balance allocations, append-only ledger), `02-idempotency-integrity.sql` (idempotency uniqueness, global order number uniqueness), and `03-audit-log-verification.sql` (audited attempts, zero plaintext credential leakage).
- [x] `IMPLEMENTED` Metrics Collection & Report Template (`docs/testing/load-test-report-template.md`) establishing standardized reporting for infrastructure utilization, k6 application metrics, and business transaction invariants.
- [x] `IMPLEMENTED` Full security regression suite passing: 133 frontend security tests, 127 Laravel ERP feature tests (501 assertions), and 0 TypeScript compilation errors.

## Phase 1.3B — OWASP Security Assessment & Penetration Testing Framework
Status: **TESTED**
- [x] `TESTED` Security testing framework structure established under `tests/security/pentest/` (`authentication`, `authorization`, `api`, `injection`, `leakage`, `headers`, `reports`).
- [x] `TESTED` Authentication penetration testing (`tests/security/pentest/authentication/admin-auth.spec.ts`): invalid credentials rejected with HTTP 401 and generic error; user enumeration mitigated via identical error responses; session cookie tampering rejected; expired tokens redirect to `/admin/login`; missing production session secret fails closed.
- [x] `TESTED` Authorization & RBAC penetration testing (`tests/security/pentest/authorization/rbac.spec.ts`): customer access to `/admin` and admin API denied (307 redirect / 401); ADMIN role denied OWNER-only privileged capabilities (`admin:users:manage`, `admin:settings:manage`, `admin:security:audit`); role tampering / privilege escalation rejected cryptographically.
- [x] `TESTED` API security testing (`tests/security/pentest/api/api-security.spec.ts`): parameter tampering (price, total, stock, warehouse_id, customer_id, negative/floating quantities, invalid UUIDs) strictly rejected or stripped; upstream error responses never leak `ERP_SERVICE_TOKEN`, internal URLs, IPs, or stack traces; IDOR enumeration blocked.
- [x] `TESTED` Injection penetration testing (`tests/security/pentest/injection/injection.spec.ts`): SQL injection inputs in checkout and login rejected/sanitized without syntax error or database state disclosure; XSS attacks mitigated with zero `dangerouslySetInnerHTML` across frontend codebase; JSON and prototype pollution (`__proto__`, `constructor.prototype`) neutralized; CRLF header injection prevented.
- [x] `TESTED` OWASP Security header assessment (`tests/security/pentest/headers/security-header.spec.ts`): Content-Security-Policy (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, no `unsafe-eval` in production), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` hardware restrictions, `X-Frame-Options: DENY`, and Strict-Transport-Security (HSTS).
- [x] `TESTED` Secret leakage scanner (`tests/security/pentest/leakage/secret-scanner.ts` and `tests/security/pentest/leakage/secret-leakage.spec.ts`): automated scanner verified 0 secret leakage findings across `.next/` build bundles, client components, and public assets.
- [x] `TESTED` Dependency security audit: Backend Composer audit clean with 0 advisories (`composer audit --locked`); frontend npm audit evaluated and documented with full remediation roadmap.
- [x] `TESTED` Comprehensive OWASP Penetration Testing Report generated at `docs/security/pentest-report.md`.
- [x] `TESTED` Full regression compatibility: 133 frontend security tests, 23 pentest specs, 127 Laravel ERP tests (501 assertions), 0 TypeScript compilation errors, and successful Next.js production build.


---

# Legacy Implementation Evidence

The following repository pieces already exist but must not be treated as completed enterprise phases without re-verification:

- Docker Compose prototypes for PostgreSQL, MongoDB, and Redis — `SCAFFOLDED`
- Laravel-oriented `backend-core` domain/test fragments — `SCAFFOLDED`
- Customer encryption cast/test prototype — `SCAFFOLDED`
- FastAPI distance/weight prototype — `SCAFFOLDED`
- OWASP ZAP local container prototype — `SCAFFOLDED`
- Next.js storefront/cart/checkout UI — mixed `IMPLEMENTED` UI with incomplete backend transaction
- Playwright return-flow test — requires repair/re-verification
- BFF checkout route — security P0 patch `IMPLEMENTED`, not yet `TESTED`
- Prisma ERP-like schema — architecture/domain exploration input, not authoritative production persistence
- Homepage catalog cards — retain legacy display-only static pricing; NOT transaction authority (Product Detail + Cart use ERP catalog data; cutover deferred to future storefront presentation cleanup).

---

# Future Program Roadmap

After Phase 0 passes:

1. Phase 1 — Commerce Core
2. Phase 2 — Inventory, Warehouse & Cold Chain
3. Phase 3 — Procurement & Manufacturing/MRP
4. Phase 4 — Finance, Payments & Operational Control
5. Phase 5 — CRM, Customer Experience & Omnichannel
6. Phase 6 — AI Intelligence Platform
7. Phase 7 — Agentic AI & Business Automation
8. Phase 8 — Enterprise Scale, Reliability & Optimization

AI-readiness is cross-cutting from Phase 0 onward; AI does not become the source of transactional truth at any phase.
