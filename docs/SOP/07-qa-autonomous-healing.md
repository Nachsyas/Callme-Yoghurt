# SOP 07 — Quality Assurance & Autonomous Self-Healing

> **Tujuan**: Mencegah *bug* naik ke produksi dengan skrip otomatis, dan memampukan AI memperbaiki kerusakan minor secara mandiri.

## 1. Test-Driven Development (TDD) Loop
Setiap pembuatan *endpoint* atau fitur baru di Laravel (PHPUnit) dan FastAPI (Pytest) harus disertai skrip pengujian (kondisi sukses dan gagal) dengan target *coverage* > 80%.

## 2. Protokol Fix Bug Mandiri (AI Self-Healing)
Jika saat dieksekusi terjadi status *FAIL* atau *Exception*, AI Agent WAJIB membaca *stack trace* (jejak error) dan mereparasi baris kode yang menyebabkan kegagalan secara mandiri, lalu menjalankan tes ulang hingga mendapat status *PASS*.

## 3. Strict Regression Prevention
Hukum mutlak dalam memperbaiki *bug*: AI HANYA boleh menambal ketidaksesuian teknis (seperti tipe data `string` yang salah dibaca sebagai `int`, penanganan nilai `null`, atau format JSON yang keliru). AI **DILARANG KERAS** memotong atau menghilangkan alur logika bisnis demi membuat tes menjadi hijau (*passed*).

## 4. E2E & Load Testing
* **Playwright**: Untuk mensimulasikan klik UI di *browser* (seperti transisi dari keranjang ke *checkout* dan uji centang video *unboxing*).
* **k6**: Untuk menembakkan 1000 *Virtual Users* (VU) ke API ongkos kirim guna memastikan *Load Balancer* tidak runtuh.
