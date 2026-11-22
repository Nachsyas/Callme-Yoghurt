# Callme Yoghurt — Repository Structure

> Status: Phase 0 Foundation Repair
>
> This document separates **current repository reality** from the **target structure**. Target directories must not be treated as implemented merely because they are documented here.

## Current high-level structure

The repository currently contains these major areas:

```text
Callme-Yoghurt/
├── .agents/                     # AI-agent skills/rules
├── frontend/                    # Next.js storefront, BFF prototype, Zustand, Playwright
├── backend-core/                # partial Laravel-oriented ERP scaffold
├── microservice/                # FastAPI logistics prototype
├── prisma/                      # Prisma schema exploration
├── docs/                        # architecture/todo documentation
├── docker-compose.yml           # local data-service prototype
├── docker-compose.security.yml  # local OWASP ZAP prototype
├── AGENTS.md                    # AI-agent operating rules
├── package.json                 # root Prisma tooling dependency
└── prisma.config.ts
```

Important Phase 0 truth:

- `backend-core/` is **not yet a complete runnable Laravel application**.
- `microservice/` is currently a logistics prototype, not yet the target AI Intelligence service.
- `prisma/schema.prisma` is not the authoritative production persistence contract while Laravel ERP Core is the chosen transactional authority.
- there is no verified production `infra/` platform matching the old documentation yet.
- frontend checkout/BFF code is not yet a real end-to-end ERP transaction.

## Target structure after foundation repair

The exact physical layout may evolve during Phase 0, but ownership boundaries should converge toward:

```text
Callme-Yoghurt/
├── apps/
│   ├── storefront/              # Next.js customer experience
│   └── admin/                   # Next.js owner/staff ERP experience
│
├── services/
│   ├── erp-core/                # Laravel modular-monolith transactional authority
│   └── intelligence/            # Python/FastAPI AI/ML layer
│
├── packages/
│   ├── contracts/               # generated/shared API contract artifacts where useful
│   └── config/                  # shared developer/tooling configuration where justified
│
├── infra/
│   ├── docker/                  # local/dev container definitions
│   ├── security/                # security-test configuration
│   ├── observability/           # tracing/metrics/logging configuration
│   └── storage/                 # object-storage/backup lifecycle infrastructure config
│
├── docs/
│   ├── architecture/
│   │   └── ADR/
│   ├── domain/
│   ├── security/
│   ├── testing/
│   ├── ai/
│   └── operations/
│
├── .github/
│   └── workflows/               # CI/CD gates
│
└── AGENTS.md
```

## Boundary rules

### `apps/*`

Presentation and interaction layers. They do not own transactional business truth or directly mutate the ERP database.

### `services/erp-core`

Authoritative transactional application. Owns deterministic business rules and persistence for commerce/ERP domains.

### `services/intelligence`

AI/ML capabilities such as RAG, forecasting, recommendation, anomaly detection, owner copilot, customer concierge, and governed agents. It consumes approved ERP tools/contracts and does not bypass the ERP authority model.

### `packages/contracts`

Contract artifacts should derive from canonical API definitions such as OpenAPI where possible. This directory must not become a second place to manually redefine business rules.

### `infra/*`

Operational configuration only. Application business logic must not leak into infrastructure scripts.

## Migration policy

Phase 0 may migrate directories incrementally. Renaming/moving everything at once is not required and should not be done if it creates unnecessary risk.

A directory move is complete only when:

1. build/import paths are updated,
2. tests run from the new layout,
3. deployment/dev tooling is updated,
4. documentation is updated,
5. old duplicate ownership is removed.
