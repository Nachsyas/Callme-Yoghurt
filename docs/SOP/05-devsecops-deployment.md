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
