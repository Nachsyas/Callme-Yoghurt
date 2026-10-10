import type { OrderNumberOptions } from './types.ts';

const ALPHANUMERIC_CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates a human-readable, unique order number (Phase 1.7C.15 Task 2).
 *
 * Example: CMY-20260926-0001
 *
 * Requirements:
 * - Unique
 * - Readable by customer
 * - Readable by admin
 */
export function generateHumanOrderNumber(options?: OrderNumberOptions): string {
  const prefix = (options?.prefix || 'CMY').toUpperCase().trim();
  const dateObj = options?.date || new Date();

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  if (options?.sequence !== undefined && options?.sequence !== null) {
    let seqStr: string;
    if (typeof options.sequence === 'number') {
      seqStr = String(Math.max(1, Math.floor(options.sequence))).padStart(4, '0');
    } else {
      seqStr = String(options.sequence).trim().toUpperCase();
    }
    return `${prefix}-${dateStr}-${seqStr}`;
  }

  // Generate 4-character unambiguous uppercase random suffix
  const len = options?.randomLength && options.randomLength > 0 ? options.randomLength : 4;
  let randomSuffix = '';

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < len; i++) {
      randomSuffix += ALPHANUMERIC_CHARSET[bytes[i] % ALPHANUMERIC_CHARSET.length];
    }
  } else {
    for (let i = 0; i < len; i++) {
      randomSuffix += ALPHANUMERIC_CHARSET[Math.floor(Math.random() * ALPHANUMERIC_CHARSET.length)];
    }
  }

  return `${prefix}-${dateStr}-${randomSuffix}`;
}

/**
 * Validates whether an order number adheres to standard readable formats.
 * Accepts CMY-YYYYMMDD-XXXX as well as CY-YYYYMMDD-... for backward compatibility.
 */
export function isValidOrderNumber(orderNumber: unknown): boolean {
  if (typeof orderNumber !== 'string') {
    return false;
  }
  const trimmed = orderNumber.trim();
  if (trimmed.length < 10 || trimmed.length > 50) {
    return false;
  }
  // Standard pattern: 2 to 4 uppercase letters, hyphen, 4 to 8 digits, hyphen, 4+ alphanumeric chars
  const orderRegex = /^[A-Z]{2,4}-\d{4,8}-[A-Z0-9_-]{3,}$/;
  return orderRegex.test(trimmed);
}
