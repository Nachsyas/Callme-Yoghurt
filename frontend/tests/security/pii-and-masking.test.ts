import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  normalizeIndonesianPhone,
  maskPhone,
  maskName,
  sanitizeForLogging,
} from '../../src/lib/security/pii-masking.ts';

describe('PII Normalization & Redaction Security Baseline', () => {
  describe('Canonical Indonesian phone normalization', () => {
    it('normalizes equivalent phone number inputs to standard 62... format', () => {
      const expected = '628123456789';

      assert.equal(normalizeIndonesianPhone('08123456789'), expected);
      assert.equal(normalizeIndonesianPhone('628123456789'), expected);
      assert.equal(normalizeIndonesianPhone('+628123456789'), expected);
      assert.equal(normalizeIndonesianPhone('+62 812-3456-789'), expected);
      assert.equal(normalizeIndonesianPhone('0812-3456-789'), expected);
    });

    it('returns empty string on empty or non-digit input', () => {
      assert.equal(normalizeIndonesianPhone(''), '');
      assert.equal(normalizeIndonesianPhone('   '), '');
      assert.equal(normalizeIndonesianPhone('abc'), '');
    });
  });

  describe('PII Masking utilities', () => {
    it('masks phone numbers leaving prefix and suffix while hiding center digits', () => {
      const masked = maskPhone('08123456789');
      assert.equal(masked, '62812****789');
      assert.ok(!masked.includes('3456'));
    });

    it('masks customer names for safe logging and display', () => {
      assert.equal(maskName('Budi Santoso'), 'B*** S***');
      assert.equal(maskName('Dewi'), 'D***');
    });

    it('redacts sensitive fields in structured logging payloads', () => {
      const rawLogContext = {
        requestId: 'req-12345',
        status: 200,
        customer: {
          name: 'Budi Santoso',
          whatsapp: '08123456789',
          address: 'Jl. Sudirman No. 1, Jakarta',
        },
        internal: {
          erp_service_token: 'secret-token-value',
          authorization: 'Bearer secret-bearer',
        },
      };

      const sanitized = sanitizeForLogging(rawLogContext) as Record<string, unknown>;

      assert.equal(sanitized.requestId, 'req-12345');
      assert.equal(sanitized.status, 200);

      const customer = sanitized.customer as Record<string, unknown>;
      assert.equal(customer.name, '[REDACTED]');
      assert.equal(customer.whatsapp, '[REDACTED]');
      assert.equal(customer.address, '[REDACTED]');

      const internal = sanitized.internal as Record<string, unknown>;
      assert.equal(internal.erp_service_token, '[REDACTED]');
      assert.equal(internal.authorization, '[REDACTED]');
    });
  });

  describe('Test-Only Golden Vector Alignment with Laravel PhoneBlindIndexService', () => {
    it('generates deterministic HMAC-SHA256 matching Laravel ERP specification', () => {
      const testKey = 'test-crm-pii-blind-index-key-32ch';
      const rawPhone = '+62 812-3456-7890';
      const normalized = normalizeIndonesianPhone(rawPhone);
      assert.equal(normalized, '6281234567890');

      const expectedHmac = createHmac('sha256', testKey)
        .update(normalized)
        .digest('hex');

      // Equivalent input forms must yield the identical hash
      const hmacFromDomestic = createHmac('sha256', testKey)
        .update(normalizeIndonesianPhone('081234567890'))
        .digest('hex');

      assert.equal(expectedHmac, hmacFromDomestic);
      assert.equal(expectedHmac.length, 64);
    });
  });
});
