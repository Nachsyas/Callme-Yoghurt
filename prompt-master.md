🤖 PROMPT MASTER — Bootstrap Callme Yoghurt Enterprise E-Commerce & Mini-ERP
TUJUAN FILE INI: File ini adalah prompt master lengkap yang bisa kamu copy-paste ke AI agent lain (Cursor, Claude Code, Antigravity, dll) supaya AI tersebut bisa mereplikasi seluruh struktur dokumentasi, skills, SOP, dan arsitektur dari proyek Callme Yoghurt E-Commerce ini secara persis sama.
CARA PAKAI:
Buka folder kosong di tempat lain (proyek baru)
Copy SELURUH isi file ini ke prompt AI agent
AI akan otomatis membuat semua file & folder sesuai dengan blueprint di bawah
Hasilnya: struktur proyek 100% identik dengan proyek sumber
Bahasa default: Bahasa Indonesia (semua docs, instruksi, dan komunikasi)
============================================================
BAGIAN 1 — INSTRUKSI UTAMA UNTUK AI AGENT
============================================================
🎯 Misi Kamu (AI Agent)
Halo AI Agent! Kamu sedang ditugaskan untuk bootstrap sebuah proyek Enterprise E-Commerce & Mini-ERP baru dengan struktur dokumentasi dan skills yang sangat ketat. Proyek ini adalah sistem distribusi dan penjualan untuk produk Fast-Moving Consumer Goods (FMCG) dengan spesifikasi Cold Chain Logistics (rantai dingin).
Kamu WAJIB mengikuti instruksi di bawah ini secara berurutan dan TANPA SKIP STEP MANAPUN. Hasil akhir harus identik dengan blueprint yang diberikan.
⚙️ Stack Proyek (FIXED — JANGAN UBAH)
Komponen	Teknologi	Catatan
Frontend & BFF	Next.js 15 (App Router)	TypeScript ketat, Zustand untuk State, Tailwind CSS
Backend Core (ERP)	Laravel 11 (PHP)	WAJIB arsitektur Domain-Driven Design (DDD)
Microservice Logic	FastAPI (Python)	Kalkulasi routing logistik & berat akumulatif
Database SQL	PostgreSQL	Untuk transaksi keuangan/pesanan (standar ACID)
Database NoSQL	MongoDB Atlas	Untuk variasi master data katalog produk
Cache & Rate Limit	Redis	Distribusi session & proteksi DDoS
Keamanan & QA	Playwright, k6, OWASP ZAP	Enkripsi AES-256 untuk PII, Autonomous Self-Healing
🚫 LARANGAN MUTLAK
❌ JANGAN gunakan arsitektur MVC standar pada Laravel. HARUS memecah logika ke Domain, UseCase/Service, dan Repository.
❌ JANGAN biarkan peramban (browser client) memanggil API Laravel/FastAPI secara langsung. WAJIB melewati Backend-For-Frontend (BFF) di Next.js API Routes.
❌ JANGAN menyimpan data sensitif pelanggan (Nomor HP, Alamat) dalam plain text. WAJIB dienkripsi di database.
❌ JANGAN mengubah/menghapus logika bisnis (regression) saat melakukan Autonomous Self-Healing (Fix Bug Mandiri).
❌ JANGAN tambah/skip dokumen yang ada di blueprint. Buat persis sama beserta delimiternya.
❌ JANGAN buat implementasi kode backend/frontend di tahap ini. HANYA buat dokumentasi, skills, SOP, dan config files.
✅ URUTAN EKSEKUSI (WAJIB BERURUTAN)
Step 1  → Buat root files (.gitignore, AGENTS.md, README.md)
Step 2  → Buat folder docs/SOP/ (7 file SOP)
Step 3  → Buat folder docs/architecture/ (3 file arsitektur)
Step 4  → Buat folder docs/features/ (1 file template fitur)
Step 5  → Buat folder docs/todo/ (1 file master todo)
Step 6  → Buat folder .agents/skills/ dengan 7 skill folder
Step 7  → Buat masing-masing SKILL.md di setiap skill folder
Step 8  → Validasi semua 22 file sudah dibuat (cek dengan list directory)
Step 9  → Lapor ke user dengan ringkasan singkat
📁 STRUKTUR FOLDER FINAL YANG HARUS DIHASILKAN
<project-root>/
│
├── .agents/
│   └── skills/
│       ├── autonomous-self-healing/SKILL.md
│       ├── build-fastapi-service/SKILL.md
│       ├── create-laravel-ddd/SKILL.md
│       ├── implement-bff-ui/SKILL.md
│       ├── implement-extreme-qa/SKILL.md
│       ├── read-sop/SKILL.md
│       └── setup-devsecops/SKILL.md
│
├── docs/
│   ├── SOP/
│   │   ├── 01-cold-chain-logistics.md
│   │   ├── 02-ui-bff-standards.md
│   │   ├── 03-backend-ddd-logic.md
│   │   ├── 04-polyglot-db-security.md
│   │   ├── 05-devsecops-deployment.md
│   │   ├── 06-penetration-testing.md
│   │   └── 07-qa-autonomous-healing.md
│   ├── architecture/
│   │   ├── system-design.md
│   │   ├── project-structure.md
│   │   └── infrastructure-scaling.md
│   ├── features/
│   │   └── feature-template.md
│   └── todo/
│       └── master-todo.md
│
├── .gitignore
├── AGENTS.md
└── README.md
============================================================
BAGIAN 2 — KONTEN PERSIS SETIAP FILE (COPY EXACTLY)
============================================================
⚠️ PENTING: Setiap blok di bawah ini bertanda dengan delimiter ===== FILE: <path> ===== di awal dan ===== END FILE ===== di akhir. Buat file dengan isi persis yang ada di antara dua delimiter tersebut. JANGAN tambah, JANGAN kurangi, JANGAN ubah formatting.
📄 FILE 1 — .gitignore
===== FILE: .gitignore =====
# Frontend (Next.js)
.next/
node_modules/
out/
build/
.env.local
.env.*.local

# Backend (Laravel & Python)
/backend-core/vendor/
/backend-core/.env
/microservice/.venv/
/microservice/venv/
__pycache__/
*.pyc
.phpunit.result.cache

# Docker & Infra
.env
.DS_Store
*.log
docker-compose.override.yml
===== END FILE =====
📄 FILE 2 — AGENTS.md
===== FILE: AGENTS.md =====
# Callme Yoghurt — AI Agent Deployment Rules

> **MANDATORY**: File ini otomatis dibaca oleh AI agent di setiap conversation.
> Semua aturan di sini WAJIB dipatuhi tanpa pengecualian.

---

## 🤖 Aturan Operasional AI

1. **Inisiasi Wajib**: Jalankan fungsi skill `read-sop` sebelum memulai pengerjaan task apa pun.
2. **Type Safety Ekstrem**: Sinkronisasikan *payload* JSON antara Laravel (API), FastAPI (Service), dan Next.js (BFF). Jangan pernah menulis tipe `any` di TypeScript.
3. **Zero-Trust Architecture**: Perlakukan semua input dari *frontend* sebagai ancaman *cyber*. Lakukan validasi ketat dan sanitasi data di lapisan BFF sebelum masuk ke Laravel atau *database*.
4. **Logika Bisnis Khusus (Cold Chain)**: Selalu pertimbangkan batasan operasional (suhu penyimpanan < 5◦C, waktu kedaluwarsa maksimal 3 bulan, dan jam operasional pengiriman) dalam setiap logika algoritmik yang ditulis.
5. **AUTONOMOUS SELF-HEALING**: Jika pengujian QA (PHPUnit/Pytest/Playwright) gagal, agen WAJIB melakukan perbaikan (*fix bug*) secara mandiri dengan membaca *stack trace* error. 
6. **REGRESSION PREVENTION**: Perbaikan mandiri HANYA boleh menambal kebocoran/error (misal: penanganan `null`, *type mismatch*). DILARANG KERAS memodifikasi atau menghapus fungsionalitas fitur aslinya.
===== END FILE =====
📄 FILE 3 — README.md
===== FILE: README.md =====
# 🚀 Callme Yoghurt E-Commerce & Mini-ERP

Enterprise-Grade Application untuk manajemen logistik *Cold Chain* dan penjualan Premium Stirred Yogurt, dilengkapi dengan arsitektur Autonomous Self-Healing.

## 🏛️ Arsitektur Tri-Core Engine

1. **Frontend & BFF Layer (Next.js 15):** Menyediakan antarmuka konsumen secepat kilat berbasis *Server-Side Rendering* (SSR) dan bertindak sebagai perisai keamanan (*Backend-For-Frontend*) untuk menyembunyikan arsitektur API internal dari jaringan publik.
2. **Core ERP Engine (Laravel 11):** Dibangun dengan pola *Domain-Driven Design* (DDD) yang kaku untuk mengatur logika transaksi finansial (ACID), manajemen inventaris *First Expired, First Out* (FEFO), dan orkestrasi pesanan harian.
3. **Logistics Microservice (Python FastAPI):** Mengeksekusi perhitungan asinkron beban komputasi tinggi, seperti kalkulasi algoritma tarif berbasis radius koordinat asal (Bambu Apus, Jaktim) dan akumulasi berat volumetrik botol yoghurt.

## 🛡️ Keamanan & Pengujian

Sistem ini dirancang dengan pendekatan *DevSecOps*. Terintegrasi dengan *Static Application Security Testing* (SAST) menggunakan SonarQube, dilindungi oleh enkripsi AES-256 untuk data pribadi, dan siap menahan gempuran *Dynamic Application Security Testing* (DAST) lokal via OWASP ZAP.
===== END FILE =====
📄 FILE 4 — docs/SOP/01-cold-chain-logistics.md
===== FILE: docs/SOP/01-cold-chain-logistics.md =====
# SOP 01 — Cold Chain Logistics & Time-Gating

> **Tujuan**: Menjaga kualitas produk olahan susu (dairy) agar tidak rusak selama proses distribusi ke tangan konsumen.

## 1. Aturan Suhu & Penyimpanan
Sistem *frontend* dan notifikasi WhatsApp otomatis wajib memberikan peringatan merah (*alert*) pada saat *checkout* dan pelacakan resi:
* **Pesan Wajib**: "Hanya tahan 3 hari di suhu ruang. Langsung segera masukan kulkas begitu barang diterima (Suhu < 5◦C)."

## 2. Time-Gating (Batas Waktu Operasional)
Algoritma *checkout* harus menutup atau mengalihkan opsi pengiriman secara otomatis berdasarkan zona waktu WIB:
* **Instant/Sameday (Area Jakarta)**: Batas order maksimal pukul 17.00 WIB.
* **Nextday (Luar Jakarta)**: Batas order maksimal pukul 14.00 WIB.
* Pesanan di luar jam operasional (Senin-Sabtu, 08.00-17.00) dialihkan ke pengiriman hari kerja berikutnya.

## 3. Validasi Kurir & Radius Otomatis
* Jarak pengiriman dihitung menggunakan API *Geocoding* dengan titik asal kaku: **Bambu Apus, Cipayung, Jakarta Timur**.
* Sistem memblokir pilihan kurir reguler yang memakan waktu > 3 hari.
===== END FILE =====
📄 FILE 5 — docs/SOP/02-ui-bff-standards.md
===== FILE: docs/SOP/02-ui-bff-standards.md =====
# SOP 02 — Frontend UI & BFF Architecture

> **Tujuan**: Menjamin performa *website* tetap tinggi, SEO optimal, dan mencegah peretas membaca *endpoint* *backend* secara langsung.

## 1. Perisai Backend-For-Frontend (BFF)
Dilarang keras *client-side browser* memanggil API Laravel atau FastAPI secara langsung. Semua *request* dari *browser* harus transit di Next.js Route Handlers (`/app/api/...`). Lapisan inilah yang menyuntikkan *Secret Key* sebelum meneruskan *request* ke *backend* internal.

## 2. Manajemen State Kinerja Tinggi (Zustand)
Logika keranjang belanja harus diakumulasi di *client* tanpa *lag*. Karena perbedaan berat produk yang signifikan (250ml = 0,3 kg; 1 Liter = 1,1 kg), perhitungan ini wajib diisolasi menggunakan **Zustand** agar *re-render* pada UI *checkout* tidak memberatkan memori *browser*.

## 3. Komponen Trust & Edukasi
Antarmuka pengguna (UI) wajib menonjolkan legalitas bisnis untuk konversi penjualan:
* Sertifikat 100% Halal
* Izin CPPOB & IUKM
* HAKI (IDM000981336)
* Nomor Izin Edar BPOM spesifik per varian rasa.

## 4. Validasi Retur Ketat
Formulir pengajuan komplain barang rusak di UI harus *disabled* (tidak bisa ditekan) sampai pengguna mencentang *checkbox* persetujuan bahwa mereka: (1) Memiliki video proses *unboxing*, dan (2) Tidak memberikan penilaian bintang 1.
===== END FILE =====
📄 FILE 6 — docs/SOP/03-backend-ddd-logic.md
===== FILE: docs/SOP/03-backend-ddd-logic.md =====
# SOP 03 — Laravel DDD & Python FastAPI Microservice

> **Tujuan**: Memisahkan tanggung jawab kode (Separation of Concerns) agar sistem mudah dikembangkan (scalable) dan diuji (testable).

## 1. Spesialisasi Layer (Laravel)
Gunakan pola *Domain-Driven Design* (DDD) secara kaku, hindari MVC klasik.
* Pecah logika bisnis ke dalam direktori independen: `/Domain/Sales`, `/Domain/Inventory`, dan `/Domain/CRM`.
* **LARANGAN**: *Controller* dilarang keras berisi *query database* atau manipulasi data panjang. *Controller* hanya bertugas mengoper HTTP *request* ke *Domain Service*.

## 2. Algoritma Inventaris FEFO
Modul Inventaris di Laravel harus memproses pesanan dengan mengalokasikan stok berdasarkan *First Expired, First Out* (FEFO), mengingat yoghurt diklaim *fresh* setiap hari namun hanya memiliki masa simpan maksimal 3 bulan.

## 3. Spesialisasi Layer (Python FastAPI)
Layanan Python dikhususkan secara eksklusif untuk menerima beban asinkron tinggi:
* Menerima *array* pesanan.
* Menghitung akumulasi berat volumetrik.
* Mengembalikan *response* estimasi ongkos kirim ke BFF/Laravel dengan latensi di bawah 200ms.

## 4. Circuit Breaker
Terapkan pola kegagalan yang aman. Jika API kurir pihak ketiga *down*, FastAPI harus mengembalikan *fallback payload* standar ke Laravel, dan UI harus menampilkan pesan "Kalkulasi pengiriman sedang gangguan, hubungi admin via WA", BUKAN menampilkan layar *server error* (500).
===== END FILE =====
📄 FILE 7 — docs/SOP/04-polyglot-db-security.md
===== FILE: docs/SOP/04-polyglot-db-security.md =====
# SOP 04 — Polyglot Database, Auth & Data Security

> **Tujuan**: Memanfaatkan *database* yang tepat untuk tugas yang tepat demi efisiensi dan keamanan tingkat *enterprise*.

## 1. Transaksi ACID (PostgreSQL)
PostgreSQL digunakan eksklusif oleh Laravel untuk Modul Pesanan, Transaksi Finansial, dan Autentikasi Pengguna. Hal ini membutuhkan tingkat kepatuhan ACID (Atomicity, Consistency, Isolation, Durability) yang kaku untuk mencegah *race condition* (misal: stok yoghurt berkurang 2x pada pesanan yang sama).

## 2. Katalog Dinamis (MongoDB Atlas)
Digunakan untuk menyimpan Master Data Produk (Katalog). Fleksibilitas dokumen NoSQL sangat krusial karena variasi atribut yang dinamis: 7 varian rasa, ukuran gramasi berbeda, dan detail Bahan Tambahan Pangan (BTP) seperti jenis perisa buah serta *jelly/Nata de Coco*.

## 3. Enkripsi PII (Personally Identifiable Information)
Semua data sensitif pelanggan (Nama Lengkap, Nomor HP, Alamat Pengiriman Lengkap) WAJIB dienkripsi di level *database* menggunakan algoritma AES-256. Jika *database* bocor, peretas hanya mendapatkan teks acak.

## 4. Proteksi DDoS & Rate Limiting
Gunakan instans Redis sebagai penjaga gerbang di API Gateway BFF. Terapkan batas maksimal percobaan masuk (*login*) dan *checkout* per menit dari alamat IP yang sama untuk mematikan serangan *bot*.
===== END FILE =====
📄 FILE 8 — docs/SOP/05-devsecops-deployment.md
===== FILE: docs/SOP/05-devsecops-deployment.md =====
# SOP 05 — DevSecOps, Deployment & CI/CD Pipeline

> **Tujuan**: Memastikan lingkungan lokal (mesin pengembangan) identik seratus persen dengan lingkungan produksi (*production*).

## 1. Containerization Total
Baik itu Next.js, Laravel, FastAPI, maupun *database*, semuanya WAJIB berjalan di dalam ekosistem *Docker Multi-stage build*. Ini memastikan tidak ada isu *"it works on my machine"* saat melakukan transisi dari arsitektur ARM (MacBook) ke arsitektur *cloud* produksi (Linux).

## 2. Automated CI/CD Pipeline (GitHub Actions)
Setiap *Push* atau *Pull Request* WAJIB melewati otomatisasi:
* *Static Code Analysis* (PHPStan untuk Laravel, Ruff/Black untuk Python).
* *Automated Test Loop* (Menjalankan seluruh *Unit Test*).
* *SAST Scanning* (SonarQube) untuk mendeteksi kerentanan kode dan *spaghetti code* sebelum di-*merge*.

## 3. Object Storage Terpisah (AWS S3/MinIO)
Modul komplain mengharuskan unggahan video *unboxing* berformat MP4. *File* besar ini dilarang keras diunggah ke *server* sistem utama. Gunakan koneksi *bucket* penyimpanan eksternal dengan URL terenkripsi berbatas waktu (*presigned URL*) untuk akses admin.
===== END FILE =====
📄 FILE 9 — docs/SOP/06-penetration-testing.md
===== FILE: docs/SOP/06-penetration-testing.md =====
# SOP 06 — Local Penetration Testing & Observability

> **Tujuan**: Menguji ketahanan infrastruktur dengan simulasi serangan siber brutal sebelum *website* dirilis ke publik.

## 1. Simulasi Serangan Brutal Lokal
Sistem disiapkan untuk diorkestrasi bersama *container* peretas. Secara berkala, jalankan OWASP ZAP (untuk mencari celah XSS, CSRF) dan SQLmap (untuk mencoba *SQL Injection*) yang ditembakkan langsung ke *endpoint* BFF lokal.

## 2. Error Telemetry Aman (Sentry)
Integrasikan Sentry SDK untuk melacak *error* 500 secara *real-time*. Namun, konfigurasi *data scrubbing* harus sangat ketat. Sensor semua *password*, *token authorization*, dan data kartu bayar agar tidak pernah tercatat di *log* dasbor Sentry.

## 3. Structured Logging
Tinggalkan *print* atau *log* statis biasa. Laravel dan FastAPI wajib mengeluarkan format log terstruktur (JSON). Ini memudahkan ekstraksi dan analitik otomatis oleh Prometheus/Grafana untuk memonitor apakah ada lonjakan API *request* palsu ke sistem logistik ongkir.
===== END FILE =====
📄 FILE 10 — docs/SOP/07-qa-autonomous-healing.md
===== FILE: docs/SOP/07-qa-autonomous-healing.md =====
# SOP 07 — Quality Assurance & Autonomous Self-Healing

> **Tujuan**: Mencegah *bug* naik ke produksi dengan skrip otomatis, dan memampukan AI memperbaiki kerusakan minor secara mandiri.

## 1. Test-Driven Development (TDD) Loop
Setiap pembuatan *endpoint* atau fitur baru di Laravel (PHPUnit) dan FastAPI (Pytest) harus disertai skrip pengujian (kondisi sukses dan gagal) dengan target *coverage* > 80%.

## 2. Protokol Fix Bug Mandiri (AI Self-Healing)
Jika saat dieksekusi terjadi status *FAIL* atau *Exception*, AI Agent WAJIB membaca *stack trace* (jejak error) dan mereparasi baris kode yang menyebabkan kegagalan secara mandiri, lalu menjalankan tes ulang hingga mendapat status *PASS*.

## 3. Strict Regression Prevention
Hukum mutlak dalam memperbaiki *bug*: AI HANYA boleh menambal ketidaksesuaian teknis (seperti tipe data `string` yang salah dibaca sebagai `int`, penanganan nilai `null`, atau format JSON yang keliru). AI **DILARANG KERAS** memotong atau menghilangkan alur logika bisnis demi membuat tes menjadi hijau (*passed*).

## 4. E2E & Load Testing
* **Playwright**: Untuk mensimulasikan klik UI di *browser* (seperti transisi dari keranjang ke *checkout* dan uji centang video *unboxing*).
* **k6**: Untuk menembakkan 1000 *Virtual Users* (VU) ke API ongkos kirim guna memastikan *Load Balancer* tidak runtuh.
===== END FILE =====
📄 FILE 11 — docs/architecture/system-design.md
===== FILE: docs/architecture/system-design.md =====
# Enterprise System Design Blueprint

```mermaid
graph TD
    subgraph Client_Side [Frontend Application]
        UI[Next.js 15 UI / Zustand]
    end

    subgraph API_Gateway [Security & BFF Layer]
        BFF[Next.js API Routes / Rate Limiter]
    end

    subgraph Microservices [Enterprise Tri-Core Engine]
        LARAVEL[Laravel 11 DDD / ERP Core]
        PYTHON[FastAPI / Routing Logic]
    end

    subgraph Data_Storage [Polyglot Persistence Layer]
        PGSQL[(PostgreSQL)]
        MONGO[(MongoDB Atlas)]
        REDIS[(Redis Cache)]
    end
    
    subgraph Testing_Loop [Autonomous Healing]
        QA[PHPUnit / Pytest / Playwright]
    end

    User --> UI
    UI <--> BFF
    BFF <--> LARAVEL
    BFF <--> PYTHON
    LARAVEL <--> PGSQL
    LARAVEL <--> MONGO
    PYTHON <--> REDIS
    LARAVEL -.-> QA
    PYTHON -.-> QA
===== END FILE =====

---

## 📄 FILE 12 — `docs/architecture/project-structure.md`

===== FILE: docs/architecture/project-structure.md =====
Project Monorepo Structure
Callme-Yoghurt-Monorepo/
├── .agents/
│   └── skills/                  # Kumpulan skill AI Agent (termasuk auto-fix bug)
├── frontend/                    # Next.js 15 (E-Commerce Storefront & BFF)
│   ├── src/
│   │   ├── app/                 # App Router Boundaries & API Route Handlers
│   │   └── store/               # Zustand Isolated States (Cart Accumulation)
│   └── tests/                   # Playwright E2E E-Commerce Flow
├── backend-core/                # Laravel 11 ERP (Domain-Driven Design)
│   ├── app/Domain/              # Bounded Contexts (Sales, Inventory, Logistics)
│   ├── app/Infrastructure/      # DB Repositories & Adapters
│   └── tests/                   # PHPUnit (TDD)
├── microservice/                # Python FastAPI Logistics Logic
│   └── tests/                   # Pytest (TDD)
└── infra/                       # DevSecOps & QA Tools
    ├── docker/                  # Multi-stage build definitions
    └── security/                # OWASP ZAP & Pen-test configurations
===== END FILE =====

---

## 📄 FILE 13 — `docs/architecture/infrastructure-scaling.md`

===== FILE: docs/architecture/infrastructure-scaling.md =====
Enterprise Infrastructure & Scaling Architecture
1. Stateless Microservices
Seluruh komponen komputasi backend (Laravel dan FastAPI) didesain sepenuhnya stateless. Memori pengguna (session) dan status rate-limit dipegang secara terpusat oleh instans Redis. Ini memungkinkan peladen (server) digandakan (horizontal scaling) kapan saja tanpa kehilangan data pelanggan.
2. BFF Auto-Scaling
Karena Next.js API Routes berfungsi sebagai perisai dan penyanitasi data dari ribuan pengunjung publik (misalnya saat promosi/diskon massal), kerangka ini sangat ideal didistribusikan ke arsitektur serverless edge network (seperti Vercel) untuk menangani lonjakan lalu lintas (traffic spike) seketika.
3. Database Segregation
Skema membaca dan menulis dipisah secara filosofis:
Operasi baca (read-heavy) seperti memuat halaman katalog dan gambar yoghurt diarahkan ke MongoDB Atlas yang terdistribusi dan kencang.
Operasi tulis (write-heavy) yang kritis seperti pemotongan stok FEFO saat transaksi diarahkan ke PostgreSQL dengan proteksi baris data (Row-Level Locks).
===== END FILE =====

---

## 📄 FILE 14 — `docs/features/feature-template.md`

===== FILE: docs/features/feature-template.md =====
Feature Document Template
🏷️ Feature Name: [Nama Fitur]
Pilar Utama: ☐ Next.js UI | ☐ Next.js BFF | ☐ Laravel ERP Core | ☐ FastAPI Microservice
📋 Deskripsi Fungsional
[Jelaskan fungsi fitur ini dari kacamata manajemen Callme Yoghurt atau Konsumen]
📐 Spesifikasi Teknis
Database Schema: [Tulis skema PGSQL atau dokumen MongoDB jika ada]
BFF & API Contract: [Metode HTTP, Path Endpoint, JSON Payload Request & Response]
Security & Sanitization: [Jelaskan filter keamanan input, misal enkripsi AES]
🧪 Rencana Pengujian & Self-Healing
[ ] Tulis skrip test (PHPUnit / Pytest / Playwright) sebelum eksekusi.
[ ] Jalankan tes mandiri.
[ ] Lakukan Self-Healing (Auto-fix) jika error terdeteksi di stack trace.
[ ] Konfirmasi fitur lolos tes 100% tanpa regresi bisnis.
===== END FILE =====

---

## 📄 FILE 15 — `docs/todo/master-todo.md`

===== FILE: docs/todo/master-todo.md =====
Master Strategy To-Do List Callme Yoghurt
Phase 1: Architecture Core & Database Foundation
[ ] Setup Docker Compose untuk kerangka PGSQL, MongoDB, dan Redis lokal.
[ ] Inisialisasi instalasi Laravel 11 dengan struktur repositori Domain-Driven Design.
[ ] Terapkan skema utilitas enkripsi AES-256 untuk tabel Pelanggan.
[ ] Buat kerangka dasar PHPUnit.
Phase 2: Logistics & Microservices (Python)
[ ] Bangun FastAPI endpoints untuk algoritma kalkulasi radius jarak dari Cipayung.
[ ] Integrasikan algoritma akumulasi berat botol presisi (250ml vs 1L).
[ ] Terapkan siklus Testing & Self-Healing untuk skrip Python ini.
[ ] Siapkan container eksekutor lokal OWASP ZAP untuk tes penetrasi tahap awal.
Phase 3: BFF, E-Commerce Storefront & QA Automation
[ ] Setup proyek Next.js 15 dengan Strict TypeScript dan konfigurasi Zustand.
[ ] Implementasi manajemen jam operasional (Time-gating) pukul 14.00 & 17.00 WIB pada layar checkout.
[ ] Eksekusi Playwright E2E Testing untuk menyimulasikan kegagalan validasi form retur komplain tanpa unggah video MP4.
[ ] Hubungkan UI ke Backend Core melalui jembatan API Routes (BFF Layer).
===== END FILE =====

---

## 📄 FILE 16 — `.agents/skills/read-sop/SKILL.md`

===== FILE: .agents/skills/read-sop/SKILL.md =====
name: Read Enterprise SOP
description: >
Membaca regulasi arsitektur sebelum mengeksekusi modifikasi file. WAJIB dipanggil di setiap awal task.
Read Enterprise SOP
Instruksi Wajib
PANGGIL SKILL INI DI AWAL TASK SEBELUM MENULIS KODE APAPUN.
Buka dan analisis seluruh berkas Markdown di dalam direktori docs/SOP/.
Pastikan kamu (AI) memahami aturan baku penulisan kode, keamanan enkripsi Polyglot DB, aturan spesifik logistik rantai dingin (Cold Chain - Suhu & Waktu), dan standar pengujian mandiri (Autonomous Healing).
Jangan gunakan pola pikir MVC tradisional. Adaptasi pola pikir perisai keamanan (BFF) dan abstraksi logika (Domain-Driven Design).
===== END FILE =====

---

## 📄 FILE 17 — `.agents/skills/create-laravel-ddd/SKILL.md`

===== FILE: .agents/skills/create-laravel-ddd/SKILL.md =====
name: Create Laravel DDD Core
description: >
Menulis komponen modul backend menggunakan Domain-Driven Design (Domain, Service, Repository).
Create Laravel DDD Core
Instruksi Implementasi
Gunakan tipe deklarasi ketat di PHP (declare(strict_types=1);).
DILARANG KERAS menaruh logika kueri database (DB::... atau Eloquent ORM calls) langsung di dalam Controller.
Pecah fungsionalitas:
Buat Domain (Model/Entity & Interface).
Buat Service / UseCase (Logika Bisnis & FEFO).
Buat Repository (Eksekusi Kueri Database SQL/NoSQL).
Lengkapi pembuatan modul baru ini dengan penyusunan Unit Test di folder /tests.
===== END FILE =====

---

## 📄 FILE 18 — `.agents/skills/implement-bff-ui/SKILL.md`

===== FILE: .agents/skills/implement-bff-ui/SKILL.md =====
name: Implement BFF & UI Components
description: >
Merancang antarmuka konsumen E-Commerce menggunakan Next.js dan API Routes sebagai tameng Backend-For-Frontend.
Implement BFF & UI Components
Instruksi Implementasi
Gunakan Tailwind CSS untuk rancangan visual yang reaktif dan modern.
Pastikan komunikasi komunikasi ambil-data (fetch) ke API internal (Laravel/FastAPI) benar-benar disembunyikan dan dieksekusi secara rahasia di dalam folder Next.js app/api/ (BFF Layer).
Untuk UI interaktif (seperti Cart/Keranjang Belanja): Kelola perhitungan manipulasi state akumulasi berat botol yang kompleks di dalam Zustand Store agar performa UI optimal tanpa frame drop.
===== END FILE =====

---

## 📄 FILE 19 — `.agents/skills/build-fastapi-service/SKILL.md`

===== FILE: .agents/skills/build-fastapi-service/SKILL.md =====
name: Build FastAPI Microservice
description: >
Membuat layanan endpoint dengan performa tinggi di ekosistem Python untuk tugas algoritmik dan logistik.
Build FastAPI Microservice
Instruksi Implementasi
Gunakan model validasi data Pydantic secara ketat (Strict Typing) untuk menolak payload yang anomali atau mencurigakan.
Optimasi fungsi yang memakan waktu lama (I/O bound) menggunakan penulisan asinkron (async/await).
Buat anotasi dokumentasi API secara eksplisit (Swagger/OpenAPI) pada router agar dengan mudah dikonsumsi dan diverifikasi oleh lapisan BFF di Next.js.
Sediakan file Pytest untuk menguji setiap kalkulasi jarak/berat.
===== END FILE =====

---

## 📄 FILE 20 — `.agents/skills/setup-devsecops/SKILL.md`

===== FILE: .agents/skills/setup-devsecops/SKILL.md =====
name: Setup DevSecOps Infrastructure
description: >
Mengonfigurasi pengaturan containerization Docker, CI/CD pipelines, dan instrumen keamanan lokal ekstrem.
Setup DevSecOps Infrastructure
Instruksi Implementasi
Gunakan template penulisan Dockerfile dengan teknik multi-stage build untuk citra (image) Laravel, Next.js, maupun Python guna memangkas ukuran produksi.
Tulis berkas konfigurasi workflow GitHub Actions (.github/workflows/) untuk mengotomatisasi Static Application Security Testing (SAST).
Siapkan berkas orkestrasi terpisah (misal: docker-compose.security.yml) yang khusus memuat container OWASP ZAP untuk simulasi serangan penetrasi lokal secara aman.
===== END FILE =====

---

## 📄 FILE 21 — `.agents/skills/implement-extreme-qa/SKILL.md`

===== FILE: .agents/skills/implement-extreme-qa/SKILL.md =====
name: Implement Extreme QA Testing
description: >
Mengeksekusi pembuatan skrip pengujian beban (k6) dan pengujian otomatisasi alur pengguna E2E (Playwright).
Implement Extreme QA Testing
Instruksi Implementasi
Buat skrip alur Playwright untuk memvalidasi interaksi UI yang rumit (contoh: Pastikan tombol submit komplain hangus/mati jika pengguna belum mencentang syarat video unboxing).
Susun kerangka kerja skrip k6 (menggunakan JavaScript murni) untuk melakukan stress testing yang membombardir endpoint algoritma ongkos kirim.
Analisis output dari pengujian beban tersebut dan laporkan potensi bottleneck (kemacetan memori).
===== END FILE =====

---

## 📄 FILE 22 — `.agents/skills/autonomous-self-healing/SKILL.md`

===== FILE: .agents/skills/autonomous-self-healing/SKILL.md =====
name: Autonomous Bug Fixing & Self-Healing
description: >
Skill pamungkas: Menjalankan tes, melacak jejak error (stack trace), dan mereparasi baris kode secara mandiri tanpa merusak fitur utama.
Autonomous Bug Fixing & Self-Healing
Protokol Wajib (Patuhi Urutan Ini)
Saat dipanggil (atau saat fitur gagal berjalan), kamu WAJIB melakukan langkah ini:
Jalankan baris perintah pengujian yang spesifik pada target yang rusak (misal: php artisan test, pytest, atau npx playwright test).
Jika mesin mendeteksi status ERROR atau FAIL, tangkap dan baca keseluruhan stack trace untuk mengidentifikasi secara presisi file dan baris yang bermasalah.
Perbaiki bug (seperti tipe data tidak cocok, lemparan parameter null exception, iterasi berulang, atau format JSON mismatch) SECARA MANDIRI.
PERINGATAN KERAS / STRICT REGRESSION PREVENTION: Saat melakukan perbaikan kode, kamu DILARANG menyederhanakan alur, mengubah business logic (aturan SOP bisnis), atau menghapus fungsionalitas yang sah. Perbaiki jaringnya, bukan membuang ikannya.
Jalankan ulang command tes hingga mengeluarkan status lolos sempurna (100% PASS).
===== END FILE =====

---

# ============================================================
# BAGIAN 3 — VALIDASI & VERIFIKASI HASIL
# ============================================================

## ✅ Final Validation Checklist (untuk AI Agent)

Setelah semua file di atas dibuat, AI agent **HARUS** memverifikasi eksistensi dan kesempurnaannya secara internal:

### Cek Struktur Folder (Total: 22 File)
✅ .agents/skills/autonomous-self-healing/SKILL.md  ada
✅ .agents/skills/build-fastapi-service/SKILL.md    ada
✅ .agents/skills/create-laravel-ddd/SKILL.md       ada
✅ .agents/skills/implement-bff-ui/SKILL.md         ada
✅ .agents/skills/implement-extreme-qa/SKILL.md     ada
✅ .agents/skills/read-sop/SKILL.md                 ada
✅ .agents/skills/setup-devsecops/SKILL.md          ada
✅ docs/SOP/01-cold-chain-logistics.md              ada
✅ docs/SOP/02-ui-bff-standards.md                  ada
✅ docs/SOP/03-backend-ddd-logic.md                 ada
✅ docs/SOP/04-polyglot-db-security.md              ada
✅ docs/SOP/05-devsecops-deployment.md              ada
✅ docs/SOP/06-penetration-testing.md               ada
✅ docs/SOP/07-qa-autonomous-healing.md             ada
✅ docs/architecture/system-design.md               ada
✅ docs/architecture/project-structure.md           ada
✅ docs/architecture/infrastructure-scaling.md      ada
✅ docs/features/feature-template.md                ada
✅ docs/todo/master-todo.md                         ada
✅ .gitignore                                       ada
✅ AGENTS.md                                        ada
✅ README.md                                        ada

### Cek Integritas Konten Penting
- [ ] AGENTS.md menyebut "Type Safety Ekstrem" dan "Autonomous Self-Healing".
- [ ] README.md mencerminkan proyek "Callme Yoghurt E-Commerce & Mini-ERP".
- [ ] SOP Backend melarang MVC klasik dan mewajibkan Domain-Driven Design (DDD).
- [ ] SOP Frontend menegaskan perlindungan via API Routes (BFF) dan State Management Zustand.
- [ ] Semua `SKILL.md` menggunakan penanda metadata YAML *frontmatter* (`---`).

---

# ============================================================
# BAGIAN 4 — LAPORAN AKHIR (TEMPLATE)
# ============================================================

Setelah selesai memahat semua file, AI agent **HARUS** melaporkan kembali ke *user* dengan format penutupan ini:

✅ Bootstrap Benteng Digital Callme Yoghurt E-Commerce Selesai Sempurna!
📁 Struktur direktori enterprise yang telah dirakit:
.agents/skills/ (7 modul keahlian eksekusi & Self-Healing AI)
docs/SOP/ (7 dokumen pakem operasional rantai dingin & keamanan)
docs/architecture/ (3 rancangan cetak biru sistem)
docs/features/ & docs/todo/ (2 dokumen manajemen)
Root files (3 file jangkar utama)
📊 Total Presisi: 22 file dokumentasi & arsitektur teknis.
🎯 Standar Ekosistem yang Telah Dikunci:
Etalase Web & Perisai API: Next.js 15 (BFF) + Zustand
Otak Finansial & Logika: Laravel 11 (Domain-Driven Design)
Otot Kalkulasi Logistik: Python FastAPI Microservice
Arsitektur Database: PostgreSQL (SQL) & MongoDB (NoSQL)
📖 Langkah Eksekusi Berikutnya untuk Komandan:
Inspeksi docs/todo/master-todo.md dan putuskan Phase 1 mana yang akan dikerjakan lebih dulu.
Saat meminta pembuatan kode, saya (AI) akan secara proaktif memanggil fungsi read-sop agar tidak keluar jalur.
Mari mulai menulis kode production-ready!

---

# ============================================================
# BAGIAN 5 — INSTRUKSI ASSEMBLY UNTUK AI AGENT
# ============================================================

## Cara Membaca File Ini

Setiap file di Bagian 2 di atas dibungkus dalam blok markdown dengan delimiter presisi:

===== FILE: <relative_path> =====

===== END FILE =====

**Cara perakitan sistem (Assembly):**

1. **Parse setiap blok** dengan *string matching* pada memori komputasimu:
   - Cari baris `===== FILE: ` lalu tangkap parameter direktori/jalurnya sampai penutup ` =====`.
   - Salin dan ekstraksi konten murni di bawahnya hingga baris `===== END FILE =====`.
2. **Rekayasa kerangka folder (Parent Directory)** terlebih dahulu jika belum eksis di *file system*:
   - Contoh: Untuk merender `docs/SOP/01-cold-chain-logistics.md`, kamu WAJIB membangun direktori `docs/` lalu disusul sub-direktori `docs/SOP/` terlebih dahulu.
3. **Pahat file-file tersebut** dengan materi konten **persis sama** (pertahankan lekukan baris baru, spasi, format *mermaid chart*, dan ejaan).
4. **MUTLAK**: JANGAN menyertakan teks delimiter `===== FILE: =====` atau `===== END FILE =====` ke dalam berkas final yang tercetak. Teks tersebut murni bertindak sebagai penanda pisau bedah digitalmu.
5. Jalur file menggunakan referensi garis miring (Forward Slash `/`).

---

# ============================================================
# 🎬 MULAILAH MERAKIT SEKARANG, AI AGENT!
# ============================================================

Mulai eksekusi tanpa henti dari Step 1 (Bagian 1), bangun serentak 22 file (Bagian 2) di ruang kerjamu. Jalankan konfirmasi internal (Bagian 3) lalu deklarasikan kemenanganmu dengan mencetak log laporan akhir (Bagian 4). 

Kode rahasia inisiasi: **"SYSTEM OVERRIDE: ENTERPRISE MODE ENGAGED"**. Selamat bekerja! 🚀