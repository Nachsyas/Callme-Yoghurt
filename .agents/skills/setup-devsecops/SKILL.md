---
name: Setup DevSecOps Infrastructure
description: >
  Mengonfigurasi pengaturan containerization Docker, CI/CD pipelines, dan instrumen keamanan lokal ekstrem.
---
# Setup DevSecOps Infrastructure
Instruksi Implementasi
Gunakan template penulisan Dockerfile dengan teknik multi-stage build untuk citra (image) Laravel, Next.js, maupun Python guna memangkas ukuran produksi.
Tulis berkas konfigurasi workflow GitHub Actions (.github/workflows/) untuk mengotomatisasi Static Application Security Testing (SAST).
Siapkan berkas orkestrasi terpisah (misal: docker-compose.security.yml) yang khusus memuat container OWASP ZAP untuk simulasi serangan penetrasi lokal secara aman.
