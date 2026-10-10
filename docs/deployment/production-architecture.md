# Production Infrastructure Architecture & Sizing Plan — Phase 1.4A

**Target Application**: Callme Yoghurt Enterprise Commerce & ERP Platform  
**Architecture Classification**: Edge-BFF + Private Tunnel + Authoritative Core ERP  
**Document Version**: 1.0 (Production Release Candidate)  

---

## 1. High-Level Architecture Topology

The Callme Yoghurt production architecture adopts a strict separation between public edge presentation (Vercel Frontend) and privileged transactional core (Laravel ERP Core on isolated infrastructure). Public traffic never communicates directly with backend databases or internal ERP ports.

```
                    ┌───────────────────────────────┐
                    │             Users             │
                    └───────────────┬───────────────┘
                                    │ HTTPS (Port 443)
                    ┌───────────────▼───────────────┐
                    │       Cloudflare (WAF)        │
                    │  - DDoS Layer 3/4/7 Shield    │
                    │  - Strict SSL Termination     │
                    │  - Edge Asset Caching         │
                    └───────────────┬───────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │        Vercel Frontend        │
                    │      (Next.js 15 App)         │
                    ├───────────────┬───────────────┤
                    │  Storefront   │ Admin Portal  │
                    │  (Public UI)  │(Privileged UI)│
                    └───────┬───────┴───────┬───────┘
                            │               │
                            └───────┬───────┘
                                    │ HTTPS / mTLS
                    ┌───────────────▼───────────────┐
                    │    Cloudflare Tunnel (Zero    │
                    │    Trust) / WireGuard VPN     │
                    └───────────────┬───────────────┘
                                    │ Encrypted Private Network
                    ┌───────────────▼───────────────┐
                    │         Nginx Proxy           │
                    │  (Rate Limiting & Proxy Pass) │
                    └───────────────┬───────────────┘
                                    │ Unix Socket / FastCGI
                    ┌───────────────▼───────────────┐
                    │    Laravel 13 ERP Core (VPS)  │
                    │      (PHP 8.3-FPM / Octane)   │
                    │  - Domain-Driven Design (DDD) │
                    │  - Authoritative Pricing/Stock│
                    │  - Cold Chain FEFO Engine     │
                    └───────┬───────────────┬───────┘
                            │               │
            ┌───────────────▼───────┐   ┌───▼───────────────┐
            │     PostgreSQL 16     │   │      Redis 7      │
            │  - System of Record   │   │  - Distributed RL │
            │  - ACID Transactions  │   │  - Queue / Lock   │
            │  - AES-256 PII Encrypt│   │  - Ephemeral Cache│
            └───────────────┬───────┘   └───────────────────┘
                            │
            ┌───────────────▼───────────────────────────────┐
            │   S3-Compatible Object Storage (R2 / S3)      │
            │   - Unboxing Video Complaints (Presigned URL) │
            │   - Immutable Invoices & Backup Snapshots     │
            └───────────────────────────────────────────────┘
```

---

## 2. Infrastructure Sizing & Cost Models

To provide a practical and scalable roadmap for business growth in Indonesia, three deployment tiers are detailed below:

### Tier 1 — Minimal Production (<10 Million IDR / Year)
- **Target Audience**: Small-medium Indonesian business, initial production launch, up to 5,000 orders/month.
- **Topology**: Single hardened Linux VPS hosting ERP, PostgreSQL, and Redis behind Cloudflare Tunnel.
- **Specifications**:
  - **Provider**: Hetzner Cloud (CPX31 / CCX13) or DigitalOcean / Biznet Gio / IDCloudHost.
  - **Compute**: 4 vCPU, 8 GB RAM.
  - **Storage**: 160 GB NVMe SSD (Encrypted).
  - **Object Storage**: Cloudflare R2 (10 GB free tier + $0.015/GB/mo, zero egress fees).
  - **DNS & CDN**: Cloudflare Free Tier (WAF, SSL, Tunnel).
  - **Frontend**: Vercel Pro ($20/seat/mo) or Hobby for initial staging.
- **Estimated Annual Cost**:
  - VPS: ~€14/mo (~Rp 240,000/mo) = **Rp 2,880,000 / year**.
  - Backup & Storage (R2 + Snapshot): ~Rp 50,000/mo = **Rp 600,000 / year**.
  - Domain & SSL: **Rp 250,000 / year**.
  - **Total Estimated Cost**: **~Rp 3,730,000 / year** (Well under the Rp 10M/year ceiling).

---

### Tier 2 — Recommended Production (High Reliability)
- **Target Audience**: Growing commercial operations, 10,000 - 50,000 orders/month, peak traffic events.
- **Topology**: Isolated database instance and application server.
- **Specifications**:
  - **Application VPS**: 4 vCPU, 8 GB RAM (Laravel 13 PHP-FPM + Nginx).
  - **Database Managed Instance**: 2 vCPU, 4-8 GB RAM (Managed PostgreSQL 16 with automatic failover and automated daily backups).
  - **Cache/Queue**: 2 GB Managed Redis or co-located Redis on App VPS.
  - **Object Storage**: AWS S3 or Cloudflare R2 with cross-region replication.
- **Estimated Annual Cost**:
  - App Server: ~Rp 450,000/mo = **Rp 5,400,000 / year**.
  - Managed PostgreSQL: ~Rp 650,000/mo = **Rp 7,800,000 / year**.
  - Storage & Monitoring: ~Rp 150,000/mo = **Rp 1,800,000 / year**.
  - **Total Estimated Cost**: **~Rp 15,000,000 / year**.

---

### Tier 3 — Enterprise Multi-Region Cluster
- **Target Audience**: Nationwide cold-chain logistics distribution, multi-warehouse operations (>100,000 orders/month).
- **Topology**: Redundant stateless application cluster, PostgreSQL Primary-Replica cluster, Redis Sentinel/Cluster, dedicated observability server.
- **Specifications**:
  - **Load Balancer**: Cloudflare Enterprise / AWS ALB.
  - **App Nodes**: 2x 4 vCPU, 8 GB RAM (Auto-scaling cluster).
  - **PostgreSQL Cluster**: Primary (4 vCPU, 16 GB RAM) + Read Replica (4 vCPU, 16 GB RAM) with synchronous streaming replication.
  - **Redis Cluster**: 3-node Redis Sentinel (High availability distributed rate limiting and distributed locking).
  - **Observability Stack**: Dedicated Prometheus + Grafana instance.
- **Estimated Cost**: Variable based on SLA requirements (~Rp 40M - 80M / year).

---

## 3. Production Component Specifications

### 3.1 Backend Application
- **Framework**: Laravel 13 running on **PHP 8.3**.
- **Process Manager**: PHP-FPM with dynamic process management (`pm = dynamic`, `pm.max_children = 50`, `pm.start_servers = 10`, `pm.min_spare_servers = 5`, `pm.max_spare_servers = 20`).
- **PHP Optimizations**:
  - OPcache enabled (`opcache.enable=1`, `opcache.memory_consumption=256`, `opcache.max_accelerated_files=20000`, `opcache.validate_timestamps=0` in production).
  - Memory limit: `256M` per worker.
- **Asynchronous Workers**: Laravel Horizon managing Redis queues for order notifications, cold chain time-gate checks, and audit logging.

### 3.2 Database Engine
- **Engine**: **PostgreSQL 16**.
- **Connection Management**: PgBouncer connection pooler in transaction pooling mode (max 100 client connections mapped to 20 server connections).
- **Storage Configuration**:
  - `shared_buffers = 2GB` (25% of RAM).
  - `effective_cache_size = 6GB` (75% of RAM).
  - `maintenance_work_mem = 512MB`.
  - `work_mem = 32MB`.
  - `wal_level = replica`.
- **Security & Integrity**:
  - Strict foreign keys and PostgreSQL constraints (`NUMERIC(18,6)` for inventory precision, `CHECK` constraints on delivery methods and reservation statuses).
  - Customer PII encrypted at rest using AES-256 with HMAC-SHA256 blind indexing for phone searches (`PhoneBlindIndexService`).

### 3.3 Cache & Distributed Coordination
- **Engine**: **Redis 7.2+**.
- **Roles**:
  - Distributed atomic rate limiting (`EVAL` script counter with TTL expiration).
  - Mutex locking (`Cache::lock`) for checkout idempotency and inventory FEFO allocation.
  - Session and ephemeral token blacklists.
- **Persistence**: Append-Only File (`appendonly yes`, `appendfsync everysec`) ensuring zero rate limit state loss on service restarts.

### 3.4 Object Storage Runtime
- **Engine**: S3-Compatible Storage (**Cloudflare R2** or **AWS S3**).
- **Integration**: `ObjectStorageProviderInterface` abstraction via `S3ObjectStorageProvider`.
- **Security Policy**:
  - Private bucket by default; zero public read access.
  - Complaints module MP4 video uploads and customer documents generated via presigned URLs with 15-minute expiration (`temporaryUrl()`).
  - Strict PII-free object keys (`unboxing/{uuid}.mp4`).

### 3.5 Reverse Proxy & Perimeter Network
- **Engine**: **Nginx 1.24+**.
- **Configuration Highlights**:
  - HTTP/2 enabled.
  - SSL Termination: Cloudflare Origin Certificate (2048-bit RSA) with TLS 1.3 only.
  - Request Size Limit: `client_max_body_size 25M` (strictly for presigned attachments).
  - Timeouts: `proxy_connect_timeout 5s; proxy_read_timeout 30s; proxy_send_timeout 10s;`.
- **Firewall & Tunnel**:
  - Cloudflare Tunnel (`cloudflared`) connects the VPS to Cloudflare edge without exposing public IPv4/IPv6 incoming ports (Ports 80/443 closed on VPS external firewall).

---

## 4. Monitoring & Observability Plan

A lightweight, high-visibility observability stack ensures proactive incident detection:

```
[VPS Host Metrics]        ─── Node Exporter      ───┐
[PostgreSQL Metrics]      ─── Postgres Exporter  ───┼──► [Prometheus] ──► [Grafana Dashboards]
[Redis Metrics]           ─── Redis Exporter     ───┤
[Laravel Health Check]    ─── Uptime Kuma Ping   ───┘
```

### 4.1 Key Performance & Health Metrics
1. **Host Infrastructure**:
   - CPU Utilization (Warning > 75%, Critical > 90%).
   - RAM Usage (Warning > 80%, Critical > 92%).
   - Disk Space (Warning < 20% free, Critical < 10% free).
2. **Database Engine**:
   - Active Database Connections (Warning > 70 of pool, Critical > 90).
   - Transaction Rollback Rate (Anomaly detection > 5%).
   - Slow Queries (Log queries taking > 500ms).
3. **Redis & Queues**:
   - Redis Memory Usage (Max 80% of allocated memory).
   - Queue Wait Time (Orders queue backlog > 100 jobs).
4. **Application Endpoints**:
   - HTTP Status 5xx Rate (Target < 0.1%).
   - p95 Checkout Submission Latency (< 2000ms).
   - Rate Limit Breaches (HTTP 429 spike alerts indicating bot waves).

### 4.2 Monitoring Tools
- **Prometheus**: Metric collection server scraping `node_exporter`, `postgres_exporter`, and `redis_exporter` every 15 seconds.
- **Grafana**: Visual dashboards for real-time operations, inventory ledger movements, and server load.
- **Uptime Kuma**: Self-hosted, lightweight uptime monitor pinging `/api/health` and `/api/ready` every 30 seconds with instant Telegram/WhatsApp webhook notifications.

---

## 5. Backup & Disaster Recovery Strategy

To guarantee zero data loss and rapid restoration during infrastructure disruption, Callme Yoghurt enforces strict RPO and RTO thresholds:

| Metric | Target | Operational Mechanism |
| :--- | :---: | :--- |
| **Recovery Point Objective (RPO)** | **<= 15 Minutes** | Continuous PostgreSQL WAL archiving + 6-hour database snapshots |
| **Recovery Time Objective (RTO)** | **<= 4 Hours** | Automated Ansible/Docker bare-metal restoration script |

### 5.1 Database Backup Procedures
1. **Daily Full Logical Dump**:
   - Executed at 02:00 WIB via automated cron.
   - Script performs `pg_dump -Fc` (custom compressed binary format).
   - File is AES-256 encrypted using GPG and transferred to offsite Cloudflare R2 bucket:
     `r2://callme-backups/postgres/daily/callme_db_YYYYMMDD_0200.dump.gpg`.
2. **Continuous WAL Archiving**:
   - PostgreSQL `archive_mode = on` and `archive_command` configured with `wal-g` or `pgBackRest` pushing closed WAL segments to offsite storage every 15 minutes.
   - Enables Point-In-Time Recovery (PITR) to any exact minute in the preceding 14 days.

### 5.2 Object Storage Protection
- **Versioning**: Enabled across all S3/R2 storage buckets.
- **Retention Guard**: Deletion lifecycle respects legal hold status (`LegalHold` model guard in PostgreSQL metadata table `stored_objects`).
- **Object Replication**: Nightly synchronization of customer complaint media to secondary cold storage.

### 5.3 Disaster Recovery Runbook
1. Provision replacement VPS instance using baseline Ubuntu 24.04 LTS image.
2. Pull latest configuration and application deployment via Git repository.
3. Install PostgreSQL 16 and fetch latest daily dump from Cloudflare R2.
4. Restore base database: `pg_restore -d callme_yoghurt latest.dump`.
5. Replay WAL segments up to target point-in-time (`recovery.signal`).
6. Point Cloudflare Tunnel to the new internal IP address.
7. Verify health endpoints (`/api/ready`) and resume traffic in under 4 hours.
