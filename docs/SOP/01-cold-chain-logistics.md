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
