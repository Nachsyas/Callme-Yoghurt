# Callme Yoghurt — Infrastructure & Scaling Architecture

> Status: Phase 0 target architecture. This document describes scaling principles, not proof that production infrastructure already exists.

## 1. Stateless application compute

Next.js application instances, Laravel ERP application instances, and Python/FastAPI intelligence workers should be stateless wherever practical.

Durable business state belongs in PostgreSQL/object storage. Ephemeral coordination may use Redis with explicit TTL/retention behavior.

This allows horizontal scaling of application compute without creating multiple sources of truth.

## 2. ERP Core scales as a modular monolith first

Laravel ERP Core remains one deployable transactional authority during the early/mid product lifecycle. Multiple stateless instances may sit behind a load balancer when traffic requires it:

```text
Load Balancer
   ├── ERP Instance A
   ├── ERP Instance B
   └── ERP Instance C
           │
           ├── PostgreSQL
           └── Redis
```

A domain should only be extracted into an independent service when evidence such as independent scaling pressure, failure isolation needs, specialized runtime requirements, or organizational ownership justifies the additional distributed-systems cost.

## 3. PostgreSQL remains the authoritative database

The previous read/write split between MongoDB catalog reads and PostgreSQL transactional writes is no longer the Phase 0 target.

PostgreSQL is the authoritative relational store for catalog and ERP transactions. Flexible catalog attributes may use PostgreSQL JSONB where appropriate.

MongoDB is deferred until a future ADR demonstrates a concrete requirement that cannot be met cleanly by PostgreSQL, JSONB, search infrastructure, caching, or object storage.

## 4. Read scaling strategy

Scale reads progressively rather than introducing a second source of truth prematurely:

1. correct indexes and query plans;
2. application/HTTP caching where safe;
3. Redis cache for justified hot data;
4. CDN/object delivery for static media;
5. PostgreSQL read replica only when measured load justifies it;
6. dedicated search engine only when search requirements justify it.

Catalog product images are served from object storage/CDN, not MongoDB.

## 5. Write consistency and inventory

Inventory, reservation, order, payment, and production mutations require deterministic ERP business rules and database transactions.

Concurrency protection may include:

- PostgreSQL row-level locking where appropriate;
- optimistic concurrency/version checks where appropriate;
- unique constraints and idempotency keys;
- transaction isolation chosen for the specific invariant;
- Redis coordination only as a complement, never as the sole source of inventory truth.

## 6. Next.js / BFF scaling

Next.js may run on serverless, edge-capable, or container infrastructure depending on deployment needs. The BFF is responsible for presentation-facing concerns and API mediation, but is not assumed to be a trusted business authority merely because it is server-side.

ERP API authentication, authorization, and validation remain mandatory.

## 7. AI Intelligence scaling

Python/FastAPI Intelligence workloads scale separately from ERP transaction traffic.

Examples:

- interactive copilot/RAG requests;
- embedding workers;
- forecasting jobs;
- anomaly-detection jobs;
- optimization workloads.

Long-running AI workloads should be queued rather than holding customer transaction requests open.

AI capacity problems must not prevent core ERP transaction integrity. Where AI is unavailable, deterministic commerce/ERP functions should degrade safely rather than becoming invalid.

## 8. Storage scaling

Use the storage engine appropriate to the data class:

- PostgreSQL: structured business truth;
- S3-compatible object storage: media/evidence/documents;
- Redis: bounded ephemeral state;
- pgvector: initial RAG/vector index;
- observability store: logs/traces/metrics;
- backup storage: encrypted backup/PITR artifacts.

Lifecycle/retention controls are required so media, logs, temporary AI state, and backups do not grow without bounds.

## 9. Scale by evidence

No infrastructure component should be introduced only to appear "enterprise".

Scaling decisions require measurable signals such as latency, throughput, queue depth, database load, storage growth, failure rate, cost, or operational isolation requirements.
