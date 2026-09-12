# ADR-0004 — Storage Architecture, Data Lifecycle, Disaster Recovery & Vector Readiness

- Status: Accepted for Phase 0 (Gate 0D.2)
- Date: 2026-09-13
- Scope: Callme Yoghurt Storage Hierarchy, Binary Metadata, Lifecycle Retention, Disaster Recovery & AI Vector Boundary
- References: ADR-0001 (Foundation Architecture), ADR-0002 (Laravel Runtime Lifecycle), ADR-0003 (ERP Data Model Foundation), `docs/architecture/infrastructure-scaling.md`

## Context

Following the establishment of the ERP transactional data model in ADR-0003, Callme Yoghurt requires an authoritative architecture for:
1. Non-transactional binary object storage (product imagery, invoice PDFs, quality/complaint evidence);
2. Data classification and lifecycle management (hot, warm, cold storage tiers, scheduled deletion, and legal hold);
3. Controlled attachment relationships between binary objects and transactional domain entities;
4. Target disaster recovery objectives (Backup & Point-in-Time Recovery);
5. AI knowledge retrieval and vector search readiness without compromising transactional database integrity or leaking Personally Identifiable Information (PII).

Previously, prototype exploration lacked a defined binary storage policy, risked storing large blobs or public URLs in business tables, lacked formal retention or legal-hold controls, and had no clear boundary between authoritative transactional records and derived AI search indexes.

---

## Decisions

### 1. Storage Responsibility Hierarchy

The Callme Yoghurt platform enforces a strict separation of storage concerns:

```text
PostgreSQL
    └── Authoritative structured metadata / ERP transactional state of record

S3-compatible Object Storage
    └── Binary objects (product images, customer invoices, evidence files)

Redis
    └── Ephemeral coordination / locks / queues / rate-limit state (never permanent truth)

pgvector (PostgreSQL Extension)
    └── Derived AI/vector retrieval index (search index only, never source of truth)

Backups
    └── Independent, encrypted recovery copies (isolated from live operational storage)
```

#### Core Invariants:
- **Zero Raw Binary in Transactional Columns**: Binary payloads (files, images, raw document bytes) must never be stored directly in normal PostgreSQL business tables.
- **Internal Storage Locators vs Public URLs**: `object_key` stored in ERP metadata is an internal storage locator path (e.g. `catalog/products/2026/09/uuid.webp`), not a public URL or business identifier. Public access, when permitted, is mediated via temporary/signed URLs or CDN edge routing.
- **ERP Metadata References Storage**: The ERP Core records authoritative metadata (`stored_objects`), tracking ownership, file integrity, classification, and retention state.
- **Redis is Ephemeral**: Redis must never be treated as authoritative business truth or long-term storage.
- **Vector Indexes are Derived**: Vector embeddings are strictly derived representations of source documents, never transactional authorities. If dropped, vector indexes can be rebuilt from source metadata without business data loss.
- **Independent Backup Separation**: Backup storage must be physically, logically, and credential-isolated from live operational storage.

---

### 2. Object-Storage Metadata Model (`stored_objects`)

Binary objects are registered in the authoritative PostgreSQL table `stored_objects`:

```text
stored_objects
├── id: UUID (Primary Key)
├── storage_disk: VARCHAR(50) (e.g. 'object', 'local')
├── object_key: VARCHAR(1024)
├── bucket: VARCHAR(255) (nullable)
├── original_filename: VARCHAR(255) (nullable)
├── media_type: VARCHAR(150) (e.g. 'image/webp', 'application/pdf')
├── byte_size: BIGINT (CHECK byte_size >= 0)
├── sha256: VARCHAR(64) (nullable, CHECK sha256 ~ '^[a-f0-9]{64}$')
├── classification: VARCHAR(50) (CHECK classification IN ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'))
├── retention_class: VARCHAR(50) (CHECK retention_class IN ('HOT', 'WARM', 'COLD'))
├── delete_after: TIMESTAMP (nullable)
├── legal_hold: BOOLEAN (DEFAULT FALSE)
└── created_at, updated_at: TIMESTAMPS
```

#### Database Constraints & Invariants:
- **Locational Uniqueness**: `UNIQUE(storage_disk, object_key)` guarantees that no two records claim the same physical storage path on a given disk.
- **Non-negative Size**: `CHECK (byte_size >= 0)` enforces mathematical validity.
- **Classification & Retention Constraints**: Database `CHECK` constraints prevent arbitrary string insertion, matching domain enums.
- **SHA-256 Integrity Verification**: When provided, `sha256` must be exactly 64 hexadecimal characters, normalized to lowercase. SHA-256 is used for file integrity verification and duplicate detection readiness; it is intentionally **not globally unique** because multiple distinct business objects may legitimately reference identical file contents.
- **Zero Credential Exposure**: No access keys, secret tokens, or signed URLs are stored in database columns.

---

### 3. Data Classification Semantics

All stored objects are assigned an immutable data classification governing access boundaries, encryption requirements, and future AI ingestion eligibility:

| Classification | Definition | Examples | Future AI Ingestion Allowed? |
| :--- | :--- | :--- | :--- |
| `PUBLIC` | Information intended for public distribution without harm. | Storefront product images, public nutritional facts. | Yes (with explicit ingestion pipeline) |
| `INTERNAL` | Business information for internal company operations. | Internal SOPs, standard recipes, warehouse layout docs. | Yes (subject to RBAC and policy approval) |
| `CONFIDENTIAL` | Sensitive operational, commercial, or customer data. | Invoices, sales contracts, customer complaint evidence. | **NO** (Strictly excluded) |
| `RESTRICTED` | Highly sensitive data with legal, regulatory, or personal risk. | Customer identity docs, payment confirmations, credentials. | **FORBIDDEN** (Strictly excluded) |

---

### 4. Retention Lifecycle & Dual-Layer Deletion Protection

The lifecycle of stored objects is governed by storage temperature, scheduled expiration, and legal hold:

- **`retention_class`**: `HOT` (frequently accessed active operational media), `WARM` (infrequently accessed operational records), `COLD` (archived historical media for compliance).
- **`delete_after`**: Nullable timestamp specifying the earliest date/time when an object becomes eligible for deletion. When `null`, the object is retained indefinitely.
- **`legal_hold`**: First-class boolean flag indicating that the object is subject to legal, regulatory, or investigative preservation.

#### Deletion Eligibility Invariant:
An object is eligible for deletion **only when all three conditions are met**:
```text
delete_after IS NOT NULL
AND now >= delete_after
AND legal_hold == FALSE
```

#### Dual-Layer Enforcement:
1. **Application Layer (`RetentionPolicyService` & `StoredObject` Eloquent Hooks)**:
   - `RetentionPolicyService::isDeletionEligible(StoredObject $object, DateTimeInterface $now): bool` evaluates eligibility before any deletion pipeline executes.
   - `StoredObject::deleting` model lifecycle hook intercepts delete attempts and throws a `RuntimeException` if an ineligible object is deleted via Eloquent.
2. **PostgreSQL Database Boundary (Trigger Guard)**:
   - A PostgreSQL `BEFORE DELETE` trigger (`trg_protect_stored_objects_retention`) aborts deletion with an `integrity_constraint_violation` exception whenever:
     ```sql
     OLD.legal_hold = TRUE
     OR OLD.delete_after IS NULL
     OR OLD.delete_after > CURRENT_TIMESTAMP
     ```
   - This ensures that even direct SQL queries or unvalidated background jobs cannot bypass legal hold or scheduled retention invariants.
   - *Note*: Automated destructive deletion background workers are deferred to future operational phases; Gate 0D.2 establishes policy and defensive persistence only.

---

### 5. Controlled Attachment Ownership (`object_attachments`)

To attach binary objects to business records without polluting transactional tables with polymorphic columns or creating unconstrained loose references, Gate 0D.2 introduces `object_attachments`:

```text
object_attachments
├── id: UUID (Primary Key)
├── stored_object_id: UUID (FK -> stored_objects.id ON DELETE CASCADE)
├── owner_type: VARCHAR(50) (CHECK owner_type IN ('PRODUCT_VARIANT', 'ORDER'))
├── owner_id: VARCHAR(36) (UUID format)
├── purpose: VARCHAR(50) (CHECK purpose IN ('PRODUCT_IMAGE', 'INVOICE_PDF', 'COMPLAINT_EVIDENCE'))
└── created_at, updated_at: TIMESTAMPS
```

#### Referential Integrity Trade-off & Decision:
- **Architectural Trade-off**: Generic polymorphic relationships (`owner_type`, `owner_id`) cannot possess native PostgreSQL foreign keys across multiple independent tables (`product_variants`, `orders`).
- **Controlled Boundary Strategy**:
  1. **Strict Enum Restraint**: `AttachmentOwnerType` contains **only currently existing domain entities**: `PRODUCT_VARIANT` and `ORDER`. Speculative owner types for nonexistent domains (e.g. `CUSTOMER_COMPLAINT`, `QUALITY_CHECK`, `SUPPLIER`) are **strictly prohibited** in Gate 0D.2. Complaint evidence is temporarily attached to `ORDER` with purpose `COMPLAINT_EVIDENCE` until a dedicated complaint bounded context is established.
  2. **Application-Enforced Owner Existence**: The application service validates that `owner_type` is an approved enum and that the referenced record actually exists in PostgreSQL before creating the attachment.
  3. **Database-Enforced Stored Object FK**: The link to `stored_objects` is a strict, database-enforced foreign key with cascade deletion.

---

### 6. Storage Provider Abstraction & S3 Runtime Boundary

Storage operations are separated into low-level infrastructure primitives and domain retention coordination:

#### 1. Infrastructure Port (`ObjectStorageProviderInterface`):
Low-level storage operations contain **zero domain retention logic**, keeping drivers reusable across S3, MinIO, or local disk:
```php
interface ObjectStorageProviderInterface
{
    public function put(string $key, string $contents, array $metadata = []): bool;
    public function exists(string $key): bool;
    public function delete(string $key): bool;
    public function temporaryUrl(string $key, DateTimeInterface $expiresAt): string;
    public function metadata(string $key): array;
}
```

#### 2. Domain Deletion Coordinator (`StoredObjectDeletionService`):
Orchestrates deletion safely:
```text
StoredObject
    ↓
RetentionPolicyService (Check eligibility)
    ↓ If eligible:
ObjectStorageProviderInterface::delete($object->object_key)
    ↓
StoredObject::delete() (Database record removed subject to DB trigger)
```

#### 3. Filesystem Configuration (`config/filesystems.php`):
Configures `local` and `object` (S3-compatible) disks reading environment variables:
`OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_REGION`, `OBJECT_STORAGE_ACCESS_KEY`, `OBJECT_STORAGE_SECRET_KEY`, `OBJECT_STORAGE_PATH_STYLE`.

#### 4. Honest Runtime Maturity Statement:
- Metadata persistence model: `TESTED`
- Storage provider contract: `IMPLEMENTED`
- Laravel object disk configuration: `IMPLEMENTED`
- **S3 runtime adapter (`league/flysystem-aws-s3-v3`)**: `PLANNED / UNVERIFIED`. The package is intentionally omitted from `composer.json` to prevent unnecessary dependency expansion and keep security audits clean. The ERP Core boots successfully without configured S3 credentials and fails closed only when an object storage driver operation is explicitly requested.

---

### 7. Backup & Disaster Recovery (PITR) Target Architecture

To satisfy enterprise operational durability requirements without making unevidenced claims, Callme Yoghurt defines target recovery objectives for production deployment:

```text
Recovery Point Objective (RPO): <= 15 minutes (TARGET)
Recovery Time Objective (RTO):  <= 4 hours    (TARGET)
```

#### Verification Status Distinction:
- **`DEFINED TARGET`**: Architectural recovery goals and technical design documented.
- **`IMPLEMENTED BACKUP`**: Automated backup pipelines and cron jobs running in production.
- **`RESTORE TESTED`**: End-to-end recovery drills successfully executed and verified against data loss.
*For Gate 0D.2, Backup/PITR is strictly a **`DOCUMENTED TARGET`**. Operational backup scripts and restore drills are not yet implemented.*

#### Target Architecture Specifications:
1. **PostgreSQL Recovery**:
   - **Base Backups**: Daily automated physical base backups compressed and encrypted.
   - **Continuous Archiving / PITR**: Write-Ahead Logs (WAL) continuously shipped to isolated backup object storage via `pg_receivewal` or WAL archiving tools (e.g. pgBackRest). Enables granular point-in-time recovery to within 15 minutes of an incident.
   - **Target Retention**: 30 days of continuous PITR capability, 12 months of monthly snapshots.
2. **Object Storage Recovery**:
   - **Bucket Versioning**: Enabled on object storage to protect against accidental overwrite or ransomware deletion.
   - **Lifecycle Management**: Automatic transition from HOT to WARM/COLD tiers.
   - **Replication**: Cross-region or secondary account replication for critical business documents (invoices, QC evidence).
3. **Backup Security Standards**:
   - **Encryption**: AES-256 encryption at rest (KMS/server-side) and TLS in transit.
   - **Isolated Credentials**: Backup workers use dedicated credentials with append/write permissions only; they cannot delete historical backup archives (WORM/Object Lock principle).
   - **Physical Separation**: Backups are stored in dedicated backup buckets/storage accounts completely separate from live operational disks. **A Docker volume is NOT a backup.**
   - **Periodic Drills**: Quarterly restore drills to staging environments to verify recovery integrity and measure actual RTO.

---

### 8. pgvector Readiness & AI Separation

Gate 0D requires vector readiness while ensuring core ERP stability and data privacy:

#### 1. Core ERP Independence:
- The ERP Core must boot, migrate, and operate **with zero dependency on the `pgvector` extension**.
- The `pgvector` extension and vector embeddings are optional search enhancements, not core transactional dependencies.

#### 2. Derived Knowledge Schema (`knowledge_documents`, `knowledge_chunks`):
Metadata tables are provided for future retrieval-augmented generation (RAG):
- **`knowledge_documents`**: Stores document metadata (`id`, `source_type`, `source_reference`, `title`, `classification`, `content_hash`).
- **`knowledge_chunks`**: Stores textual chunks (`id`, `knowledge_document_id`, `chunk_index`, `content`, `token_count`).
- **No Vector Columns in Phase 0**: Vector columns and embedding calculations are deferred until the AI platform phase (Phase 6) and until the `pgvector` extension is verified on target PostgreSQL instances.

#### 3. Strict PII & Transactional AI Exclusion Boundary:
Transactional ERP tables and sensitive customer data are **strictly forbidden** from automatic embedding or ingestion into AI retrieval stores:
- `customers` (Names, phone numbers, delivery addresses)
- `orders` & `order_lines` (Transactional history)
- `payments` (Financial records)
- `stock_ledger_entries`, `stock_reservations`, `stock_allocations` (Inventory state)
- Credentials, tokens, encryption keys, and secrets

Any future AI indexing must be governed by explicit document classification (`PUBLIC` or approved `INTERNAL` only), an approved data governance policy, and an auditable ingestion workflow.

---

### 9. Database Record Lifecycle Strategy

Data retention across the database is categorized by domain character:

| Record Class | Examples | Target Lifecycle Policy | Justification |
| :--- | :--- | :--- | :--- |
| **Audit / Stock Ledger** | `stock_ledger_entries` | Permanent / Immutable | Legal, fiscal, and inventory traceability. Corrections are append-only. |
| **Transactional Records** | `orders`, `order_lines`, `customers` | Long-term business retention (TBD per Indonesian fiscal law) | Statutory tax and commercial compliance. |
| **Binary Metadata** | `stored_objects`, `object_attachments` | Governed by `delete_after` & `legal_hold` | Controlled operational pruning subject to legal hold. |
| **Derived AI Indexes** | `knowledge_chunks`, future vector embeddings | Ephemeral / Rebuildable | Can be purged and re-indexed from source documents at any time. |
| **Operational Logs** | Application logs, HTTP access logs | 30–90 days | Security observability with rolling retention. |
| **Backups** | DB snapshots, WAL archives | 30 days PITR / 1-year monthly archive | Disaster recovery and compliance. |

*Statutory retention periods not defined by verified regulation are marked as policy configuration/TBD.*

---

## Consequences

### Positive
- Authoritative metadata model in PostgreSQL eliminates raw binary blobs and unverified storage URLs.
- Dual-layer retention enforcement (PostgreSQL trigger + application service) makes legal hold and retention immutability unbypassable.
- Strict enums for `DataClassification`, `RetentionClass`, `AttachmentPurpose`, and `AttachmentOwnerType` prevent schema decay.
- Clear separation between infrastructure storage primitives and business retention policy.
- Complete independence between core ERP transactional operations and optional pgvector AI capabilities.
- Concrete disaster recovery targets (RPO <= 15m, RTO <= 4h) documented without false claims of operational completion.

### Limitations & Next Steps
- S3 Flysystem driver is deferred; live object storage uploads will be integrated when cloud infrastructure is provisioned.
- Automated backup cron jobs and restore drills remain operational targets to be verified in infrastructure deployment phases.
- Vector embeddings and pgvector extension installation are deferred to AI Intelligence Layer (Phase 6).
