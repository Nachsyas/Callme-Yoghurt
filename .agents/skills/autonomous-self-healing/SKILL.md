---
name: Autonomous Bug Fixing & Self-Healing
description: >
  Skill pamungkas: Menjalankan tes, melacak jejak error (stack trace), dan mereparasi baris kode secara mandiri tanpa merusak fitur utama.
---
# Autonomous Bug Fixing & Self-Healing
Protokol Wajib (Patuhi Urutan Ini)
Saat dipanggil (atau saat fitur gagal berjalan), kamu WAJIB melakukan langkah ini:
Jalankan baris perintah pengujian yang spesifik pada target yang rusak (misal: php artisan test, pytest, atau npx playwright test).
Jika mesin mendeteksi status ERROR atau FAIL, tangkap dan baca keseluruhan stack trace untuk mengidentifikasi secara presisi file and baris yang bermasalah.
Perbaiki bug (seperti tipe data tidak cocok, lemparan parameter null exception, iterasi berulang, atau format JSON mismatch) SECARA MANDIRI.
PERINGATAN KERAS / STRICT REGRESSION PREVENTION: Saat melakukan perbaikan kode, kamu DILARANG menyederhanakan alur, mengubah business logic (aturan SOP bisnis), atau menghapus fungsionalitas yang sah. Perbaiki jaringnya, bukan membuang ikannya.
Jalankan ulang command tes hingga mengeluarkan status lolos sempurna (100% PASS).
