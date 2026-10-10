# Callme Yoghurt — AI Agent Deployment Rules

> **MANDATORY**: File ini otomatis dibaca oleh AI agent di setiap conversation.
> Semua aturan di sini WAJIB dipatuhi tanpa pengecualian.

---

## 🤖 Aturan Operasional AI

1. **Inisiasi Wajib**: Jalankan fungsi skill `read-sop` sebelum memulai pengerjaan task apa pun jika skill tersebut tersedia di environment agent.
2. **Type Safety Ekstrem**: Sinkronisasikan payload antar-layer melalui contract yang tervalidasi. Jangan pernah menulis tipe `any` di TypeScript tanpa alasan teknis terdokumentasi dan review eksplisit.
3. **Zero-Trust Input**: Perlakukan semua input dari frontend, webhook, file upload, AI output, dan external integration sebagai untrusted. Validasi dilakukan pada trust boundary yang relevan dan business invariant wajib divalidasi ulang di ERP Core.
4. **Transactional Authority**: Laravel ERP Core adalah authoritative business/transaction layer. Frontend/BFF/AI tidak boleh menjadi sumber kebenaran alternatif untuk harga, stok, total, batch, payment state, atau business rule final.
5. **Logika Bisnis Khusus Cold Chain**: Selalu pertimbangkan aturan cold-chain, batch/lot, FEFO, expiry, kapasitas, dan jam operasional saat task menyentuh domain tersebut. Jangan mengarang aturan baru; gunakan requirement yang sudah disetujui.
6. **AUTONOMOUS SELF-HEALING**: Jika pengujian gagal, reproduksi kegagalan, baca stack trace/error lengkap, identifikasi root cause, lakukan patch terkecil yang benar, jalankan targeted test, kemudian relevant regression suite.
7. **REGRESSION PREVENTION**: Perbaikan mandiri hanya boleh memperbaiki defect tanpa diam-diam mengubah requirement atau menghapus fungsionalitas valid.

---

## 🚫 Larangan False-Green Testing

Agent DILARANG membuat pipeline terlihat PASS dengan cara:

- menambahkan `test.skip`, `describe.skip`, `it.skip`, `test.only`, atau mekanisme serupa untuk menghindari test;
- menambahkan `xfail`/expected-failure hanya agar failure tidak dihitung tanpa requirement yang memang mengizinkannya;
- menghapus test yang gagal;
- mengurangi coverage sebagai shortcut;
- melemahkan assertion atau expected result agar cocok dengan implementasi yang salah;
- menghapus negative/security test;
- menangkap exception secara luas lalu mengembalikan success palsu;
- mematikan validation, authorization, rate limit, encryption, CSRF/security control, atau guardrail lain supaya test lulus;
- mengganti integration/E2E test dengan unit test lalu mengklaim level validasi yang sama;
- menandai komponen VERIFIED/PRODUCTION-READY hanya karena command exit code `0`.

Jika test ternyata salah karena requirement resmi berubah, perubahan test harus menyebut requirement/ADR yang menjadi dasar perubahan.

---

## 🔐 Security & Secret Handling

1. Secret/service credential tidak boleh berada di business payload, browser response, client state, source code fallback, test fixture publik, atau application log.
2. Konfigurasi security-critical harus **fail closed** jika variable wajib tidak tersedia.
3. Browser-provided `price`, `total`, `stock`, `weight`, `role`, `permission`, atau authoritative status tidak boleh dipercaya sebagai final value.
4. AI-generated output tidak boleh dieksekusi sebagai privileged command tanpa validation, authorization, dan tool boundary yang eksplisit.
5. Error response ke client tidak boleh membocorkan secret, stack trace internal, credential, atau detail sensitif infrastructure.

---

## 🧠 AI Governance

AI adalah intelligence layer, bukan source of truth.

Agent/LLM boleh, sesuai permission:

- read
- summarize
- analyze
- recommend
- create draft
- menjalankan bounded action yang secara eksplisit diizinkan

AI tidak boleh secara default:

- menjalankan unrestricted SQL terhadap production;
- mengubah permission/RBAC;
- melakukan destructive migration;
- melakukan refund/transfer/posting finance;
- force-adjust inventory;
- menghapus audit trail;
- override deterministic ERP business rules.

Semua action AI yang berdampak pada business state harus melalui approved application tool/API dan harus dapat diaudit.

---

## 👤 Human Review Required

Human review wajib sebelum merge/execute untuk perubahan yang menyentuh:

- authentication/authorization/RBAC;
- secret handling/cryptography/security boundary;
- destructive atau irreversible database migration;
- finance/accounting/payment/refund rules;
- inventory force adjustment atau ledger immutability;
- perubahan cold-chain/expiry/FEFO business invariant;
- permission baru untuk AI/agent;
- penghapusan data massal atau perubahan retention/legal-hold;
- perubahan arsitektur yang bertentangan dengan ADR aktif.

---

## 🧱 Architecture Rules

Canonical architecture decision berada di `docs/architecture/ADR/`.

Saat ini Phase 0 mengikuti ADR-0001:

- Laravel ERP Core = transactional authority
- PostgreSQL = primary system of record
- Redis = ephemeral infrastructure
- S3-compatible storage = binary/object data
- MongoDB = deferred until justified
- Python/FastAPI = AI Intelligence Layer
- Next.js = Storefront/Admin presentation + BFF, bukan independent transactional authority

Jika task membutuhkan perubahan terhadap aturan tersebut, buat/update ADR terlebih dahulu dan jangan melakukan architectural drift secara diam-diam.

---

## ✅ Evidence-based Completion

Gunakan maturity berikut secara jujur:

- `PLANNED`
- `SCAFFOLDED`
- `IMPLEMENTED`
- `TESTED`
- `VERIFIED`
- `PRODUCTION-READY`

`SCAFFOLDED` tidak sama dengan `IMPLEMENTED`, dan `TESTED` tidak sama dengan `PRODUCTION-READY`.

Setiap klaim completion harus menyebut evidence yang relevan: file/commit, command/test yang benar-benar dijalankan, acceptance criteria, dan limitation yang masih ada.
