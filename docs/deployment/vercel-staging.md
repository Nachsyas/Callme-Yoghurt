# Callme Yoghurt — Vercel Staging & Production Deployment Guide

> **Phase 1.2C: Deployment Separation & Security Boundary Specification**
> 
> Strict Security Principle: Customer Storefront and Administrative Operations are distinct security zones. Under zero-trust architecture, administrative privileges and dashboard views must never be accessible from the public customer storefront.

---

## 1. Architectural Strategy: Dual-Project Deployment from Unified Codebase

To maintain clean code governance without monorepo fragmentation or duplicate repositories, Callme Yoghurt employs **Dual Vercel Deployments** connected to the same GitHub repository:

| Aspect | Customer Storefront | Admin Console |
| :--- | :--- | :--- |
| **Vercel Project** | `callme-yoghurt-storefront` | `callme-yoghurt-admin` |
| **Production Domain** | `callmeyoghurt.com` | `admin.callmeyoghurt.com` |
| **Staging Domain** | `staging.callmeyoghurt.com` | `admin-staging.callmeyoghurt.com` |
| **Root Directory** | `frontend` | `frontend` |
| **Framework Preset**| `Next.js` | `Next.js` |
| **Security Mode** | `NEXT_PUBLIC_APP_MODE=storefront` | `NEXT_PUBLIC_APP_MODE=admin` |
| **Protected Surface**| `/admin/*` blocked & redirected to `/` | `/admin/*` strictly requires authenticated session |

---

## 2. Customer Storefront Deployment

### 2.1 Project Setup on Vercel
1. In the Vercel Dashboard, select **Add New... > Project**.
2. Import repository `Nachsyas/Callme-Yoghurt`.
3. Configure Project Settings:
   - **Project Name**: `callme-yoghurt-storefront`
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

### 2.2 Storefront Environment Variables
Set the following variables under **Project Settings > Environment Variables**:

| Variable | Target Environments | Example Value | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Production, Preview | `production` | Node runtime environment |
| `NEXT_PUBLIC_APP_MODE` | Production, Preview | `storefront` | Enforces storefront isolation at Edge |
| `ERP_INTERNAL_URL` | Production, Preview | `https://erp-internal.callmeyoghurt.com` | Upstream Laravel ERP API |
| `ERP_SERVICE_TOKEN` | Production, Preview | `[SECRET_32_CHAR_BEARER_TOKEN]` | Internal service-to-service auth token |
| `REDIS_URL` | Production, Preview | `rediss://default:[PASS]@[HOST]:6379` | Distributed rate limiter storage |
| `TRUST_PROXY` | Production, Preview | `true` | Enables safe proxy IP resolution via Vercel |

> [!CAUTION]
> Never set `ADMIN_SESSION_SECRET` on the customer storefront project. Storefront must not possess administrative signing credentials.

---

## 3. Administrative Console Deployment

### 3.1 Project Setup on Vercel
1. In the Vercel Dashboard, select **Add New... > Project**.
2. Import repository `Nachsyas/Callme-Yoghurt` a second time.
3. Configure Project Settings:
   - **Project Name**: `callme-yoghurt-admin`
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

### 3.2 Admin Environment Variables
Set the following variables under **Project Settings > Environment Variables**:

| Variable | Target Environments | Example Value | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Production, Preview | `production` | Node runtime environment |
| `NEXT_PUBLIC_APP_MODE` | Production, Preview | `admin` | Activates administrative mode |
| `ADMIN_SESSION_SECRET` | Production, Preview | `[SECRET_64_CHAR_HEX_TOKEN]` | Cryptographic HMAC-SHA256 session key |
| `ERP_INTERNAL_URL` | Production, Preview | `https://erp-internal.callmeyoghurt.com` | Upstream Laravel ERP API for auth |

> [!IMPORTANT]
> `ADMIN_SESSION_SECRET` must match the value configured in Laravel ERP `ADMIN_SESSION_SECRET` to ensure cross-service cryptographic session parity.

---

## 4. Edge Middleware Enforcement (`middleware.ts`)

Next.js Edge Middleware acts as the application perimeter:
1. **Storefront Mode (`NEXT_PUBLIC_APP_MODE=storefront`)**:
   - Any request targeting `/admin` or `/admin/*` is instantly rejected with HTTP 307 redirecting to the customer homepage (`/`).
   - Admin dashboards and administrative login pages are completely inaccessible.
2. **Admin Mode (`NEXT_PUBLIC_APP_MODE=admin`)**:
   - Access to `/admin/login` is public.
   - All `/admin` and `/admin/*` routes strictly verify the `callme_admin_session` cookie via Web Crypto API HMAC-SHA256 verification.
   - Unauthenticated callers are redirected to `/admin/login?from=<destination>`.
   - Customer identities and invalid tokens fail closed.
   - Root `/` redirects to `/admin`.
3. **API Boundary (`/api/admin/*`)**:
   - `/api/admin/login` and `/api/admin/logout` are public authentication entry points.
   - All other `/api/admin/*` routes return HTTP 401 JSON when unauthenticated.

---

## 5. Upstream Backend Connectivity & Network Architecture

```
[ Customer Browser ] ---> [ Vercel Storefront: callmeyoghurt.com ]
                                   | (HTTPS + Bearer Token)
                                   v
[ Administrator ]     ---> [ Vercel Admin: admin.callmeyoghurt.com ]
                                   | (HTTPS + Internal Auth)
                                   v
                      [ Cloudflare / Tailscale VPC Tunnel ]
                                   |
                                   v
                      [ Laravel ERP Core (backend-core) ]
                                   |
                      +------------+------------+
                      |                         |
                      v                         v
               [ PostgreSQL 16 ]          [ Redis Cache ]
```

* **HTTPS Enforcement**: All communication between Vercel Serverless functions and Laravel ERP Core occurs over TLS/HTTPS.
* **Service-to-Service Authentication**: Public requests cannot invoke ERP internal routes directly. All internal endpoints (`/api/internal/*`) validate `Authorization: Bearer <ERP_SERVICE_TOKEN>` via `ValidateInternalServiceToken` middleware.
* **Circuit Breaker & Timeouts**: All BFF fetch calls enforce a strict 5000ms timeout via `AbortController`. Transport and upstream errors are sanitized to HTTP 502/503 without leaking stack traces or database connection strings.

---

## 6. Verification Checklist

Before promoting any staging deployment to production:
- [ ] Automated security test suite executes and passes: `npm run test:security`
- [ ] TypeScript compilation has zero errors: `npx tsc --noEmit`
- [ ] Production build succeeds: `npm run build`
- [ ] Storefront domain `https://staging.callmeyoghurt.com/admin` redirects to `/`.
- [ ] Admin domain `https://admin-staging.callmeyoghurt.com/admin` redirects to `/admin/login`.
- [ ] Admin authentication succeeds with valid `OWNER`/`ADMIN` credentials and issues HTTP-only cookie.
- [ ] Log out clears cookie and invalidates session.
- [ ] No server secrets appear in client HTML or JavaScript bundles.

---

## 7. Rollback Procedures

### 7.1 Vercel Instant Rollback
If a regression or configuration error is detected post-deployment:
1. Open the relevant project in the **Vercel Dashboard** (`callme-yoghurt-storefront` or `callme-yoghurt-admin`).
2. Navigate to the **Deployments** tab.
3. Locate the previous healthy deployment.
4. Click the three dots menu `(...)` and select **Instant Rollback** (or **Promote to Production**).
5. Traffic will be routed to the previous build in < 5 seconds without rebuild time.

### 7.2 Git Revert Rollback
If code changes must be reverted in source control:
1. Check out the active branch:
   ```bash
   git checkout phase0/foundation-repair
   git pull origin phase0/foundation-repair
   ```
2. Create a revert commit:
   ```bash
   git revert <REGRESSION_COMMIT_SHA> -m 1
   ```
3. Push to trigger automated CI and Vercel rebuild:
   ```bash
   git push origin phase0/foundation-repair
   ```

### 7.3 Database Safety Invariant
Under no circumstances should database rollbacks drop or truncate financial transaction tables (`orders`, `order_lines`, `stock_ledger_entries`, `stock_allocations`). Any database-level schema corrections must occur via forward-compatible additive migrations.
