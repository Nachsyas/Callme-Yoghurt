/**
 * Biteship Configuration & Origin Management (Phase 1.7C.19)
 *
 * SECURITY INVARIANTS:
 * - Server-only: BITESHIP_API_KEY must never be prefixed with NEXT_PUBLIC_ or leaked to the client.
 * - Zero Secret Leakage: Never print, log, or serialize API keys into public responses.
 * - Zero Fabrication: Origin coordinates, postal code, and address must be explicitly configured
 *   by store owner; never silently invent sample Biteship coordinates.
 */

import type { BiteshipOriginConfig } from './types.ts';

export interface BiteshipConfig {
  apiKey: string;
  baseUrl: string;
  origin: BiteshipOriginConfig;
}

export interface OriginValidationResult {
  valid: boolean;
  missingFields: string[];
}

/**
 * Parses coordinate safely from string.
 */
function parseCoordinate(val: string | undefined): number | undefined {
  if (!val || val.trim().length === 0) return undefined;
  const num = parseFloat(val.trim());
  return Number.isFinite(num) ? num : undefined;
}

/**
 * Retrieves server-side Biteship configuration from environment.
 * Allows passing an override config strictly for integration tests.
 */
export function getBiteshipConfig(overrideEnv?: Record<string, string | undefined>): BiteshipConfig {
  const env = overrideEnv || process.env;

  const apiKey = env.BITESHIP_API_KEY?.trim() || '';
  const baseUrl = env.BITESHIP_BASE_URL?.trim() || 'https://api.biteship.com';

  const origin: BiteshipOriginConfig = {
    contact_name: env.BITESHIP_ORIGIN_CONTACT_NAME?.trim() || undefined,
    contact_phone: env.BITESHIP_ORIGIN_CONTACT_PHONE?.trim() || undefined,
    address: env.BITESHIP_ORIGIN_ADDRESS?.trim() || undefined,
    postal_code: env.BITESHIP_ORIGIN_POSTAL_CODE?.trim() || undefined,
    latitude: parseCoordinate(env.BITESHIP_ORIGIN_LATITUDE),
    longitude: parseCoordinate(env.BITESHIP_ORIGIN_LONGITUDE),
    area_id: env.BITESHIP_ORIGIN_AREA_ID?.trim() || undefined,
  };

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    origin,
  };
}

/**
 * Validates whether the required origin fields are present.
 * Biteship requires either:
 * 1. Coordinates (latitude + longitude), or
 * 2. Postal code, or
 * 3. Area ID
 * For instant couriers, latitude & longitude are strictly required.
 */
export function validateBiteshipOriginConfig(origin: BiteshipOriginConfig): OriginValidationResult {
  const missingFields: string[] = [];

  if (!origin.postal_code && !origin.area_id && (origin.latitude === undefined || origin.longitude === undefined)) {
    if (!origin.postal_code) missingFields.push('BITESHIP_ORIGIN_POSTAL_CODE');
    if (origin.latitude === undefined) missingFields.push('BITESHIP_ORIGIN_LATITUDE');
    if (origin.longitude === undefined) missingFields.push('BITESHIP_ORIGIN_LONGITUDE');
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}
