---
name: Create Laravel DDD Core
description: >
  Menulis komponen modul backend menggunakan Domain-Driven Design (Domain, Service, Repository).
---
# Create Laravel DDD Core
Instruksi Implementasi
Gunakan tipe deklarasi ketat di PHP (declare(strict_types=1);).
DILARANG KERAS menaruh logika kueri database (DB::... atau Eloquent ORM calls) langsung di dalam Controller.
Pecah fungsionalitas:
Buat Domain (Model/Entity & Interface).
Buat Service / UseCase (Logika Bisnis & FEFO).
Buat Repository (Eksekusi Kueri Database SQL/NoSQL).
Lengkapi pembuatan modul baru ini dengan penyusunan Unit Test di folder /tests.
