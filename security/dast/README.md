# Dynamic Application Security Testing (DAST) Framework — Phase 1.4A

External Dynamic Application Security Testing (DAST) suite and OWASP ZAP baseline scan integration for the Callme Yoghurt Enterprise Platform.

---

## 1. Security Testing Principles

- **Strict Staging Isolation**: DAST scans execute exclusively against staging endpoints:
  - **Customer Storefront**: `https://staging.callmeyoghurt.com`
  - **Admin Operations Portal**: `https://admin-staging.callmeyoghurt.com`
- **Zero Production Impact**: Running DAST or active scans against production domains (`https://callmeyoghurt.com`) is strictly prohibited and programmatically blocked by scan runners.
- **Fail-Closed Boundary**: Any unauthenticated request to privileged routes or invalid session tokens must result in an immediate redirect or rejection.

---

## 2. Directory Structure

```
security/dast/
├── README.md                      # Architecture and operational documentation
├── zap-config.yaml                # OWASP ZAP Automation Framework configuration
├── zap-report/                    # Target directory for generated HTML and Markdown reports
│   ├── .gitkeep
│   ├── zap-report.html            # Traditional HTML scan report
│   └── zap-report.md              # Traditional Markdown scan report
└── scripts/
    └── run-zap-scan.sh            # Automated scan runner script with safety guards
```

---

## 3. OWASP ZAP Automation Framework Configuration

The [`zap-config.yaml`](zap-config.yaml) file defines the scan parameters:

1. **Contexts**:
   - **Customer Storefront**: Spiders and passive-scans public routes (`/`, `/product/*`, `/checkout`, `/api/catalog`, `/api/checkout`).
   - **Admin Operations Portal**: Targets administrative boundaries (`/admin/*`, `/api/admin/*`) with JSON-based authentication flow.
2. **Authentication Flow**:
   - **Login Endpoint**: `POST /api/admin/login`
   - **Payload**: `{"email":"{%username%}","password":"{%password%}"}`
   - **Session Verification**: Checks response for `"role":"(OWNER|ADMIN)"`.
   - **Cookie Tracking**: Manages `callme_admin_session` cookie.
3. **Scan Jobs**:
   - `passiveScan-config`: Configures passive scan rules and thresholds.
   - `spider`: Crawls both customer and admin contexts.
   - `passiveScan-wait`: Ensures all responses in scope are analyzed.
   - `activeScan`: Runs targeted active scans against input parameters.
   - `report`: Produces HTML and Markdown reports into `zap-report/`.

---

## 4. DAST Security Check Matrix

| Vector | Target / Surface | Expected Behavior | Verification Status |
| :--- | :--- | :--- | :---: |
| **Authentication** | `/admin/*`, `/api/admin/*` | Unauthenticated requests redirected to `/admin/login` or 401; logout invalidates cookie; expired session rejected | **PASS** |
| **Cookie Flags** | `callme_admin_session` | `HttpOnly; Secure; SameSite=Lax` flags strictly enforced on set-cookie | **PASS** |
| **Authorization** | Customer accessing `/admin`; ADMIN attempting OWNER actions | Customer redirected; ADMIN denied OWNER-only operations (`admin:users:manage`, etc.) | **PASS** |
| **API Security** | `/api/catalog`, `/api/checkout`, `/api/admin/*` | No internal URL/token leakage; strict parameter validation; no verbose 500 stack traces | **PASS** |
| **Injection** | Form inputs, query params, JSON bodies | Reflected/stored XSS prevented; SQLi neutralized; prototype pollution blocked | **PASS** |
| **Security Headers** | All HTTP responses | CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy present | **PASS** |

---

## 5. Execution Instructions

### Dry-Run / Target Validation
```bash
./security/dast/scripts/run-zap-scan.sh --dry-run
```

### Full Scan via Official Docker Image
```bash
./security/dast/scripts/run-zap-scan.sh
```
Or directly:
```bash
docker run --rm \
    -v "$(pwd)/security/dast:/zap/wrk/:rw" \
    -t ghcr.io/zaproxy/zaproxy:stable \
    zap.sh -cmd -autorun /zap/wrk/zap-config.yaml
```
Reports are automatically written to `security/dast/zap-report/`.
