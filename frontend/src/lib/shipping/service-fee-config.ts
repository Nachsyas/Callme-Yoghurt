/**
 * Service Fee Configuration (Phase 1.7C.19A)
 *
 * Rules:
 * - Officially labeled "Biaya Layanan".
 * - Covers small order-processing / digital-service operational costs, including API overhead.
 * - Integer IDR only, non-negative.
 * - Server-controlled (process.env.SERVICE_FEE_IDR). Never use NEXT_PUBLIC_ prefix.
 * - If absent or invalid: do NOT silently invent Rp1.000 or another value.
 *   Fail safe for payment commitment and clearly report incomplete business configuration.
 */

export interface ServiceFeeConfig {
  isConfigured: boolean;
  amount: number | null;
  name: string; // strictly 'Biaya Layanan'
  error?: string;
}

export function getServiceFeeConfig(): ServiceFeeConfig {
  const rawFee = process.env.SERVICE_FEE_IDR;

  if (rawFee === undefined || rawFee.trim() === '') {
    return {
      isConfigured: false,
      amount: null,
      name: 'Biaya Layanan',
      error: 'Konfigurasi Biaya Layanan (SERVICE_FEE_IDR) belum ditentukan oleh pemilik bisnis.',
    };
  }

  const parsed = Number(rawFee.trim());

  if (!Number.isInteger(parsed) || isNaN(parsed) || parsed < 0) {
    return {
      isConfigured: false,
      amount: null,
      name: 'Biaya Layanan',
      error: 'Konfigurasi Biaya Layanan (SERVICE_FEE_IDR) tidak valid: harus bilangan bulat non-negatif.',
    };
  }

  return {
    isConfigured: true,
    amount: parsed,
    name: 'Biaya Layanan',
  };
}
