Enterprise Infrastructure & Scaling Architecture
1. Stateless Microservices
Seluruh komponen komputasi backend (Laravel dan FastAPI) didesain sepenuhnya stateless. Memori pengguna (session) dan status rate-limit dipegang secara terpusat oleh instans Redis. Ini memungkinkan peladen (server) digandakan (horizontal scaling) kapan saja tanpa kehilangan data pelanggan.
2. BFF Auto-Scaling
Karena Next.js API Routes berfungsi sebagai perisai dan penyanitasi data dari ribuan pengunjung publik (misalnya saat promosi/diskon massal), kerangka ini sangat ideal didistribusikan ke arsitektur serverless edge network (seperti Vercel) untuk menangani lonjakan lalu lintas (traffic spike) seketika.
3. Database Segregation
Skema membaca dan menulis dipisah secara filosofis:
Operasi baca (read-heavy) seperti memuat halaman katalog dan gambar yoghurt diarahkan ke MongoDB Atlas yang terdistribusi dan kencang.
Operasi tulis (write-heavy) yang kritis seperti pemotongan stok FEFO saat transaksi diarahkan ke PostgreSQL dengan proteksi baris data (Row-Level Locks).
