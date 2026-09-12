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
- [x] `IMPLEMENTED` Define PII encryption/search strategy including blind index/hash via `PhoneBlindIndexService` and `Customer` model (PHP runtime verification BLOCKED BY GATE 0C; golden vector verified in TS suite).
- [x] `TESTED` Define security headers baseline (`next.config.ts` headers with CSP `frame-ancestors 'none'`, nosniff, Referrer-Policy, Permissions-Policy, conditional HSTS; verified by test).
- [x] `TESTED` Define rate-limiting baseline with `DevMemoryRateLimiter` development adapter and safe client identity signals (verified by test; Redis distributed limiter PLANNED/DEPENDENT ON RUNTIME).
- [x] `TESTED` Restrict local security tooling/network exposure by default (localhost binding, dev credentials, required ZAP API key, deferred MongoDB profile; verified via Compose config).
- [x] `TESTED` Add security regression tests for secret exposure, tampered transaction input, fail-closed configuration, sanitized upstream errors, rate-limiting boundary, and security headers (22 targeted automated tests passing).

**Gate 0B status: IN PROGRESS — Security foundation is implemented and tested at the edge/BFF, Docker, and test-vector boundaries; full Gate 0B verification is pending Gate 0C for Laravel ERP Core runtime boot and Redis distributed rate limiter.**

## Gate 0C — ERP Core Foundation

- [ ] `IMPLEMENTED` Convert `backend-core` from partial scaffold into a runnable Laravel application.
- [ ] `IMPLEMENTED` Add dependency/bootstrap/config/routes/runtime structure.
- [ ] `IMPLEMENTED` Establish explicit domain/application/infrastructure boundaries.
- [ ] `IMPLEMENTED` Connect ERP Core to PostgreSQL through authoritative persistence.
- [ ] `TESTED` Run database migrations from a clean environment.
- [ ] `TESTED` Run ERP automated tests from a clean environment.
- [ ] `VERIFIED` Demonstrate ERP API boot and health check.

## Gate 0D — Data & Storage Architecture

- [ ] `PLANNED` Reconcile useful concepts from Prisma exploration into ERP-owned persistence.
- [ ] `PLANNED` Introduce Product + ProductVariant/SKU model.
- [ ] `PLANNED` Replace precision-sensitive inventory/BOM quantities with decimal/numeric types.
- [ ] `PLANNED` Add proper relational ownership for order lines and items/variants.
- [ ] `PLANNED` Design batch/lot traceability on stock movement.
- [ ] `PLANNED` Design stock reservation and allocation model.
- [ ] `PLANNED` Define append-oriented stock ledger semantics.
- [ ] `PLANNED` Define object-storage metadata and retention model.
- [ ] `PLANNED` Define data lifecycle classes: hot, warm, cold, delete/legal-hold.
- [ ] `PLANNED` Define backup/PITR target architecture.
- [ ] `PLANNED` Add pgvector readiness without embedding transactional rows indiscriminately.

## Gate 0E — Transaction Foundation

- [ ] `IMPLEMENTED` Replace fake checkout success with real BFF request.
- [x] `IMPLEMENTED` Replace simulated BFF response with real ERP forwarding behavior that fails closed when ERP is unavailable.
- [ ] `IMPLEMENTED` Server resolves authoritative SKU/variant data.
- [ ] `IMPLEMENTED` Server calculates authoritative price/total.
- [ ] `IMPLEMENTED` Server validates delivery method/rules.
- [ ] `IMPLEMENTED` Server validates and reserves inventory.
- [ ] `IMPLEMENTED` Order creation and reservation occur transactionally.
- [ ] `IMPLEMENTED` Add end-to-end idempotency for order creation.
- [ ] `IMPLEMENTED` Success page requires a committed order identifier.
- [ ] `TESTED` Reject tampered client price/total input.
- [ ] `TESTED` Reject insufficient inventory.
- [ ] `TESTED` Prevent duplicate order on retried request.

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
