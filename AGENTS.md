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
