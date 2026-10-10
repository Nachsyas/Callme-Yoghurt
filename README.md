# 🚀 Callme Yoghurt E-Commerce & Mini-ERP

Enterprise-Grade Application untuk manajemen logistik *Cold Chain* dan penjualan Premium Stirred Yogurt, dilengkapi dengan arsitektur Autonomous Self-Healing.

## 🏛️ Arsitektur Tri-Core Engine

1. **Frontend & BFF Layer (Next.js 15):** Menyediakan antarmuka konsumen secepat kilat berbasis *Server-Side Rendering* (SSR) dan bertindak sebagai perisai keamanan (*Backend-For-Frontend*) untuk menyembunyikan arsitektur API internal dari jaringan publik.
2. **Core ERP Engine (Laravel 11):** Dibangun dengan pola *Domain-Driven Design* (DDD) yang kaku untuk mengatur logika transaksi finansial (ACID), manajemen inventaris *First Expired, First Out* (FEFO), dan orkestrasi pesanan harian.
3. **Logistics Microservice (Python FastAPI):** Mengeksekusi perhitungan asinkron beban komputasi tinggi, seperti kalkulasi algoritma tarif berbasis radius koordinat asal (Bambu Apus, Jaktim) dan akumulasi berat volumetrik botol yoghurt.

## 🛡️ Keamanan & Pengujian

Sistem ini dirancang dengan pendekatan *DevSecOps*. Terintegrasi dengan *Static Application Security Testing* (SAST) menggunakan SonarQube, dilindungi oleh enkripsi AES-256 untuk data pribadi, dan siap menahan gempuran *Dynamic Application Security Testing* (DAST) lokal via OWASP ZAP.

## 🔑 Initial Admin & Operations

Untuk inisialisasi akun administrator pertama (`OWNER`) dan pengoperasian Admin Console, ikuti panduan:
👉 [docs/admin-setup.md](docs/admin-setup.md)
```bash
# Provisioning akun OWNER via Artisan CLI
cd backend-core
php artisan callme:create-owner
```
