# SOP 03 — Laravel DDD & Python FastAPI Microservice

> **Tujuan**: Memisahkan tanggung jawab kode (Separation of Concerns) agar sistem mudah dikembangkan (scalable) dan diuji (testable).

## 1. Spesialisasi Layer (Laravel)
Gunakan pola *Domain-Driven Design* (DDD) secara kaku, hindari MVC klasik.
* Pecah logika bisnis ke dalam direktori independen: `/Domain/Sales`, `/Domain/Inventory`, dan `/Domain/CRM`.
* **LARANGAN**: *Controller* dilarang keras berisi *query database* atau manipulasi data panjang. *Controller* hanya bertugas mengoper HTTP *request* ke *Domain Service*.

## 2. Algoritma Inventaris FEFO
Modul Inventaris di Laravel harus memproses pesanan dengan mengalokasikan stok berdasarkan *First Expired, First Out* (FEFO), mengingat yoghurt diklaim *fresh* setiap hari namun hanya memiliki masa simpan maksimal 3 bulan.

## 3. Spesialisasi Layer (Python FastAPI)
Layanan Python dikhususkan secara eksklusif untuk menerima beban asinkron tinggi:
* Menerima *array* pesanan.
* Menghitung akumulasi berat volumetrik.
* Mengembalikan *response* estimasi ongkos kirim ke BFF/Laravel dengan latensi di bawah 200ms.

## 4. Circuit Breaker
Terapkan pola kegagalan yang aman. Jika API kurir pihak ketiga *down*, FastAPI harus mengembalikan *fallback payload* standar ke Laravel, dan UI harus menampilkan pesan "Kalkulasi pengiriman sedang gangguan, hubungi admin via WA", BUKAN menampilkan layar *server error* (500).
