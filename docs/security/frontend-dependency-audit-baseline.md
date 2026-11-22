# Frontend Dependency Security Audit Baseline — Phase 1.4B

**Date**: September 2026  
**Audited Directory**: `frontend/`  
**Package Manager**: `npm` (v11 / Node.js v26)  
**Initial Vulnerability Summary**: **15 vulnerabilities** (1 Critical, 9 High, 5 Moderate)  

---

## 1. Executive Summary

A comprehensive supply chain vulnerability audit was performed on the Callme Yoghurt frontend application (`callme-yoghurt-frontend@1.0.0`) prior to dependency remediation. The audit revealed 15 known vulnerability advisories across both direct and transitive dependencies.

Importantly, production dependency filtering (`npm audit --production`) reduced the direct runtime attack surface to 4 vulnerabilities (all residing in `next` and its bundled build utilities), while 11 vulnerabilities stemmed from development-only tooling (`prisma@7.8.0` pulling `@prisma/dev`, `hono`, `valibot`, and `mysql2`).

---

## 2. Vulnerability Catalog

| Package Name | Dependency Path | Severity | Advisory ID | Affected Range | Recommended Target | Classification & Production Impact |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| **`next`** | `next` (Direct) | **Critical** | [GHSA-p293-qw3h-jr36](https://github.com/advisories/GHSA-p293-qw3h-jr36)<br>[GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4)<br>[GHSA-7m27-7ghc-44w9](https://github.com/advisories/GHSA-7m27-7ghc-44w9)<br>[GHSA-f82v-jwr5-mffw](https://github.com/advisories/GHSA-f82v-jwr5-mffw) | `9.3.4-canary.0` - `16.3.0-preview.10` | `15.5.25` | **Runtime (Critical)**: Denial of Service in Server Actions, RCE via AVIF image optimization, middleware redirect handling flaw. |
| **`postcss`** | `next -> postcss`<br>`postcss` (Direct Dev) | **High** | [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q)<br>[GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849)<br>[GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) | `<=8.5.22` | `8.5.28` | **Build-Time (High)**: Path traversal in source map auto-loading leading to arbitrary `.map` file disclosure; CSS stringify XSS. |
| **`sharp`** | `next -> sharp` (Transitive) | **High** | [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj)<br>[GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) | `<=0.35.4-rc.0` | `0.33.5` (via next 15.5) | **Runtime (High)**: Memory safety and heap buffer overflow issues in underlying C libraries (`libvips`, `libheif`). |
| **`nanoid`** | `postcss -> nanoid`<br>`next -> postcss -> nanoid` | **High** | [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv)<br>[GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) | `<=3.3.17` | `3.3.18+` | **Build-Time (Low)**: Infinite loop denial of service when custom generator receives zero or negative size parameter. |
| **`valibot`** | `prisma -> @prisma/dev -> valibot` | **Moderate** | [GHSA-5qjj-4xww-7phc](https://github.com/advisories/GHSA-5qjj-4xww-7phc) | `<=1.4.1` | `1.4.2+` | **Development-Only (None)**: Schema validation error path exception on prototype properties. Not deployed in production. |
| **`hono`** | `prisma -> @prisma/dev -> @hono/node-server -> hono` | **Moderate** | [GHSA-8j4g-w8fx-2239](https://github.com/advisories/GHSA-8j4g-w8fx-2239)<br>[GHSA-f23p-vx2j-j53r](https://github.com/advisories/GHSA-f23p-vx2j-j53r)<br>[GHSA-g6gw-c38x-mqfc](https://github.com/advisories/GHSA-g6gw-c38x-mqfc) | `<=4.12.28` | `4.12.30+` | **Development-Only (None)**: ReDoS in CORS headers and memory exhaustion on unbounded dot-notation in Prisma dev server. |
| **`mysql2`** | `prisma -> mysql2` | **High** | [GHSA-3f6p-5ww8-9rcr](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr)<br>[GHSA-rgwj-5xj2-c3m3](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3) | `<=3.23.0` | `3.23.1+` | **Development-Only (None)**: Decompression bomb DoS and auth downgrade in MySQL client. Callme Yoghurt uses PostgreSQL; MySQL client unused. |

---

## 3. Dependency Outdated Status

```
Package           Current       Wanted       Latest    Risk Level
-------------------------------------------------------------------
next              15.0.0        15.0.0       16.3.5    Upgrade to Next.js 15.5.25 (Stable)
postcss           8.5.16        8.5.28       8.5.28    Safe minor bump to 8.5.28
autoprefixer      10.5.2        10.6.1       10.6.1    Safe minor bump to 10.6.1
@prisma/client    7.8.0         7.10.0       7.10.0    Legacy prototype dependency
prisma            7.8.0         7.10.0       8.0.0-rc  Legacy prototype dependency
```

---

## 4. Remediation Strategy

1. **Upgrade Next.js**: Pin `next` to `15.5.25` (latest stable Next.js 15), preserving App Router, React 19 compatibility, and Edge middleware runtime.
2. **Update CSS Toolchain**: Bump `postcss` to `>=8.5.28` and `autoprefixer` to `>=10.6.1` to eliminate source-map path traversal and CSS stringify XSS advisories.
3. **Prune / Decouple Unused Dependencies**: Prune unused `@prisma/client` and `prisma` packages from `frontend/package.json` since PostgreSQL persistence is 100% authoritative in Laravel ERP (ADR-0001 / ADR-0003), eliminating 11 transitive advisories.
4. **Regenerate Clean Lockfile**: Reinstall via `npm install` and verify reproducible lockfile integrity via `npm ci` and `npm audit --production`.
