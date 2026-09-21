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
- [ ] `PLANNED` Phase 1.2B: Full Admin User Management & Backend Authentication Integration (OAuth/Session API).

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
