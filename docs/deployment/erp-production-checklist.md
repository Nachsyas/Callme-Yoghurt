# Callme Yoghurt ERP Core — Production Release Checklist

> **Phase 1.7C.21 Deployment Readiness**  
> Status: **DEPLOYMENT READY** (Pending Owner Host Selection)  
> Host: *Provider-Neutral* (Pending Owner Decision)  
> DNS Hostname Target: `staging-erp.callmeyoghurt.com`

---

## Pre-Deployment Context & Boundaries

- There is currently **NO reachable production ERP host**.
- Current Vercel configuration points to `https://staging-erp.callmeyoghurt.com`, but DNS does not currently resolve.
- **Provider Choice is Reserved for the Owner**: No hosting provider (Railway, Render, Fly.io, Hetzner, AWS, DigitalOcean, VPS) may be selected arbitrarily without explicit owner approval.
- **No Real Couriers / Payments**: Real Biteship courier dispatch and live payment gateways remain blocked until production verification completes.

---

## 18-Step Ordered Release Sequence

Execute these steps strictly in sequence once the hosting environment is approved by the owner:

### 1. Provision Backend Host
- Provision container host or low-cost Linux VPS (minimum 1–2 vCPU, 2GB RAM).
- Ensure Docker Engine or container runtime is installed and operational.
- Verify security group / firewall rules: expose **only** ports 80/443 publicly (or route entirely through private Cloudflare Tunnel / VPC ingress).

### 2. Provision PostgreSQL Database
- Provision PostgreSQL 16+ instance (managed cloud database or isolated Docker container on private network).
- Ensure PostgreSQL is **never exposed to the public Internet**.
- Enable TLS/SSL connection mode (`DB_SSLMODE=prefer` or `require`).
- Create dedicated database user `callme_erp_user` with least-privilege rights on database `callme_yoghurt_prod`.

### 3. Provision Redis Ephemeral Store
- Provision Redis 7+ instance with authentication enabled (`requirepass`).
- Ensure Redis is strictly isolated on the private network (zero public port exposure).
- Enable persistence (`appendonly yes`) and configure memory policy (`maxmemory-policy allkeys-lru`).

### 4. Provision S3-Compatible Object Storage (Optional for Boot)
- Provision AWS S3 bucket, Cloudflare R2, or MinIO bucket `callme-erp-storage`.
- Set bucket access policy to **strictly private** (no public object reading).
- Configure dedicated IAM/API credentials with scoped read/write access to this bucket only.
- *Note: Object storage is not required for ERP boot or checkout; only required when upload features (e.g., complaint unboxing videos) are exercised.*

### 5. Configure Production Environment Variables
- Copy `backend-core/.env.example` into secure host secret store or `.env`.
- Ensure `APP_ENV=production` and `APP_DEBUG=false`.
- Configure `DB_*` and `REDIS_*` connection details.
- Set `CACHE_STORE=redis` and `SHIPPING_CACHE_STORE=redis`.
- Set `HASH_DRIVER=argon2id`.

### 6. Set Cryptographic and Authentication Secrets
- Generate high-entropy CSPRNG secrets:
  - `APP_KEY`: Generated via `php artisan key:generate --show` (base64 32-byte key).
  - `ERP_SERVICE_TOKEN`: `openssl rand -hex 32` (64 hex characters). Must match Vercel BFF `ERP_SERVICE_TOKEN`.
  - `CRM_PII_BLIND_INDEX_KEY`: `openssl rand -hex 32` (64 hex characters).
  - `CHECKOUT_FINGERPRINT_KEY`: `openssl rand -hex 32` (64 hex characters).
  - `ADMIN_SESSION_SECRET`: `openssl rand -hex 32` (64 hex characters).
- Run pre-flight security check:
  ```bash
  php artisan callme:validate-production-config
  ```
  Must output: `[Callme ERP] All security-critical configuration checks PASSED.`

### 7. Run Database Migrations
- Run authoritative schema migrations:
  ```bash
  php artisan migrate --force
  ```
- Verify all 21 migrations report `DONE` with 0 failures:
  ```bash
  php artisan migrate:status
  ```
- *Never run rollback, reset, or refresh commands on production.*

### 8. Provision OWNER Administrator Safely
- Run CLI command to provision the initial owner account:
  ```bash
  php artisan callme:create-owner --name="Callme ERP Owner" --email="<owner_email>" --password="<secure_owner_password>"
  ```
- Confirm audit log entry created in `admin_audit_logs`.

### 9. Verify Public Liveness Probe (/api/health)
- Probe process health:
  ```bash
  curl -fsS http://127.0.0.1:8000/api/health
  ```
- Expected response:
  ```json
  {"status":"ok","service":"erp-core"}
  ```
- Confirm zero internal runtime, version, or credential leaks.

### 10. Verify Public Readiness Probe (/api/ready)
- Probe database and Redis readiness:
  ```bash
  curl -fsS http://127.0.0.1:8000/api/ready
  ```
- Expected response:
  ```json
  {"status":"ready","service":"erp-core","database":"connected","redis":"connected"}
  ```
- If either PostgreSQL or Redis is unreachable, endpoint must return HTTP 503 `status: unavailable`.

### 11. Configure DNS
- Register DNS record for `staging-erp.callmeyoghurt.com` in authoritative DNS provider (Cloudflare, Namecheap, Route53, etc.):
  - **Pattern A (CNAME)**: `staging-erp.callmeyoghurt.com` CNAME `<provider_domain>`
  - **Pattern B (A/AAAA)**: `staging-erp.callmeyoghurt.com` A `<server_ipv4>`
- Do not fabricate target IP/hostname before owner selection.

### 12. Enable HTTPS / TLS
- Issue trusted TLS certificate (Let's Encrypt via Caddy, Certbot, or Cloudflare Universal SSL).
- Enforce HTTP-to-HTTPS automatic 301 redirection.
- Verify TLS handshake:
  ```bash
  curl -fsSL -I https://staging-erp.callmeyoghurt.com/api/health
  ```

### 13. Verify Authenticated Service Route (/api/internal/health)
- Probe S2S authentication with the bearer service token:
  ```bash
  curl -fsSL -H "Authorization: Bearer <ERP_SERVICE_TOKEN>" https://staging-erp.callmeyoghurt.com/api/internal/health
  ```
- Expected response:
  ```json
  {"status":"ok","service":"erp-core","channel":"internal"}
  ```
- Verify unauthenticated or invalid token requests return HTTP 401 Unauthorized.

### 14. Update Vercel BFF Upstream URL (If Needed)
- Verify Vercel environment variable `ERP_INTERNAL_URL` is set to `https://staging-erp.callmeyoghurt.com`.
- Verify `ERP_SERVICE_TOKEN` in Vercel matches the backend configuration.
- Trigger Vercel redeployment / verify upstream connectivity.

### 15. Verify BFF Catalog Integration
- Probe BFF catalog API:
  ```bash
  curl -fsSL https://callmeyoghurt.com/api/catalog
  ```
- Confirm product data is authoritatively served by Laravel PostgreSQL.

### 16. Verify BFF Shipping Quote Integration
- Probe BFF shipping quote endpoint with test cart payload:
  ```bash
  curl -fsSL -X POST https://callmeyoghurt.com/api/shipping/quote -H "Content-Type: application/json" -d '{"items":[...],"destination":{...}}'
  ```
- Verify quote ID is generated, stored in Redis, and rates conform to Cold Chain SOP 01 rules.

### 17. Run Production Smoke Tests & Screenshots
- Execute automated smoke test suite:
  ```bash
  npx playwright test tests/e2e/staging-smoke.spec.ts
  ```
- Capture verification screenshots of storefront, checkout, and admin login.

### 18. Enable Transactional Business Inputs (Owner Sign-Off)
- Only after all 17 previous steps succeed:
  - Input owner-approved `SERVICE_FEE_IDR`.
  - Input owner-verified shipping origin postal code and coordinates.
  - Set `SHIPPING_ORIGIN_VERIFIED=true`.
  - Switch Biteship and payment gateways to production credentials.

---

## Rollback & Incident Procedure

If any step fails during the release:
1. Do **not** run destructive database rollback commands.
2. Ingress traffic can be held off by keeping DNS unpointed or pointing Vercel to maintenance mode.
3. Inspect container logs via `docker logs callme_erp_app` or container platform log viewer.
4. Correct configuration errors and re-run `php artisan callme:validate-production-config`.
