# Callme ERP Core — Small Production Docker Deployment Guide

Panduan resmi untuk melakukan deployment kontainer Callme ERP Core menggunakan Docker Compose pada arsitektur Virtual Private Server (VPS) berbiaya hemat (Low-Cost VPS).

---

## 1. Arsitektur Deployment & Profil Sumber Daya

Sistem dirancang untuk beroperasi secara stabil, hemat memori, dan tangguh pada VPS berspesifikasi minimal:

### Profil Target VPS:
- **CPU**: 1-2 vCPU
- **RAM**: 2 GB RAM (Total)
- **Disk**: 20-40 GB NVMe / SSD
- **OS**: Ubuntu 22.04 / 24.04 LTS

### Arsitektur Jaringan Kontainer:
```text
                         [ Users / Public Internet ]
                                      |
                                      v
                                [ Cloudflare ]
                                      |
                                      v
                        [ Vercel Next.js Frontend ]
                           (Storefront + Admin)
                                      |
                                      v
                           [ Cloudflare Tunnel ]
                                      |
                     [ VPS Host (Port 80/443 or 8000) ]
                                      |
               +---------------------------------------------+
               |       Docker Network: internal_net          |
               |                                             |
               |  [ Nginx: web ]                             |
               |         | (FastCGI TCP: app:9000)           |
               |         v                                   |
               |  [ PHP 8.3-FPM: app ]                       |
               |         |                 |                 |
               |         v                 v                 |
               |  [ PostgreSQL 16 ]   [ Redis 7 ]            |
               |         ^                 ^                 |
               |         |                 |                 |
               |  [ Worker: queue:work (Single Process) ]    |
               +---------------------------------------------+
```

### Alokasi Memori (Target Total < 1000 MB dari 2048 MB):
| Layanan | Kontainer | Limit Memori | Konfigurasi Tuning |
|---|---|---|---|
| **Web Server** | `callme_erp_web` | 64 MB | Nginx 1.27 Alpine, Gzip level 6, rate limiting 30r/s |
| **Backend App** | `callme_erp_app` | 512 MB | PHP 8.3-FPM Alpine, OPcache (64MB), dynamic worker (max 10) |
| **Queue Worker** | `callme_erp_worker` | 192 MB | Single CLI process (`--memory=128`, `--sleep=5`, `--tries=3`) |
| **PostgreSQL** | `callme_erp_postgres` | 384 MB | `max_connections=30`, `shared_buffers=128MB`, `work_mem=4MB` |
| **Redis** | `callme_erp_redis` | 160 MB | `maxmemory=128mb`, `allkeys-lru`, `appendonly=yes` |
| **OS / Buffer** | Host Ubuntu | ~700 MB | Buffer sistem operasi & kernel caching |

> [!IMPORTANT]
> **Zero Public Database Exposure**: Port PostgreSQL (`5432`) dan Redis (`6379`) **TIDAK DIBUKA** ke jaringan publik. Akses antar-layanan terisolasi penuh di dalam private Docker bridge network (`internal_net`).

---

## 2. Persiapan Lingkungan & Variabel Produksi

Buat file `.env.production` di root repositori sebelum menjalankan Docker Compose. Anda dapat menyalin dari template:

```bash
cp deploy/vps/.env.production.template .env.production
```

Pastikan seluruh variabel rahasia diisi dengan nilai yang kuat:

```env
# Framework & URL
APP_NAME="Callme Yoghurt ERP Core"
APP_ENV=production
APP_KEY=base64:YOUR_GENERATED_APP_KEY_HERE
APP_DEBUG=false
APP_URL=https://erp.callmeyoghurt.com
HTTP_PORT=8000

# PostgreSQL 16 (Authoritative System of Record)
DB_DATABASE=callme_yoghurt_prod
DB_USERNAME=callme_erp_user
DB_PASSWORD=YOUR_HIGH_ENTROPY_DB_PASSWORD_32_CHARS

# Redis 7 (Ephemeral Cache, Session & Queue)
REDIS_PASSWORD=YOUR_HIGH_ENTROPY_REDIS_PASSWORD_32_CHARS

# Zero-Trust Cryptographic Secrets
CRM_PII_BLIND_INDEX_KEY=YOUR_32_CHAR_CRM_BLIND_INDEX_KEY
ERP_SERVICE_TOKEN=YOUR_64_CHAR_ERP_SERVICE_BEARER_TOKEN
CHECKOUT_FINGERPRINT_KEY=YOUR_32_CHAR_CHECKOUT_FINGERPRINT_KEY
ADMIN_SESSION_SECRET=YOUR_64_HEX_CHAR_ADMIN_SESSION_SECRET

# S3-Compatible Object Storage (AWS S3 / Cloudflare R2 / MinIO)
OBJECT_STORAGE_ACCESS_KEY=YOUR_R2_OR_S3_ACCESS_KEY
OBJECT_STORAGE_SECRET_KEY=YOUR_R2_OR_S3_SECRET_KEY
OBJECT_STORAGE_BUCKET=callme-yoghurt-production
OBJECT_STORAGE_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
OBJECT_STORAGE_REGION=auto
OBJECT_STORAGE_PATH_STYLE=true
```

---

## 3. Perintah Build & Run

### A. Build Image Produksi
```bash
docker compose -f docker-compose.production.yml --env-file .env.production build
```

### B. Menjalankan Seluruh Stack
```bash
docker compose -f docker-compose.production.yml --env-file .env.production up -d
```

### C. Memeriksa Status Kontainer & Health Probes
```bash
docker compose -f docker-compose.production.yml ps
```

Uji endpoint liveness dan readiness melalui HTTP:
```bash
# Liveness probe
curl -i http://127.0.0.1:8000/api/health
# Response: {"status":"ok","service":"erp-core"}

# Readiness probe (memverifikasi koneksi PostgreSQL aktif)
curl -i http://127.0.0.1:8000/api/ready
# Response: {"status":"ready","service":"erp-core","database":"connected"}
```

---

## 4. Inisialisasi Akun OWNER Pertama

Setelah kontainer berjalan pertama kali:

```bash
docker compose -f docker-compose.production.yml exec app php artisan callme:create-owner
```

Ikuti instruksi di CLI untuk memasukkan Nama, Email, dan Password pemilik sistem.

---

## 5. Pemeliharaan & Migrasi Database

### Menjalankan Migrasi Manual
Skrip entrypoint `docker-entrypoint.sh` secara otomatis menjalankan `php artisan migrate --force` saat kontainer `app` menyala. Namun jika diperlukan migrasi manual:

```bash
docker compose -f docker-compose.production.yml exec app php artisan migrate --force
```

### Memeriksa Status Antrean (Queue Worker)
```bash
docker compose -f docker-compose.production.yml logs -f worker
```

---

## 6. Prosedur Backup & Restore

### Backup Database PostgreSQL
Jalankan dump terenkripsi/terkompresi tanpa mematikan database:

```bash
docker compose -f docker-compose.production.yml exec -T postgres \
  pg_dump -U callme_erp_user -d callme_yoghurt_prod -Fc > backup_$(date +%Y%m%d_%H%M%S).dump
```

### Restore Database PostgreSQL
```bash
cat backup_file.dump | docker compose -f docker-compose.production.yml exec -T postgres \
  pg_restore -U callme_erp_user -d callme_yoghurt_prod --clean --if-exists
```

---

## 7. Prosedur Rollback Cepat

Jika versi rilis baru mengalami anomali:

1. **Rollback Git & Rebuild**:
   ```bash
   git checkout <PREVIOUS_STABLE_COMMIT_OR_TAG>
   docker compose -f docker-compose.production.yml --env-file .env.production build
   docker compose -f docker-compose.production.yml --env-file .env.production up -d --force-recreate
   ```

2. **Rollback Migrasi (Jika Ada Perubahan Schema)**:
   ```bash
   docker compose -f docker-compose.production.yml exec app php artisan migrate:rollback
   ```

3. **Purge Cache**:
   ```bash
   docker compose -f docker-compose.production.yml exec app php artisan optimize:clear
   docker compose -f docker-compose.production.yml exec app php artisan optimize
   ```
