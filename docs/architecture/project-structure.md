Project Monorepo Structure
Callme-Yoghurt-Monorepo/
├── .agents/
│   └── skills/                  # Kumpulan skill AI Agent (termasuk auto-fix bug)
├── frontend/                    # Next.js 15 (E-Commerce Storefront & BFF)
│   ├── src/
│   │   ├── app/                 # App Router Boundaries & API Route Handlers
│   │   └── store/               # Zustand Isolated States (Cart Accumulation)
│   └── tests/                   # Playwright E2E E-Commerce Flow
├── backend-core/                # Laravel 11 ERP (Domain-Driven Design)
│   ├── app/Domain/              # Bounded Contexts (Sales, Inventory, Logistics)
│   ├── app/Infrastructure/      # DB Repositories & Adapters
│   └── tests/                   # PHPUnit (TDD)
├── microservice/                # Python FastAPI Logistics Logic
│   └── tests/                   # Pytest (TDD)
└── infra/                       # DevSecOps & QA Tools
    ├── docker/                  # Multi-stage build definitions
    └── security/                # OWASP ZAP & Pen-test configurations
