# Callme Yoghurt — Production Load & Stress Test Report Template (Phase 1.3A)

## 1. Executive Summary

| Attribute | Value |
| :--- | :--- |
| **Execution Date** | YYYY-MM-DD HH:MM:SS UTC |
| **Target Environment** | Staging / Production Simulation |
| **Target Endpoints** | `https://staging.callmeyoghurt.com`, `https://admin-staging...` |
| **Commit SHA** | `git rev-parse HEAD` |
| **Test Runner** | Grafana k6 vX.X.X |
| **Overall Verdict** | **PASS / CONDITIONAL / FAIL** |

---

## 2. Infrastructure Resource Utilization

| Component | Metric | Baseline / Idle | Peak Load | Capacity Threshold | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Next.js Vercel / Edge** | CPU Utilization (%) | < 10% | ___ % | < 80% | PASS/FAIL |
| | Memory Usage (MB) | ___ MB | ___ MB | < 1024 MB | PASS/FAIL |
| **Laravel ERP Backend** | CPU Utilization (%) | < 15% | ___ % | < 75% | PASS/FAIL |
| | Memory Usage (MB) | ___ MB | ___ MB | < 2048 MB | PASS/FAIL |
| **PostgreSQL 16** | Active Connections | ___ | ___ | < 80% of max_conn | PASS/FAIL |
| | Lock Wait Time (ms)| < 1ms | ___ ms | < 50ms | PASS/FAIL |
| | Transaction Commit Rate| ___/s | ___/s | N/A | OK |
| **Redis 7 (Rate Limit)**| Memory Used (MB) | ___ MB | ___ MB | < 256 MB | PASS/FAIL |
| | Hit / Miss Ratio | ___ % | ___ % | > 95% | PASS/FAIL |
| **Network** | Total Bandwidth In/Out | ___ KB/s | ___ MB/s | Within Limits | PASS/FAIL |

---

## 3. Application Performance Metrics (k6)

### 3.1 Throughput & Response Latency

| Scenario | Total Requests | Throughput (RPS) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Error Rate (%) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Scenario A: Catalog Browsing** | ___ | ___ req/s | ___ ms | ___ ms | ___ ms | ___ ms | ___ % (< 1%) | PASS/FAIL |
| **Scenario B: Checkout Concurrency**| ___ | ___ req/s | ___ ms | ___ ms | ___ ms | ___ ms | ___ % | PASS/FAIL |
| **Scenario C: Inventory Race** | ___ | ___ req/s | ___ ms | ___ ms | ___ ms | ___ ms | ___ % | PASS/FAIL |
| **Scenario D: Idempotency Stress** | ___ | ___ req/s | ___ ms | ___ ms | ___ ms | ___ ms | ___ % | PASS/FAIL |
| **Scenario E: Admin Auth Stress** | ___ | ___ req/s | ___ ms | ___ ms | ___ ms | ___ ms | ___ % | PASS/FAIL |

### 3.2 HTTP Status Code Distribution

| Status Code | Description | Count | Percentage (%) | Expectation |
| :--- | :--- | :--- | :--- | :--- |
| `200 OK` | Browsing & Idempotent Replays | ___ | ___ % | Expected |
| `201 Created` | Successful Checkouts | ___ | ___ % | Capped by initial stock |
| `401 Unauthorized`| Invalid Admin Credentials | ___ | ___ % | Expected on wrong pass |
| `409 Conflict` | OOS or In-Flight Lock | ___ | ___ % | Expected on stock exhaustion |
| `429 Too Many Req`| Rate Limiter Throttling | ___ | ___ % | Expected on brute force |
| `502 / 503` | Upstream Circuit Breaker | ___ | ___ % | Sanitized fallback |
| `500 Server Error`| Unhandled Exceptions | ___ | **0%** | Zero tolerance |

---

## 4. Business & Transactional Correctness

| Metric | Target Invariant | Actual Result | Verification SQL / Script | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **Successful Checkouts** | ≤ Available Stock Pool | ___ orders | `COUNT(*) FROM orders` | PASS/FAIL |
| **Rejected Checkouts (OOS)** | Total - Available Stock | ___ rejected | `orders_conflict_count` | PASS/FAIL |
| **Overselling Detection** | **0 units** (Zero overselling) | **___ units** | `01-inventory-consistency.sql` | **PASS/FAIL** |
| **Negative Stock Balance** | **0 rows** with sum(qty) < 0 | **___ rows** | `01-inventory-consistency.sql` | **PASS/FAIL** |
| **Idempotency Duplication** | **0 duplicate orders** | **___ duplicates**| `02-idempotency-integrity.sql` | **PASS/FAIL** |
| **Ledger Discrepancies** | Reservations = Allocations | ___ mismatch | `01-inventory-consistency.sql` | PASS/FAIL |
| **Admin Lockout Triggered**| Triggered after 5 failures | Lock active | `03-audit-log-verification.sql` | PASS/FAIL |
| **Credential Disclosure** | **Zero passwords/tokens** | **0 leaks** | `03-audit-log-verification.sql` | **PASS/FAIL** |

---

## 5. Identified Bottlenecks & Recommendations

* **Database Lock Contention**:
  * *Observation*:
  * *Remediation*:
* **Rate Limiter Latency**:
  * *Observation*:
  * *Remediation*:
* **Edge-to-ERP Transit Time**:
  * *Observation*:
  * *Remediation*:

---

## 6. Sign-off

* **Lead DevOps / SRE**: ____________________  (Date: ____________)
* **DevSecOps Architect**: ____________________ (Date: ____________)
