/**
 * Callme Yoghurt — Load Testing Helpers (Phase 1.3A)
 *
 * Provides synthetic data generators and assertion helpers compatible with k6's JS runtime.
 */

import { sleep } from 'k6';

const FIRST_NAMES = ['Budi', 'Siti', 'Ahmad', 'Dewi', 'Eko', 'Rina', 'Fajar', 'Maya', 'Rizky', 'Putri'];
const LAST_NAMES = ['Santoso', 'Rahmawati', 'Hidayat', 'Kusuma', 'Pratama', 'Wijaya', 'Siregar', 'Lestari'];
const STREETS = ['Jl. Margonda Raya', 'Jl. Fatmawati No.', 'Jl. Sudirman Kav.', 'Jl. Pajajaran No.', 'Jl. Bambu Apus No.'];
const DELIVERY_METHODS = ['instant', 'sameday', 'nextday'];

/**
 * Returns a random element from an array.
 */
export function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Generates a realistic Indonesian synthetic customer name.
 */
export function generateCustomerName() {
  return `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`;
}

/**
 * Generates a synthetic Indonesian phone number normalized to standard local format.
 */
export function generateIndonesianPhone() {
  const suffixes = ['12', '13', '21', '52', '57', '78'];
  const prefix = `08${randomItem(suffixes)}`;
  const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}${randomDigits}`.slice(0, 12);
}

/**
 * Generates a synthetic Jakarta/Depok delivery address.
 */
export function generateAddress() {
  const street = randomItem(STREETS);
  const num = Math.floor(1 + Math.random() * 150);
  return `${street} ${num}, RT 02/RW 05, Jabodetabek, 13890`;
}

/**
 * Generates a unique, high-entropy Idempotency Key.
 */
export function generateIdempotencyKey(prefix = 'k6') {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 9);
  return `${prefix}-${timestamp}-${rand}`;
}

/**
 * Constructs a fully validated, schema-compliant checkout payload for /api/checkout.
 */
export function buildCheckoutPayload(options = {}) {
  const variantId = options.variantId || '018f6c38-8c50-711e-b8d4-53a8be77e440';
  const quantity = options.quantity || 1;
  const deliveryMethod = options.deliveryMethod || randomItem(DELIVERY_METHODS);

  return {
    customer: {
      name: options.name || generateCustomerName(),
      whatsapp: options.whatsapp || generateIndonesianPhone(),
      address: options.address || generateAddress(),
    },
    delivery_method: deliveryMethod,
    items: [
      {
        variant_id: variantId,
        quantity: quantity,
      },
    ],
  };
}

/**
 * Human think time delay (between min and max ms).
 */
export function thinkTime(minMs = 100, maxMs = 500) {
  const ms = Math.floor(minMs + Math.random() * (maxMs - minMs));
  sleep(ms / 1000);
}
