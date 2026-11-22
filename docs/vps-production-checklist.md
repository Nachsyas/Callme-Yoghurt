# Callme Yoghurt ERP — VPS Production Deployment Checklist

**Document Version:** 1.0.0  
**Phase:** 1.7 Pre-Deployment Gate  
**Target Environment:** Single-Node Low-Cost Production VPS  
**Security Standard:** Enterprise DevSecOps & Zero-Trust SOP Compliant (`docs/SOP/01` - `07`)

---

## 1. Hardware Specifications

| Component | Minimum Specification | Recommended Production Baseline | Verification Command |
| :--- | :--- | :--- | :--- |
| **vCPU** | 1 vCPU | 2 vCPU (x86_64 or ARM64) | `nproc` / `lscpu` |
| **RAM** | 2 GB Physical RAM | 2 GB RAM + 2 GB Swap file | `free -h` |
| **Storage** | 20 GB SSD / NVMe | 20–40 GB SSD (ext4) | `df -h /` |
| **Network** | 100 Mbps symmetrical | 1 Gbps with unmetered ingress | `ip route` / `speedtest-cli` |

> [!IMPORTANT]
> **Swap Memory Requirement:** On a 2GB RAM host, you **MUST** configure a 2GB swap file (`/swapfile`) with `vm.swappiness=10` to prevent Linux OOM-killer from terminating PostgreSQL or PHP-FPM under concurrent burst traffic.
> ```bash
> sudo fallocate -l 2G /swapfile
> sudo chmod 600 /swapfile
> sudo mkswap /swapfile
> sudo swapon /swapfile
> echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
> ```

---

## 2. Software Prerequisites

| Software | Target Version | Verification Command | Status |
| :--- | :--- | :--- | :--- |
| **Operating System** | Ubuntu 24.04 LTS (Noble Numbat) | `lsb_release -a` | [ ] |
| **Kernel** | Linux 6.8+ (x86_64) | `uname -r` | [ ] |
| **Container Engine**| Docker CE (27.x+) | `docker --version` | [ ] |
| **Compose Plugin**  | Docker Compose v2 (v2.29+) | `docker compose version` | [ ] |
| **Secure Ingress**  | Cloudflare Tunnel (`cloudflared`) | `cloudflared --version` | [ ] |
| **System Utilities**| `curl`, `jq`, `ufw`, `fail2ban`, `ca-certificates` | `which ufw fail2ban-client` | [ ] |

---

## 3. Security Hardening & Zero-Trust Architecture

### 3.1 Network & Firewall Isolation (UFW)
The host MUST NOT expose application or database ports directly to the public internet. All ingress is proxied through the encrypted Cloudflare Tunnel daemon.

- [ ] **Default Policies:** Drop incoming, allow outgoing.
  ```bash
  sudo ufw default deny incoming
  sudo ufw default allow outgoing
  ```
- [ ] **SSH Hardened Port:** Allow SSH only (recommended to restrict to Admin IP or Cloudflare Access).
  ```bash
  sudo ufw allow 22/tcp comment 'SSH Management'
  sudo ufw enable
  ```
- [ ] **Zero Public DB Exposure:** Port `5432` (PostgreSQL) and Port `6379` (Redis) are strictly prohibited from host binding or firewall opening. They MUST reside exclusively on the private Docker bridge network `callme_internal_network`.
- [ ] **No Public HTTP/S Open Ports (Optional with Tunnel):** If using Cloudflare Tunnel, ports `80` and `443` can remain CLOSED on the host firewall. `cloudflared` operates via outbound QUIC/HTTP2 tunnel connections to Cloudflare Edge.

### 3.2 Host SSH Hardening (`/etc/ssh/sshd_config.d/99-hardening.conf`)
- [ ] Password authentication disabled: `PasswordAuthentication no`
- [ ] Root direct login disabled: `PermitRootLogin no`
- [ ] Public key authentication enforced: `PubkeyAuthentication yes`
- [ ] Max authentication attempts restricted: `MaxAuthTries 3`
- [ ] SSH service reloaded: `sudo systemctl restart ssh`

### 3.3 Fail2ban Protection
- [ ] `fail2ban` installed and active: `sudo systemctl status fail2ban`
- [ ] SSH jail configured with 5 max retries and 24-hour ban time.

---

## 4. Container & Service Architecture

The production environment consists of 5 isolated container services orchestrated by `docker-compose.production.yml`:

```
Internet (Vercel Frontend)
       │ (HTTPS Cloudflare Tunnel)
       ▼
[ Cloudflared Tunnel Daemon ]
       │ (HTTP Host Bridge 127.0.0.1:8000)
       ▼
┌────────────────────────────────────────────────────────┐
│ callme_erp_web (Nginx 1.27 Reverse Proxy)              │
└──────────────────────────┬─────────────────────────────┘
                           │ (FastCGI 9000, callme_internal)
                           ▼
┌────────────────────────────────────────────────────────┐
│ callme_erp_app (Laravel 13 PHP 8.3 FPM)               │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
 (Internal TCP)│                          │ (Internal TCP)
               ▼                          ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│ callme_erp_postgres      │  │ callme_erp_redis         │
│ (PostgreSQL 16 Alpine)   │  │ (Redis 7 Alpine, Pass)   │
└──────────────────────────┘  └──────────┬───────────────┘
                                         │ (Queue Jobs)
                                         ▼
                              ┌──────────────────────────┐
                              │ callme_erp_worker        │
                              │ (Laravel Queue Daemon)   │
                              └──────────────────────────┘
```

- [ ] `callme_erp_web` (Nginx): Reverse proxy exposing port `127.0.0.1:8000` to host localhost ONLY.
- [ ] `callme_erp_app` (PHP-FPM 8.3): Core ERP API application.
- [ ] `callme_erp_worker` (Queue Worker): Processing asynchronous jobs via Redis driver.
- [ ] `callme_erp_postgres` (PostgreSQL 16): Relational storage with persistent volume `postgres_data`.
- [ ] `callme_erp_redis` (Redis 7): In-memory cache, rate limiter, and job queue with persistent volume `redis_data`.

---

## 5. Production Environment Variables Checklist (`.env.production`)

Ensure the following secrets are securely generated with high-entropy cryptographic keys and NEVER committed to Git:

| Variable | Description / Requirement | Verification |
| :--- | :--- | :--- |
| `APP_ENV` | Must be `production` | [ ] |
| `APP_DEBUG` | Must be `false` | [ ] |
| `APP_KEY` | 32-byte Base64 key (`php artisan key:generate --show`) | [ ] |
| `APP_URL` | Cloudflare Tunnel public domain (e.g. `https://erp.callmeyoghurt.com`) | [ ] |
| `DB_CONNECTION` | Must be `pgsql` | [ ] |
| `DB_HOST` | `postgres` (internal Docker DNS) | [ ] |
| `DB_PORT` | `5432` | [ ] |
| `DB_DATABASE` | `callme_yoghurt_prod` | [ ] |
| `DB_USERNAME` | Non-root production user (e.g. `callme_prod_app`) | [ ] |
| `DB_PASSWORD` | Strong password (min 32 chars, random alphanumeric) | [ ] |
| `REDIS_HOST` | `redis` (internal Docker DNS) | [ ] |
| `REDIS_PASSWORD` | Strong random auth password | [ ] |
| `ERP_SERVICE_TOKEN` | 64+ char shared secret for Next.js BFF authentication | [ ] |
| `ERP_FULFILLMENT_WAREHOUSE_CODE` | `WH-MAIN` | [ ] |
| `OWNER_PROVISION_EMAIL` | `owner@callmeyoghurt.com` | [ ] |
| `OWNER_PROVISION_NAME` | Callme Yoghurt Owner | [ ] |
| `OWNER_PROVISION_PASSWORD` | Strong master password (Argon2id hashed on boot) | [ ] |

---

## 6. Pre-Flight Deployment Sequence

Execute this exact sequence upon fresh VPS deployment:

```bash
# Step 1: Clone repository & checkout target release tag
git clone https://github.com/Nachsyas/Callme-Yoghurt.git /opt/callme-erp
cd /opt/callme-erp

# Step 2: Configure production secrets
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production

# Step 3: Verify Docker permissions and build production image
docker compose -f docker-compose.production.yml --env-file .env.production build

# Step 4: Boot database & redis containers first
docker compose -f docker-compose.production.yml --env-file .env.production up -d postgres redis

# Step 5: Wait for healthy state, then launch app, worker, and web
docker compose -f docker-compose.production.yml --env-file .env.production up -d

# Step 6: Execute authoritative migrations
docker compose -f docker-compose.production.yml --env-file .env.production exec app php artisan migrate --force

# Step 7: Seed official product catalog (7 flavors, 0 pisang)
docker compose -f docker-compose.production.yml --env-file .env.production exec app php artisan db:seed --class=OfficialCatalogSeeder --force

# Step 8: Provision initial OWNER account
docker compose -f docker-compose.production.yml --env-file .env.production exec app php artisan callme:create-owner \
  --email="owner@callmeyoghurt.com" \
  --name="Callme Owner" \
  --password="$OWNER_PASSWORD" \
  --no-interaction

# Step 9: Verify health & ready endpoints
curl -fsS http://127.0.0.1:8000/api/health | jq .
curl -fsS http://127.0.0.1:8000/api/ready | jq .
```

---

## 7. Operational Continuity & Cold Chain Safety

In accordance with **SOP-07 (Cold Chain Quality Assurance)** and **SOP-03 (Backup & Disaster Recovery)**:
- [ ] **Automated Daily Backups:** Setup a cron job for automated `pg_dump` with gzip compression and retention of 30 days stored on an off-site S3-compatible bucket.
- [ ] **Log Rotation:** Docker container logs configured with `json-file` driver, `max-size: "20m"`, and `max-file: "5"`.
- [ ] **FEFO Integrity:** No manual modifications to `stock_reservations` or `inventory_lots`.
- [ ] **Container Auto-Restart:** All 5 services configure `restart: always` to survive host reboot.

---

## 8. Verification Sign-Off

- [ ] Docker Compose boots all 5 containers into healthy state.
- [ ] `/api/health` returns status `ok`.
- [ ] `/api/ready` confirms database connectivity.
- [ ] Queue worker processes Redis jobs without failed entries.
- [ ] Frontend Next.js connects via Cloudflare Tunnel with verified service token.
- [ ] Admin OWNER login succeeds with secure session cookie.
- [ ] Checkout endpoint preserves atomic FEFO reservation.
