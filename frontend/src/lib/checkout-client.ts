import { normalizeIndonesianPhone } from './security/pii-masking.ts';
import { isUuid } from './catalog.ts';

export type DeliveryMethod = 'instant' | 'sameday' | 'nextday';

export interface CheckoutCustomerInput {
  name: string;
  whatsapp: string;
  address: string;
}

export interface CheckoutItemInput {
  variant_id: string;
  quantity: number;
}

export interface CheckoutPayload {
  customer: CheckoutCustomerInput;
  items: CheckoutItemInput[];
  delivery_method: DeliveryMethod;
}

export interface StoredAttemptRecord {
  version: 1;
  request_hash: string;
  idempotency_key: string;
}

export interface PublicCommittedOrderData {
  order_id: string;
  order_number: string;
  status: 'CONFIRMED';
  total_amount: number;
  request_id: string;
}

export interface StoredConfirmationRecord {
  version: 1;
  order_id: string;
  order_number: string;
  status: 'CONFIRMED';
  total_amount: number;
  request_id: string;
  recorded_at: number;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const CHECKOUT_ATTEMPT_STORAGE_KEY = 'callme.checkout.attempt.v1';
export const CHECKOUT_CONFIRMATION_STORAGE_KEY = 'callme.checkout.confirmation.v1';
export const CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function getSessionStorage(customStorage?: KeyValueStorage): KeyValueStorage | null {
  if (customStorage) {
    return customStorage;
  }
  if (typeof window !== 'undefined' && window.sessionStorage) {
    return window.sessionStorage;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Builds a deterministic canonical representation of the checkout request.
 *
 * Invariants (Gate 0E.2B):
 * - Normalizes Indonesian phone using standard normalizeIndonesianPhone (e.g. 0812 -> 62812).
 * - Trims customer name and address.
 * - Sorts items deterministically by variant_id ASC.
 * - Uses fixed, predictable object structure.
 * - Contains NO price or client-injected amounts.
 */
export function buildCanonicalCheckoutPayload(payload: CheckoutPayload) {
  const sortedItems = [...payload.items]
    .map((item) => ({
      quantity: item.quantity,
      variant_id: item.variant_id.trim(),
    }))
    .sort((a, b) => (a.variant_id < b.variant_id ? -1 : a.variant_id > b.variant_id ? 1 : 0));

  return {
    customer: {
      address: payload.customer.address.trim(),
      name: payload.customer.name.trim(),
      whatsapp: normalizeIndonesianPhone(payload.customer.whatsapp.trim()),
    },
    delivery_method: payload.delivery_method,
    items: sortedItems,
  };
}

/**
 * Computes deterministic SHA-256 hash of the canonical checkout request using Web Crypto.
 */
export async function computeCanonicalRequestHash(payload: CheckoutPayload): Promise<string> {
  const canonical = buildCanonicalCheckoutPayload(payload);
  const serialized = JSON.stringify(canonical);
  const encoder = new TextEncoder();
  const data = encoder.encode(serialized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Retrieves an existing idempotency key for identical semantic requests,
 * or generates a new crypto.randomUUID() key and persists it in sessionStorage.
 *
 * Invariants (Gate 0E.2B):
 * - Key is generated via crypto.randomUUID(), NEVER derived from PII.
 * - Stored record contains NO PII (only version, request_hash, idempotency_key).
 * - Identical requests (same canonical hash) reuse the same key.
 * - Changed requests generate a new key.
 * - Fails closed if Web Crypto or sessionStorage is unavailable.
 */
export async function getOrGenerateIdempotencyKey(
  payload: CheckoutPayload,
  storage?: KeyValueStorage,
): Promise<string> {
  const s = getSessionStorage(storage);
  if (!s) {
    throw new Error('Client storage is unavailable');
  }

  const requestHash = await computeCanonicalRequestHash(payload);

  try {
    const rawStored = s.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY);
    if (rawStored) {
      const parsed: unknown = JSON.parse(rawStored);
      if (
        isRecord(parsed) &&
        parsed.version === 1 &&
        parsed.request_hash === requestHash &&
        typeof parsed.idempotency_key === 'string' &&
        isUuid(parsed.idempotency_key)
      ) {
        return parsed.idempotency_key;
      }
    }
  } catch {
    // Malformed storage record, will be safely replaced below
  }

  const newKey = crypto.randomUUID();
  const attemptRecord: StoredAttemptRecord = {
    version: 1,
    request_hash: requestHash,
    idempotency_key: newKey,
  };

  s.setItem(CHECKOUT_ATTEMPT_STORAGE_KEY, JSON.stringify(attemptRecord));
  return newKey;
}

/**
 * Clears the active checkout attempt record from sessionStorage.
 *
 * Invariant (Gate 0E.2B):
 * Must ONLY be called after receiving and validating a committed order.
 */
export function clearCheckoutAttempt(storage?: KeyValueStorage): void {
  const s = getSessionStorage(storage);
  if (s) {
    try {
      s.removeItem(CHECKOUT_ATTEMPT_STORAGE_KEY);
    } catch {
      // Ignore storage cleanup failures
    }
  }
}

/**
 * Persists a safe public confirmation record in sessionStorage.
 *
 * Invariants (Gate 0E.2B):
 * - Contains NO customer PII (no name, whatsapp, address, tokens).
 * - Total amount comes strictly from the server-validated response.
 * - Fails safely without throwing if storage fails.
 */
export function saveOrderConfirmation(
  data: PublicCommittedOrderData,
  storage?: KeyValueStorage,
): boolean {
  const s = getSessionStorage(storage);
  if (!s) {
    return false;
  }

  const record: StoredConfirmationRecord = {
    version: 1,
    order_id: data.order_id,
    order_number: data.order_number,
    status: 'CONFIRMED',
    total_amount: data.total_amount,
    request_id: data.request_id,
    recorded_at: Date.now(),
  };

  try {
    s.setItem(CHECKOUT_CONFIRMATION_STORAGE_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates whether a stored confirmation matches the query order ID and is still fresh.
 *
 * Invariants (Gate 0E.2B):
 * - Direct navigation or URL forging without a valid matching session record returns null.
 * - Enforces status === CONFIRMED and non-negative integer total.
 * - Rejects expired records (TTL: 24h).
 */
export function getValidOrderConfirmation(
  queryOrderId: string | null,
  storage?: KeyValueStorage,
  maxAgeMs: number = CONFIRMATION_TTL_MS,
): StoredConfirmationRecord | null {
  if (!queryOrderId || !isUuid(queryOrderId)) {
    return null;
  }

  const s = getSessionStorage(storage);
  if (!s) {
    return null;
  }

  try {
    const raw = s.getItem(CHECKOUT_CONFIRMATION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const record: unknown = JSON.parse(raw);
    if (!isRecord(record)) {
      return null;
    }

    if (
      record.version !== 1 ||
      record.order_id !== queryOrderId.trim() ||
      !isUuid(record.order_id) ||
      typeof record.order_number !== 'string' ||
      record.order_number.trim().length === 0 ||
      record.status !== 'CONFIRMED' ||
      typeof record.total_amount !== 'number' ||
      !Number.isInteger(record.total_amount) ||
      record.total_amount < 0 ||
      typeof record.request_id !== 'string' ||
      record.request_id.trim().length === 0 ||
      typeof record.recorded_at !== 'number'
    ) {
      return null;
    }

    const now = Date.now();
    const age = now - record.recorded_at;
    if (age > maxAgeMs || age < -60_000) {
      return null;
    }

    return {
      version: 1,
      order_id: (record.order_id as string).trim(),
      order_number: (record.order_number as string).trim(),
      status: "CONFIRMED",
      total_amount: record.total_amount as number,
      request_id: (record.request_id as string).trim(),
      recorded_at: record.recorded_at as number,
    };
  } catch {
    return null;
  }
}

/**
 * Validates the public response contract returned by the BFF checkout endpoint.
 */
export function validateCheckoutBffResponse(body: unknown): PublicCommittedOrderData | null {
  if (!isRecord(body) || body.success !== true || !isRecord(body.data)) {
    return null;
  }

  const d = body.data;
  if (
    !isUuid(d.order_id) ||
    typeof d.order_number !== 'string' ||
    d.order_number.trim().length === 0 ||
    d.status !== 'CONFIRMED' ||
    typeof d.total_amount !== 'number' ||
    !Number.isInteger(d.total_amount) ||
    d.total_amount < 0 ||
    typeof d.request_id !== 'string' ||
    d.request_id.trim().length === 0
  ) {
    return null;
  }

  return {
    order_id: (d.order_id as string).trim(),
    order_number: (d.order_number as string).trim(),
    status: 'CONFIRMED',
    total_amount: d.total_amount,
    request_id: (d.request_id as string).trim(),
  };
}

export interface CheckoutSubmissionResult {
  success: boolean;
  data?: PublicCommittedOrderData;
  storageFailed?: boolean;
  error?: string;
  statusCode?: number;
}

/**
 * Executes a safe, idempotent browser checkout submission.
 *
 * Sequence:
 * 1. Establish/recover stable Idempotency-Key (fails closed if storage/crypto unavailable).
 * 2. Send POST /api/checkout with Idempotency-Key header.
 * 3. Validate committed order contract (status 200 or 201).
 * 4. Attempt to persist confirmation in sessionStorage.
 * 5. On successful confirmation write, retire attempt record.
 * 6. If confirmation write fails, keep attempt record and signal storageFailed: true.
 * 7. On any non-committed response or failure, preserve attempt for safe retry.
 */
export async function executeCheckoutSubmission(
  payload: CheckoutPayload,
  options?: {
    storage?: KeyValueStorage;
    fetchFn?: typeof fetch;
  },
): Promise<CheckoutSubmissionResult> {
  const storage = options?.storage;
  const fetchImpl = options?.fetchFn || fetch;

  let idempotencyKey: string;
  try {
    idempotencyKey = await getOrGenerateIdempotencyKey(payload, storage);
  } catch {
    return {
      success: false,
      error: 'Tidak dapat mengamankan sesi transaksi (penyimpanan browser tidak tersedia). Silakan periksa pengaturan browser Anda.',
    };
  }

  let response: Response;
  try {
    response = await fetchImpl('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
  } catch {
    // Network failure: preserve attempt for safe retry
    return {
      success: false,
      error: 'Koneksi terputus saat menghubungi server. Silakan coba lagi.',
    };
  }

  if (response.status !== 200 && response.status !== 201) {
    let message = 'Gagal memproses pesanan. Silakan coba lagi.';
    switch (response.status) {
      case 400:
        message = 'Data pesanan tidak valid. Silakan periksa kembali formulir Anda.';
        break;
      case 409:
        message = 'Stok produk atau pesanan mengalami perubahan. Silakan periksa kembali pesanan Anda.';
        break;
      case 422:
        message = 'Data pesanan tidak lolos verifikasi sistem. Silakan periksa kembali informasi Anda.';
        break;
      case 429:
        message = 'Terlalu banyak percobaan pesanan. Mohon tunggu beberapa saat sebelum mencoba kembali.';
        break;
      case 502:
        message = 'Gagal memproses respons dari sistem pesanan. Silakan coba lagi.';
        break;
      case 503:
        message = 'Layanan checkout sedang tidak tersedia. Silakan coba beberapa saat lagi.';
        break;
    }

    return {
      success: false,
      error: message,
      statusCode: response.status,
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      success: false,
      error: 'Gagal memproses respons dari sistem pesanan (format data tidak valid).',
      statusCode: 502,
    };
  }

  const committedData = validateCheckoutBffResponse(body);
  if (!committedData) {
    return {
      success: false,
      error: 'Konfirmasi pesanan dari server tidak memenuhi standar validasi.',
      statusCode: 502,
    };
  }

  const saved = saveOrderConfirmation(committedData, storage);
  if (!saved) {
    // Edge case: order is committed, but confirmation storage failed.
    // Retain attempt so accidental resubmission remains idempotent.
    return {
      success: true,
      data: committedData,
      storageFailed: true,
      statusCode: response.status,
    };
  }

  // Clear completed attempt only after confirmation has been persisted
  clearCheckoutAttempt(storage);

  return {
    success: true,
    data: committedData,
    storageFailed: false,
    statusCode: response.status,
  };
}
