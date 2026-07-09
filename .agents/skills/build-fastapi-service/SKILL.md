---
name: Build FastAPI Microservice
description: >
  Membuat layanan endpoint dengan performa tinggi di ekosistem Python untuk tugas algoritmik dan logistik.
---
# Build FastAPI Microservice
Instruksi Implementasi
Gunakan model validasi data Pydantic secara ketat (Strict Typing) untuk menolak payload yang anomali atau mencurigakan.
Optimasi fungsi yang memakan waktu lama (I/O bound) menggunakan penulisan asinkron (async/await).
Buat anotasi dokumentasi API secara eksplisit (Swagger/OpenAPI) pada router agar dengan mudah dikonsumsi dan diverifikasi oleh lapisan BFF di Next.js.
Sediakan file Pytest untuk menguji setiap kalkulasi jarak/berat.
