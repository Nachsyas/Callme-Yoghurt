# Callme ERP — Admin Provisioning & Operations Guide

Panduan resmi untuk melakukan inisialisasi akun **OWNER** pertama, manajemen kredensial administratif, dan pengoperasian Callme ERP Admin Console.

---

## 1. Arsitektur & Keamanan Autentikasi Admin

Callme ERP menerapkan standar keamanan enterprise **Zero-Trust** untuk seluruh akses administratif:
- **Tabel Khusus Admin**: Autentikasi admin terisolasi sepenuhnya pada tabel `admin_users` (tidak bercampur dengan tabel user/customer biasa).
- **Password Hashing**: Menggunakan algoritma **Argon2id** (`argon2id` driver) dengan perlindungan timing attack dummy verification.
- **Session Token**: Token sesi ditandatangani menggunakan **HMAC-SHA256** dan disimpan secara eksklusif di dalam **HttpOnly Cookie** (`callme_admin_session`).
- **Zero LocalStorage Policy**: Token sesi **DILARANG KERAS** disimpan di `localStorage` atau `sessionStorage` browser untuk mencegah pencurian token melalui serangan XSS.
- **Audit Logging**: Setiap aksi `ACCOUNT_CREATED`, `LOGIN_SUCCESS`, `LOGIN_FAILED`, `ACCOUNT_LOCKED`, dan `LOGOUT` dicatat secara permanen di tabel `admin_audit_logs`.
- **Brute-Force Protection**: Rate limiter membatasi percobaan login maksimal 5 kali per 15 menit per identitas IP/email. Akun otomatis dikunci sementara selama 15 menit jika gagal 5 kali berturut-turut.

---

## 2. Cara Membuat Akun OWNER Pertama

Pembuatan akun OWNER pertama dilakukan menggunakan Artisan CLI Command interaktif atau opsi non-interaktif. Kredensial tidak pernah di-hardcode ke dalam source code.

### A. Mode Interaktif (Direkomendasikan untuk Admin / Operator)

Jalankan perintah berikut di direktori `backend-core`:

```bash
cd backend-core
php artisan callme:create-owner
```

CLI akan meminta input secara interaktif dengan masking password:

```text
====================================================
 Callme ERP — Initial OWNER Provisioning
====================================================
Enter Owner Full Name: Callme Executive Owner
Enter Owner Email Address: owner@callmeyoghurt.com
Enter Password (minimum 8 characters): [hidden input]
Confirm Password: [hidden input]

OWNER account created successfully.

+-------------+--------------------------------------+
| Field       | Value                                |
+-------------+--------------------------------------+
| ID          | 01a0c9b2-866f-7250-9910-d9ab8e376199 |
| Name        | Callme Executive Owner               |
| Email       | owner@callmeyoghurt.com              |
| Role        | OWNER                                |
| Status      | ACTIVE                               |
| Hash Driver | Argon2id                             |
| Created At  | 2026-09-22T22:18:35+07:00            |
+-------------+--------------------------------------+
```

### B. Mode Non-Interaktif (Untuk Otomasi CI / Deployment / Container Entrypoint)

Untuk kebutuhan provisioning otomatis di lingkungan staging atau container:

```bash
php artisan callme:create-owner \
  --name="System Owner" \
  --email="owner@callmeyoghurt.com" \
  --password="YourStrongSecurePassword!2026"
```

*Validasi Otomatis:*
- Email harus berformat valid dan tidak boleh duplikat (case-insensitive check).
- Password minimal 8 karakter.
- Di mode interaktif, konfirmasi password wajib identik.

---

## 3. Seeder Development & Staging (`AdminUserSeeder`)

Tersedia seeder opsional `AdminUserSeeder` untuk otomatisasi seeding database lokal atau testing.

> [!IMPORTANT]
> Sesuai SOP DevSecOps, seeder ini **TIDAK MENGGUNAKAN PASSWORD DEFAULT**. Seeder hanya akan berjalan jika variabel lingkungan disuplai secara eksplisit di `.env`.

Tambahkan konfigurasi berikut pada `.env` (hanya untuk local/staging):

```env
INITIAL_OWNER_NAME="Callme Local Owner"
INITIAL_OWNER_EMAIL=owner@callmeyoghurt.local
INITIAL_OWNER_PASSWORD=SuperSecureLocalPassword!2026
```

Jalankan seeder:

```bash
php artisan db:seed --class=AdminUserSeeder
# Atau melalui root seeder:
php artisan db:seed
```

Jika variabel `INITIAL_OWNER_EMAIL` atau `INITIAL_OWNER_PASSWORD` tidak disetel, seeder otomatis melewati proses tanpa melempar error (`Skipped`).

---

## 4. Cara Menjalankan Admin Dashboard

### Langkah 1 — Jalankan Backend ERP Core

Pastikan database PostgreSQL dan Redis sudah berjalan via Docker:

```bash
# Dari root repository:
docker compose up -d postgres redis
```

Jalankan server Laravel ERP:

```bash
cd backend-core
php artisan serve --port=8000
```

Pastikan endpoint health aktif:
```bash
curl http://127.0.0.1:8000/api/health
# Response: {"status":"ok","service":"erp-core"}
```

### Langkah 2 — Jalankan Frontend Next.js

Di terminal baru:

```bash
cd frontend
npm run dev -- -p 3000
```

### Langkah 3 — Akses dan Login

1. Buka browser dan navigasikan ke:
   ```text
   http://localhost:3000/admin/login
   ```
   *(Atau URL production: `https://callme-yoghurt-admin.vercel.app/admin/login`)*

2. Masukkan kredensial akun OWNER yang telah dibuat:
   - **Email**: `owner@callmeyoghurt.com`
   - **Password**: *(Password yang Anda masukkan saat menjalankan artisan command)*

3. Klik tombol **Masuk ke Admin Portal**.

4. Sistem akan:
   - Mengirim request `POST /api/admin/login` ke Next.js BFF.
   - Forwarding ke Laravel ERP `POST /api/admin/login`.
   - Melakukan verifikasi Argon2id secara timing-safe.
   - Menyetel HttpOnly Cookie `callme_admin_session`.
   - Redirect otomatis ke dashboard operasional:
     ```text
     http://localhost:3000/admin
     ```

### Langkah 4 — Logout

Untuk keluar dari portal:
- Klik tombol **Logout** pada header/sidebar Admin Console.
- Atau kirim request:
  ```bash
  POST /api/admin/logout
  ```
- Cookie `callme_admin_session` akan segera dihapus dari browser (`Max-Age=0`) dan event `LOGOUT` dicatat di `admin_audit_logs`.

---

## 5. Ringkasan Endpoint Terkait

| Method | Endpoint | Fungsi | Proteksi |
|---|---|---|---|
| `POST` | `/api/admin/login` | Login admin, verifikasi Argon2id, issue cookie | Rate limit 5/15m, timing-safe |
| `POST` | `/api/admin/logout` | Invalidation cookie & pencatatan audit log | HttpOnly cookie |
| `GET` | `/admin` | Dashboard Admin Console | Next.js Middleware (`callme_admin_session`) |
| `GET` | `/admin/login` | Halaman login administratif | Public |
