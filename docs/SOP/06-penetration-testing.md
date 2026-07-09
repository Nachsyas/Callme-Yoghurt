# SOP 06 — Local Penetration Testing & Observability

> **Tujuan**: Menguji ketahanan infrastruktur dengan simulasi serangan siber brutal sebelum *website* dirilis ke publik.

## 1. Simulasi Serangan Brutal Lokal
Sistem disiapkan untuk diorkestrasi bersama *container* peretas. Secara berkala, jalankan OWASP ZAP (untuk mencari celah XSS, CSRF) dan SQLmap (untuk mencoba *SQL Injection*) yang ditembakkan langsung ke *endpoint* BFF lokal.

## 2. Error Telemetry Aman (Sentry)
Integrasikan Sentry SDK untuk melacak *error* 500 secara *real-time*. Namun, konfigurasi *data scrubbing* harus sangat ketat. Sensor semua *password*, *token authorization*, dan data kartu bayar agar tidak pernah tercatat di *log* dasbor Sentry.

## 3. Structured Logging
Tinggalkan *print* atau *log* statis biasa. Laravel dan FastAPI wajib mengeluarkan format log terstruktur (JSON). Ini memudahkan ekstraksi dan analitik otomatis oleh Prometheus/Grafana untuk memonitor apakah ada lonjakan API *request* palsu ke sistem logistik ongkir.
