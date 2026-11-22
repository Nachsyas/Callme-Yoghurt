/**
 * Biteship Server-Side REST API Client (Phase 1.7C.19)
 *
 * Security & Cost Protections:
 * - Server-only execution.
 * - In-memory cache for maps areas and rate quotes to prevent expensive request loops.
 * - Strict timeout (8 seconds) to prevent hanging requests.
 * - Sanitized errors: never leak BITESHIP_API_KEY, headers, or internal credentials.
 */

import { getBiteshipConfig } from './biteship-config.ts';
import type { BiteshipArea, BiteshipRateItemPayload, BiteshipRateItemRaw } from './types.ts';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export interface BiteshipRateRequestParams {
  origin_latitude?: number;
  origin_longitude?: number;
  origin_postal_code?: string;
  origin_area_id?: string;
  destination_latitude?: number;
  destination_longitude?: number;
  destination_postal_code?: string;
  destination_area_id?: string;
  couriers?: string;
  items: BiteshipRateItemPayload[];
}

export interface BiteshipClientOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export class BiteshipClient {
  private static instance: BiteshipClient;
  private areasCache: Map<string, CacheEntry<BiteshipArea[]>> = new Map();
  private ratesCache: Map<string, CacheEntry<BiteshipRateItemRaw[]>> = new Map();

  private readonly defaultTimeoutMs: number = 8000;
  private readonly defaultApiKey?: string;
  private readonly defaultBaseUrl?: string;
  private readonly fetchFn: typeof fetch;

  private readonly AREAS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
  private readonly RATES_CACHE_TTL_MS = 5 * 60 * 1000;  // 5 minutes

  constructor(options?: BiteshipClientOptions) {
    if (options?.timeoutMs) this.defaultTimeoutMs = options.timeoutMs;
    if (options?.apiKey) this.defaultApiKey = options.apiKey;
    if (options?.baseUrl) this.defaultBaseUrl = options.baseUrl;
    this.fetchFn = options?.fetchFn || fetch;
  }

  public static getInstance(): BiteshipClient {
    if (!BiteshipClient.instance) {
      BiteshipClient.instance = new BiteshipClient();
    }
    return BiteshipClient.instance;
  }

  /**
   * Resets internal caches (useful for testing).
   */
  public clearCaches(): void {
    this.areasCache.clear();
    this.ratesCache.clear();
  }

  /**
   * Searches areas via GET /v1/maps/areas.
   * Debounce / min-length check enforced by caller and cache.
   */
  public async searchAreas(
    input: string,
    options?: { apiKey?: string; baseUrl?: string }
  ): Promise<{ success: boolean; areas: BiteshipArea[]; error?: string }> {
    const trimmed = input.trim();
    if (trimmed.length < 3) {
      return { success: true, areas: [] };
    }

    const cacheKey = trimmed.toLowerCase();
    const cached = this.areasCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { success: true, areas: cached.data };
    }

    const config = getBiteshipConfig();
    const apiKey = options?.apiKey || this.defaultApiKey || config.apiKey;
    const baseUrl = options?.baseUrl || this.defaultBaseUrl || config.baseUrl;

    if (!apiKey) {
      return {
        success: false,
        areas: [],
        error: 'Layanan pencarian area belum dikonfigurasi (BITESHIP_API_KEY tidak ditemukan).',
      };
    }

    const endpoint = `${baseUrl}/v1/maps/areas?countries=ID&input=${encodeURIComponent(trimmed)}&type=single`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeoutMs);

      const response = await this.fetchFn(endpoint, {
        method: 'GET',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          areas: [],
          error: `Gagal mencari area (Biteship error ${response.status}).`,
        };
      }

      const body = (await response.json()) as { success?: boolean; areas?: BiteshipArea[] };
      const areas = Array.isArray(body?.areas) ? body.areas : [];

      // Store in memory cache
      this.areasCache.set(cacheKey, {
        data: areas,
        expiresAt: Date.now() + this.AREAS_CACHE_TTL_MS,
      });

      return { success: true, areas };
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      return {
        success: false,
        areas: [],
        error: isAbort ? 'Waktu pencarian area habis (timeout).' : 'Gagal menghubungi penyedia lokasi pengiriman.',
      };
    }
  }

  /**
   * Fetches real courier rates via POST /v1/rates/couriers.
   */
  public async getRates(
    params: BiteshipRateRequestParams,
    options?: { apiKey?: string; baseUrl?: string }
  ): Promise<{ success: boolean; rates: BiteshipRateItemRaw[]; error?: string }> {
    const config = getBiteshipConfig();
    const apiKey = options?.apiKey || this.defaultApiKey || config.apiKey;
    const baseUrl = options?.baseUrl || this.defaultBaseUrl || config.baseUrl;

    if (!apiKey) {
      return {
        success: false,
        rates: [],
        error: 'Ongkir belum dapat dihitung: BITESHIP_API_KEY belum dikonfigurasi di server.',
      };
    }

    // Build cache key based on coordinates / area + total items weight
    const cacheKey = JSON.stringify({
      dest_lat: params.destination_latitude,
      dest_lng: params.destination_longitude,
      dest_area: params.destination_area_id,
      dest_postal: params.destination_postal_code,
      orig_lat: params.origin_latitude,
      orig_lng: params.origin_longitude,
      orig_postal: params.origin_postal_code,
      couriers: params.couriers,
      items: params.items.map((i) => ({ w: i.weight, q: i.quantity })),
    });

    const cached = this.ratesCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { success: true, rates: cached.data };
    }

    const endpoint = `${baseUrl}/v1/rates/couriers`;

    // Construct Biteship Rate Request Payload
    const payload: Record<string, unknown> = {
      items: params.items,
    };

    if (params.couriers) {
      payload.couriers = params.couriers;
    }

    // Origin resolution
    if (params.origin_latitude !== undefined && params.origin_longitude !== undefined) {
      payload.origin_latitude = params.origin_latitude;
      payload.origin_longitude = params.origin_longitude;
    }
    if (params.origin_postal_code) {
      payload.origin_postal_code = params.origin_postal_code;
    }
    if (params.origin_area_id) {
      payload.origin_area_id = params.origin_area_id;
    }

    // Destination resolution
    if (params.destination_latitude !== undefined && params.destination_longitude !== undefined) {
      payload.destination_latitude = params.destination_latitude;
      payload.destination_longitude = params.destination_longitude;
    }
    if (params.destination_postal_code) {
      payload.destination_postal_code = params.destination_postal_code;
    }
    if (params.destination_area_id) {
      payload.destination_area_id = params.destination_area_id;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeoutMs);

      const response = await this.fetchFn(endpoint, {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errDesc = `HTTP ${response.status}`;
        try {
          const errBody = (await response.json()) as { message?: string; error?: string };
          if (errBody?.message) errDesc = errBody.message;
        } catch {
          // ignore parsing error
        }
        return {
          success: false,
          rates: [],
          error: `Gagal mendapatkan tarif kurir Biteship (${errDesc}).`,
        };
      }

      const body = (await response.json()) as {
        success?: boolean;
        pricing?: BiteshipRateItemRaw[];
        message?: string;
      };

      if (!body || !Array.isArray(body.pricing)) {
        return {
          success: false,
          rates: [],
          error: 'Format data tarif pengiriman tidak valid dari penyedia kurir.',
        };
      }

      // Store in memory cache
      this.ratesCache.set(cacheKey, {
        data: body.pricing,
        expiresAt: Date.now() + this.RATES_CACHE_TTL_MS,
      });

      return { success: true, rates: body.pricing };
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      return {
        success: false,
        rates: [],
        error: isAbort ? 'Waktu permintaan tarif kurir habis (timeout).' : 'Gagal menghubungi server Biteship.',
      };
    }
  }
}

export const biteshipClient = BiteshipClient.getInstance();
