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
