/**
 * Safe PII masking and phone normalization utilities.
 * 
 * ARCHITECTURAL RULE (ADR-0001 / Gate 0B):
 * ERP Core is the sole authoritative owner of PII blind-index generation and encryption.
 * This module is strictly secret-free, client-safe, and used for UI/logging redaction only.
 * It does NOT perform cryptographic hashing or hold HMAC keys.
 */

/**
 * Canonical Indonesian phone normalization.
 * 
 * Rules:
 * - Strips all non-digit characters (+, -, spaces, parentheses).
 * - Maps domestic prefix '0' (0812...) to international standard '62' (62812...).
 * - Retains '62' prefix if already present.
 */
export function normalizeIndonesianPhone(phone: string): string {
  const digits = phone.replace(/\D+/g, '');
  if (!digits) {
    return '';
  }

  if (digits.startsWith('0')) {
    return '62' + digits.slice(1);
  }

  return digits;
}

/**
 * Mask phone number for display or logging without exposing full number.
 * e.g., '628123456789' -> '62812****789'
 */
export function maskPhone(phone: string): string {
  const normalized = normalizeIndonesianPhone(phone);
  if (normalized.length < 7) {
    return '***';
  }

  const prefix = normalized.slice(0, 5);
  const suffix = normalized.slice(-3);
  return `${prefix}****${suffix}`;
}

/**
 * Mask customer name for logs/display.
 * e.g., 'Budi Santoso' -> 'B*** S***'
 */
export function maskName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return '***';
  }

  return trimmed
    .split(/\s+/)
    .map((word) => (word.length <= 1 ? word : `${word[0]}***`))
    .join(' ');
}

/**
 * Redact sensitive fields from objects before structured logging.
 * Never logs raw passwords, secrets, tokens, customer PII, or authorization headers.
 */
export function sanitizeForLogging(data: unknown): unknown {
  if (data === null || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeForLogging);
  }

  const sensitiveKeys = new Set([
    'password',
    'secret',
    'token',
    'authorization',
    'erp_service_token',
    'name',
    'phone',
    'whatsapp',
    'address',
    'credit_card',
    'cvv',
  ]);

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.has(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
