# Callme Yoghurt — Online Deployment Report (Phase 1.4B)
**Document ID**: `DEP-ONLINE-1.4B`  
**Execution Date**: September 22, 2026  
**Repository Branch**: `phase0/foundation-repair`  
**Platform**: Vercel (Edge-BFF)  

---

## 1. Deployment Overview & Architecture

Callme Yoghurt's frontend has been deployed to Vercel using a **Dual-Project Deployment** model connected to the unified repository:

```
                            [ GitHub Repository ]
                          (phase0/foundation-repair)
                                     |
                 +-------------------+-------------------+
                 |                                       |
                 v                                       v
      [ Vercel Project 1 ]                        [ Vercel Project 2 ]
  `callme-yoghurt-storefront`                      `callme-yoghurt-admin`
                 |                                       |
  NEXT_PUBLIC_APP_MODE=storefront             NEXT_PUBLIC_APP_MODE=admin
                 |                                       |
                 v                                       v
https://callme-yoghurt-storefront.vercel.app  https://callme-yoghurt-admin.vercel.app
```

---

## 2. Deployment URLs & Status

| Service | Target URL | Mode / Context | Status | Security Boundary |
| :--- | :--- | :--- | :--- | :--- |
| **Customer Storefront** | [`https://callme-yoghurt-storefront.vercel.app`](https://callme-yoghurt-storefront.vercel.app) | `NEXT_PUBLIC_APP_MODE=storefront` | **ONLINE (PASS)** | `/admin` blocked & redirected to `/` |
| **Admin Console** | [`https://callme-yoghurt-admin.vercel.app`](https://callme-yoghurt-admin.vercel.app) | `NEXT_PUBLIC_APP_MODE=admin` | **ONLINE (PASS)** | `/` -> `/admin` -> `/admin/login` (HttpOnly Cookie) |

---

## 3. Pre-Deployment Build & Quality Gates

All pre-deployment checks executed and passed cleanly:
- `npm ci`: 120 packages audited in 4s (**0 vulnerabilities**).
- `npx tsc --noEmit`: Strict type checking (**0 errors**, zero `any`).
- `npm run test:security`: **133 passed** across 33 suites (0 failures).
- `npm run build`: Next.js 15.5.25 optimized build with 11 static pages and Edge middleware.
- `composer audit --locked`: **0 vulnerabilities** on Laravel 13 dependencies.
- `php artisan test`: **127 feature tests passed** (501 assertions).

---

## 4. Upstream Backend ERP Connectivity Assessment

### Status: **BLOCKED (Requires VPS Cloud Infrastructure)**

As mandated by Task 4 and architectural decision [ADR-0001](file:///Users/user/Documents/Callme%20Yoghurt/Callme-Yoghurt/docs/adr/ADR-0001-authoritative-phase0-architecture.md), zero dummy or fake production mock data was introduced.

- **Current State**: Laravel 13 ERP Core runs locally in the development workspace on PHP 8.3 / PostgreSQL 16 / Redis 7.
- **Blocker**: The ERP core has not yet been provisioned on an internet-facing Linux VPS with an encrypted Cloudflare Tunnel. Consequently, live transaction submission (`POST /api/checkout`) fails closed gracefully with sanitized HTTP 502/503 responses.
- **Recommended Production VPS Specification (Tier 1 <Rp 10M/year)**:
  - **Compute**: 4 vCPU, 8 GB RAM, 160 GB NVMe SSD.
  - **Operating System**: Ubuntu 24.04 LTS.
  - **Software Stack**: PHP 8.3-FPM, Laravel 13, PostgreSQL 16 (ACID, AES-256 PII encryption, Blind Index), Redis 7 (distributed rate limiting & queues), Nginx.
  - **Zero Trust Connectivity**: Cloudflare Tunnel (Tunnel daemon connecting VPS to Vercel BFF securely without opening public inbound ports).

---

## 5. Browser Automation Test Evidence

Real browser automation testing was performed against the live Vercel deployments:

1. **Customer Homepage**:
   - URL: `https://callme-yoghurt-storefront.vercel.app`
   - Verification: Branding, header, organic highlights, and product cards loaded cleanly without fatal errors.
   - Screenshot: `docs/deployment/screenshots/customer_homepage_1790058971115.png`

2. **Product Detail Page**:
   - URL: `https://callme-yoghurt-storefront.vercel.app/product/plain`
   - Verification: Size options, price calculation, nutritional breakdown, and **Cold Chain Storage Guidance (0-4°C)** displayed.
   - Screenshot: `docs/deployment/screenshots/product_detail_1790059038056.png`

3. **Checkout Page**:
   - URL: `https://callme-yoghurt-storefront.vercel.app/checkout`
   - Verification: Delivery method selection, customer information form, and cart items rendered cleanly.
   - Screenshot: `docs/deployment/screenshots/checkout_page_1790059098229.png`

4. **Admin Unauthorized Redirect**:
   - Action: Direct navigation to `https://callme-yoghurt-admin.vercel.app/admin` without active session.
   - Verification: Edge middleware intercepted request and issued `HTTP 307` redirecting to `/admin/login?from=%2Fadmin`.
   - Screenshot: `docs/deployment/screenshots/admin_login_redirect_1790059181979.png`

5. **Admin Login Page**:
   - URL: `https://callme-yoghurt-admin.vercel.app/admin/login`
   - Verification: Admin email and password form rendered with sanitized generic error handling and zero token persistence in `localStorage`.
   - Screenshot: `docs/deployment/screenshots/admin_login_page_1790059199047.png`

---

## 6. Security Posture Verification

- **Client Bundle Audit**: Automated regex scanner inspected all `.js` chunks across both online deployments for `ERP_SERVICE_TOKEN`, `ADMIN_SESSION_SECRET`, `DATABASE_URL`, and `REDIS_URL`. Result: **0 secret leaks**.
- **Edge Security Headers**:
  - `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'`
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- **Transport Security**: HTTPS enforced on all requests with TLS 1.3.
