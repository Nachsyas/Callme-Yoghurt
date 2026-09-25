# Callme Yoghurt — Production Load & Stress Testing Framework (Phase 1.3A)

This framework executes realistic load, concurrency, race condition, idempotency, and security stress tests against the Callme Yoghurt storefront and operations portals using **Grafana k6**.

---

## 1. Prerequisites & Installation

### 1.1 macOS (Homebrew)
```bash
brew install k6
```

### 1.2 Linux (Debian / Ubuntu)
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### 1.3 Docker
```bash
docker run --rm -i -v $(pwd):/tests grafana/k6 run /tests/tests/load/catalog-load.js
```

Verify installation:
```bash
k6 version
```

---

## 2. Environment Variables Configuration

Copy `.env.example` to create your local test profile:
```bash
cp tests/load/.env.example tests/load/.env
```

| Variable | Default | Description |
| :--- | :--- | :--- |
| `STAGING_URL` | `http://127.0.0.1:3000` | Target URL for customer storefront and public APIs |
| `ADMIN_URL` | `http://127.0.0.1:3000` | Target URL for admin console (`https://admin-staging...`) |
| `ERP_INTERNAL_URL` | `http://127.0.0.1:8000` | Upstream Laravel ERP service endpoint |
| `TEST_CUSTOMER_EMAIL` | `loadtest.customer@...` | Synthetic test customer identifier |
| `TEST_ADMIN_EMAIL` | `admin@callmeyoghurt.com` | Target admin email for brute force stress test |
| `TEST_ADMIN_PASSWORD`| `SyntheticLoadTest...` | Target password test vector |
| `TEST_VARIANT_ID` | `018f6c38-...` | UUID of product variant in authoritative catalog |
| `FULL_RUN` | `false` | `false` runs fast smoke profiles (5-10s); `true` runs full 12+ min production profiles |

---

## 3. Test Scenarios & Execution Commands

### 3.1 Scenario A: Customer Browsing Load Test
Simulates ramping customer traffic through landing, product details, and catalog APIs:
* **Smoke Run (Default)**: 15 VUs, ~7 seconds.
* **Full Production Run**: 0 → 50 (2m) → 200 (5m) → 500 users (5m).
```bash
# Smoke Run
k6 run tests/load/catalog-load.js

# Full Production Profile
FULL_RUN=true k6 run tests/load/catalog-load.js
```
**Thresholds**:
* `http_req_failed < 1%`
* `p95 latency < 1000ms`

### 3.2 Scenario B: Checkout Concurrency & Transaction Integrity
Spawns 100 concurrent checkout submissions, asserting correct status codes and non-leakage of ERP credentials:
```bash
k6 run tests/load/checkout-load.js

# Full 100-VU profile
FULL_RUN=true k6 run tests/load/checkout-load.js
```

### 3.3 Scenario C: Inventory Race Condition Test
Submits simultaneous checkouts competing for a limited batch of stock (10 units), proving zero overselling:
```bash
k6 run tests/load/inventory-race-test.js
```
**Invariants**:
* Exactly `<= 10` transactions succeed (`HTTP 201`).
* All surplus orders receive `HTTP 409 Conflict` (insufficient stock).
* `race_oversold_rate == 0`.

### 3.4 Scenario D: Idempotency Stress Test
Sends 100 concurrent requests containing the **exact same** `Idempotency-Key`:
```bash
k6 run tests/load/idempotency-stress.js
```
**Invariants**:
* Exactly 1 transaction created (`HTTP 201`).
* Subsequent / concurrent calls return `HTTP 200 Replay` or `HTTP 409 Conflict`.
* `idemp_duplicate_anomaly_rate == 0`.

### 3.5 Scenario E: Admin Authentication Stress
Simulates high-velocity credential stuffing / brute force attack against `/api/admin/login`:
```bash
k6 run tests/load/admin-login-stress.js

# Full 1000-attempt profile
FULL_RUN=true k6 run tests/load/admin-login-stress.js
```
**Invariants**:
* HTTP 401 on initial failures, HTTP 429 on rate limiter trigger.
* `auth_bypass_anomaly_rate == 0` (HTTP 200 NEVER returned on invalid credentials).

---

## 4. Post-Test Database Verification

After executing stress tests, run the SQL observation scripts against the staging PostgreSQL database to verify transaction and ledger integrity:

```bash
# 1. Verify stock balances, active reservations, and FEFO lot allocations
psql "$DATABASE_URL" -f tests/load/database-checks/01-inventory-consistency.sql

# 2. Verify idempotency key hashes, zero duplicate order numbers, and matching order lines
psql "$DATABASE_URL" -f tests/load/database-checks/02-idempotency-integrity.sql

# 3. Verify admin audit log entries and account lockout records
psql "$DATABASE_URL" -f tests/load/database-checks/03-audit-log-verification.sql
```

---

## 5. Interpreting Results

| k6 Metric | Target / Benchmark | Action If Violated |
| :--- | :--- | :--- |
| `http_req_failed` | `< 1%` | Check BFF circuit breaker logs or upstream ERP connectivity. |
| `http_req_duration (p95)` | `< 1000ms` (storefront), `< 3000ms` (checkout) | Inspect database query plans, lock contention, or network latency. |
| `race_oversold_rate` | `0%` | **Critical P0**: Stop deployment immediately. Review PostgreSQL advisory locks and FEFO allocation transactions. |
| `idemp_duplicate_anomaly_rate` | `0%` | **Critical P0**: Investigate database unique index on `order_idempotency_keys`. |
| `auth_bypass_anomaly_rate` | `0%` | **Critical Security**: Review password verification and session token issuance. |
