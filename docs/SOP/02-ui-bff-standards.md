# SOP 02 — Frontend UI & BFF Architecture

> **Tujuan**: Menjamin performa *website* tetap tinggi, SEO optimal, dan mencegah peretas membaca *endpoint* *backend* secara langsung.

## 1. Perisai Backend-For-Frontend (BFF)
Dilarang keras *client-side browser* memanggil API Laravel atau FastAPI secara langsung. Semua *request* dari *browser* harus transit di Next.js Route Handlers (`/app/api/...`). Lapisan inilah yang menyuntikkan *Secret Key* sebelum meneruskan *request* ke *backend* internal.

## 2. Manajemen State Kinerja Tinggi (Zustand)
Logika keranjang belanja harus diakumulasi di *client* tanpa *lag*. Karena perbedaan berat produk yang signifikan (250ml = 0,3 kg; 1 Liter = 1,1 kg), perhitungan ini wajib diisolasi menggunakan **Zustand** agar *re-render* pada UI *checkout* tidak memberatkan memori *browser*.

## 3. Komponen Trust & Edukasi
Antarmuka pengguna (UI) wajib menonjolkan legalitas bisnis untuk konversi penjualan:
* Sertifikat 100% Halal
* Izin CPPOB & IUKM
* HAKI (IDM000981336)
* Nomor Izin Edar BPOM spesifik per varian rasa.

## 4. Validasi Retur Ketat
Formulir pengajuan komplain barang rusak di UI harus *disabled* (tidak bisa ditekan) sampai pengguna mencentang *checkbox* persetujuan bahwa mereka: (1) Memiliki video proses *unboxing*, dan (2) Tidak memberikan penilaian bintang 1.
