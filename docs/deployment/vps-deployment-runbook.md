# Callme Yoghurt ERP Core — Phase 1.5 VPS Deployment Runbook

> **Document Class**: Operational Deployment Runbook & Automation Specification  
> **Target Environment**: Ubuntu 24.04 LTS (x86_64) — 4 vCPU, 8GB RAM, 160GB NVMe SSD  
> **Authoritative Application**: Laravel 13 ERP Core (`backend-core/`) on PHP 8.3-FPM, PostgreSQL 16, Redis 7  
> **Zero-Trust Boundary**: Cloudflare Zero Trust Tunnel -> VPS Nginx (Localhost) -> PHP-FPM -> PostgreSQL/Redis  

---

## 1. Executive Summary & Architecture

The Callme Yoghurt platform employs a decoupled **Edge-BFF + Sovereign ERP Core** topology:

```
[ Customer Browser ]                 [ Admin Operator Browser ]
        │                                        │
        ▼                                        ▼
https://callme-yoghurt-storefront.vercel.app   https://callme-yoghurt-admin.vercel.app
        │                                        │
        └─────────────────┬──────────────────────┘
                          │ (HTTPS / Server-to-Server)
                          ▼
            [ Cloudflare Edge WAF & DNS ]
                          │
                          ▼ (Encrypted Zero-Trust Tunnel)
            [ Cloudflare Tunnel Daemon (cloudflared) ]
                          │
                          ▼ (http://localhost:80)
            [ Nginx Reverse Proxy (VPS) ]
                          │
                          ▼ (unix:/run/php/php8.3-fpm.sock)
            [ Laravel 13 ERP Core (PHP 8.3-FPM) ]
                   │                     │
                   ▼                     ▼
        [ PostgreSQL 16 (127.0.0.1) ]   [ Redis 7 (127.0.0.1) ]
```

### Zero-Trust & Cold-Chain Operational Mandates
1. **Network Isolation**: PostgreSQL (`5432`) and Redis (`6379`) are strictly bound to `127.0.0.1`. The UFW firewall explicitly blocks these ports from any external network.
2. **Zero Inbound Ingress**: By routing Vercel traffic through a Cloudflare Zero Trust Tunnel, the VPS does not even require open inbound ports (even port 80/443 can be locked to Cloudflare IPs or replaced entirely by Cloudflare Tunnel egress).
3. **Fail-Closed Secrets**: The production runtime refuses to boot if `ERP_SERVICE_TOKEN`, `CRM_PII_BLIND_INDEX_KEY`, or `ADMIN_SESSION_SECRET` are missing or default.
4. **Cold-Chain Fulfillment Integrity**: All transactional reservations derive directly from PostgreSQL numeric math (`NUMERIC(18,6)`) on the append-only stock ledger in the Jakarta Central Cold Chain Hub (`WH-COLD-JKT-01`).

---

## 2. Server Prerequisites & Target Specification

| Component | Target Specification | Purpose |
| :--- | :--- | :--- |
| **Operating System** | Ubuntu 24.04 LTS (Noble Numbat) | Long-Term Support, Linux kernel 6.8+ |
| **Compute** | 4 vCPU | Concurrent PHP-FPM worker pool & queue processing |
| **Memory** | 8 GB RAM | PostgreSQL shared buffers (2GB), PHP-FPM pool (3GB), Redis (1GB) |
| **Storage** | 160 GB NVMe SSD | High-IOPS transactional storage & PostgreSQL WAL logs |
| **Network** | Dedicated IPv4 + IPv6 | Outbound Cloudflare tunnel egress & secure SSH management |

---

## 3. Deployment Automation Suite (`deploy/vps/`)

All scripts are located in `deploy/vps/` and are fully automated, idempotent, and adhere to `set -euo pipefail`.

### Script Inventory
- `deploy/vps/01-server-hardening.sh`: Base OS hardening, unattended upgrades, UFW firewall, fail2ban, key-only SSH, and `callme` service user.
- `deploy/vps/02-install-stack.sh`: Installs Ondrej PHP 8.3-FPM + required extensions, Composer, Nginx, PostgreSQL 16, Redis 7 (AOF enabled), and Supervisor.
- `deploy/vps/03-setup-database.sh`: Automates PostgreSQL database (`callme_yoghurt_prod`) and user (`callme_erp_user`) provisioning with SCRAM-SHA-256 and localhost binding.
- `deploy/vps/04-deploy-app.sh`: Clones/pulls repo to `/var/www/callme-erp`, configures permissions, runs Composer `--no-dev`, applies migrations, generates caches, and restarts services.
- `deploy/vps/nginx/callme-erp.conf`: Production virtual host with FastCGI socket, rate limiting (`30r/s`), security headers, and hidden file access restrictions.
- `deploy/vps/supervisor/callme-worker.conf`: Supervisor daemon managing Laravel background queue workers on Redis.
- `deploy/vps/cloudflare/tunnel-config.yml`: Zero Trust Tunnel routing `erp-internal.callmeyoghurt.com` directly to `http://localhost:80`.
- `deploy/vps/.env.production.template`: Production configuration template with strict fail-closed requirements.

---

## 4. Step-by-Step Operator Execution Runbook

When the VPS server IP and SSH key are available, execute the following steps in sequence:

### Step 1: Initial SSH Connection & Upload
```bash
# Connect to clean VPS as root
ssh root@<VPS_IP_ADDRESS>

# Clone repository or scp deploy scripts
git clone -b phase0/foundation-repair https://github.com/Nachsyas/Callme-Yoghurt.git /tmp/callme-setup
cd /tmp/callme-setup/deploy/vps
chmod +x *.sh
```

### Step 2: Execute Server Hardening
```bash
# Run hardening script (UFW, Fail2ban, SSH hardening)
./01-server-hardening.sh
```
*Verification*:
- `ufw status verbose` shows: `22/tcp`, `80/tcp`, `443/tcp` ALLOW; `5432`, `6379`, `8000` DENY.
- SSH password authentication is disabled; only public keys are accepted.

### Step 3: Install Production Software Stack
```bash
# Run stack installation script
./02-install-stack.sh
```
*Verification*:
- `php -v` -> PHP 8.3.x
- `composer -V` -> Composer 2.x
- `psql --version` -> PostgreSQL 16.x
- `redis-cli ping` -> `PONG`
- `nginx -v` -> Nginx 1.24+

### Step 4: Provision & Harden PostgreSQL 16
```bash
# Set a strong database password (or let the script generate one)
export DB_PASSWORD=$(openssl rand -hex 24)
echo "Generated DB Password: $DB_PASSWORD"

./03-setup-database.sh
```
*Verification*:
- `psql -h 127.0.0.1 -U callme_erp_user -d callme_yoghurt_prod -c "SELECT version();"` succeeds.
- Remote attempts to connect on port 5432 from external IP are dropped by UFW and rejected by PostgreSQL.

### Step 5: Configure Nginx Virtual Host
```bash
cp /tmp/callme-setup/deploy/vps/nginx/callme-erp.conf /etc/nginx/sites-available/callme-erp.conf
ln -s /etc/nginx/sites-available/callme-erp.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

### Step 6: Deploy Laravel ERP Core Application
```bash
./04-deploy-app.sh
```
Before finalizing caches, edit `/var/www/callme-erp/backend-core/.env` to inject production secrets:
```bash
nano /var/www/callme-erp/backend-core/.env
```
Ensure the following variables are configured:
```ini
APP_NAME="Callme Yoghurt ERP Core"
APP_ENV=production
APP_KEY=base64:... # Generate via: php artisan key:generate --show
APP_DEBUG=false
APP_URL=https://erp-internal.callmeyoghurt.com

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=callme_yoghurt_prod
DB_USERNAME=callme_erp_user
DB_PASSWORD=<SECURE_DB_PASSWORD>

CACHE_STORE=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

CRM_PII_BLIND_INDEX_KEY=<HEX_32_CHARS>
ERP_SERVICE_TOKEN=<SECURE_64_CHAR_TOKEN>
CHECKOUT_FINGERPRINT_KEY=<HEX_32_CHARS>
ADMIN_SESSION_SECRET=<HEX_64_CHARS_MATCHING_VERCEL_ADMIN>

DEFAULT_FULFILLMENT_WAREHOUSE_CODE=WH-COLD-JKT-01
DEFAULT_FULFILLMENT_WAREHOUSE_NAME="Jakarta Central Cold Chain Hub"
```

Re-cache configurations:
```bash
cd /var/www/callme-erp/backend-core
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan migrate --force
```

### Step 7: Configure Supervisor Queue Workers
```bash
cp /tmp/callme-setup/deploy/vps/supervisor/callme-worker.conf /etc/supervisor/conf.d/callme-worker.conf
supervisorctl reread
supervisorctl update
supervisorctl status
```

### Step 8: Configure Cloudflare Zero Trust Tunnel
1. Install `cloudflared` on VPS:
```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
dpkg -i cloudflared.deb
```
2. Authenticate & Create Tunnel:
```bash
cloudflared tunnel login
cloudflared tunnel create callme-erp-tunnel
```
3. Route DNS:
```bash
cloudflared tunnel route dns callme-erp-tunnel erp-internal.callmeyoghurt.com
```
4. Copy and adjust `deploy/vps/cloudflare/tunnel-config.yml` to `/etc/cloudflared/config.yml`.
5. Install and start as system service:
```bash
cloudflared service install
systemctl enable cloudflared
systemctl start cloudflared
systemctl status cloudflared
```

### Step 9: Reconnect Vercel Frontend Deployments
Update Vercel environment variables in both projects:

#### Customer Storefront (`callme-yoghurt-storefront`)
```bash
vercel env add ERP_INTERNAL_URL production
# Enter: https://erp-internal.callmeyoghurt.com

vercel env add ERP_SERVICE_TOKEN production
# Enter: <MATCHING_ERP_SERVICE_TOKEN>

vercel --prod
```

#### Admin Console (`callme-yoghurt-admin`)
```bash
vercel env add ERP_INTERNAL_URL production
# Enter: https://erp-internal.callmeyoghurt.com

vercel env add ADMIN_SESSION_SECRET production
# Enter: <MATCHING_ADMIN_SESSION_SECRET>

vercel --prod
```

---

## 5. Verification & Health Check Procedure

### A. Local VPS Health Checks
```bash
# 1. Test public health check
curl -i http://localhost/api/health
# Expected: HTTP 200 OK, {"status":"ok","environment":"production"}

# 2. Test database & Redis readiness
curl -i http://localhost/api/ready
# Expected: HTTP 200 OK, {"database":"connected","redis":"connected"}

# 3. Test authenticated internal health check
curl -i -H "Authorization: Bearer <ERP_SERVICE_TOKEN>" http://localhost/api/internal/health
# Expected: HTTP 200 OK, {"status":"ok","authoritative_erp":"connected"}
```

### B. End-to-End Vercel -> VPS Integration Check
```bash
# Test catalog resolution via Storefront BFF
curl -i https://callme-yoghurt-storefront.vercel.app/api/catalog
# Expected: HTTP 200 OK, returning authoritative variants from PostgreSQL

# Test Admin login via Admin BFF
curl -i -X POST https://callme-yoghurt-admin.vercel.app/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@callmeyoghurt.com","password":"<TEST_PASSWORD>"}'
```

---

## 6. Rollback & Disaster Recovery Procedures

### Application Rollback
If a defect is detected in a new release:
```bash
cd /var/www/callme-erp
git checkout <PREVIOUS_STABLE_COMMIT>
composer install --no-dev --optimize-autoloader
php artisan migrate:status
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
systemctl restart php8.3-fpm
```

### Database Point-in-Time Recovery
Daily automated dumps are kept in `/var/backups/callme-db/`:
```bash
# Restore from encrypted backup
sudo -u postgres dropdb callme_yoghurt_prod
sudo -u postgres createdb -O callme_erp_user callme_yoghurt_prod
sudo -u postgres psql callme_yoghurt_prod < /var/backups/callme-db/callme_yoghurt_prod_YYYY-MM-DD.sql
```
