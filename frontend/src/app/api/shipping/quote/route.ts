import { NextRequest } from 'next/server';
import { isUuid } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store',
  Pragma: 'no-cache',
};

const UPSTREAM_TIMEOUT_MS = 10000;

/**
 * GET /api/shipping/quote
 * Returns server-authoritative service fee configuration ("Biaya Layanan")
 * from ERP for checkout display and initialization.
 *
 * Invariants (Phase 1.7C.19C Section 14):
 * - ERP is the SOLE authority for service fee.
 * - Zero fallback to hardcoded or Next.js synthetic config.
 * - If ERP is unreachable or unconfigured, fails closed as BLOCKED.
 */
export async function GET(): Promise<Response> {
  const erpBaseUrl = process.env.ERP_INTERNAL_URL;
  const erpServiceToken = process.env.ERP_SERVICE_TOKEN;

  if (erpBaseUrl && erpServiceToken) {
    try {
      const upstreamRes = await fetch(`${erpBaseUrl.replace(/\/$/, '')}/api/internal/shipping/fee-config`, {
        headers: {
          Authorization: `Bearer ${erpServiceToken}`,
        },
        cache: 'no-store',
      });
      if (upstreamRes.ok) {
        const data = await upstreamRes.json();
        return Response.json(
          {
            success: true,
            service_fee: {
              isConfigured: data.service_fee?.is_configured ?? false,
              amount: data.service_fee?.amount ?? null,
              name: data.service_fee?.name ?? 'Biaya Layanan',
              status: data.service_fee?.status ?? 'BLOCKED — OWNER FEE VALUE REQUIRED',
            },
          },
          { status: 200, headers: NO_CACHE_HEADERS }
        );
      }
    } catch {
      // Fail closed
    }
  }

  // Fails closed without inventing a local fee
  return Response.json(
    {
      success: true,
      service_fee: {
        isConfigured: false,
        amount: null,
        name: 'Biaya Layanan',
        status: 'BLOCKED — OWNER FEE VALUE REQUIRED',
      },
    },
    { status: 200, headers: NO_CACHE_HEADERS }
  );
}

/**
 * POST /api/shipping/quote
 * Forwards cart projection and destination to Laravel ERP.
 * Laravel resolves variants, prices, measured weights, time-gating, and calls Biteship.
 * Browser NEVER supplies authoritative weight or product price!
 */
export async function POST(request: NextRequest): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      {
        success: false,
        quotes: [],
        error: 'Payload permintaan kalkulasi ongkir tidak valid.',
      },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  // Strictly validate projection items: variant_id + quantity only!
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return Response.json(
      {
        success: false,
        quotes: [],
        error: 'Keranjang belanja kosong atau tidak valid.',
      },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const projectionItems: Array<{ variant_id: string; quantity: number }> = [];
  for (const item of body.items) {
    const it = item as Record<string, unknown>;
    if (
      typeof it !== 'object' ||
      it === null ||
      typeof it.variant_id !== 'string' ||
      !isUuid(it.variant_id) ||
      typeof it.quantity !== 'number' ||
      !Number.isInteger(it.quantity) ||
      it.quantity < 1 ||
      it.quantity > 100
    ) {
      return Response.json(
        {
          success: false,
          quotes: [],
          error: 'Item varian produk atau jumlah dalam keranjang tidak valid.',
        },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    projectionItems.push({
      variant_id: it.variant_id.trim(),
      quantity: it.quantity,
    });
  }

  const erpBaseUrl = process.env.ERP_INTERNAL_URL;
  const erpServiceToken = process.env.ERP_SERVICE_TOKEN;

  if (!erpBaseUrl || !erpServiceToken) {
    return Response.json(
      {
        success: false,
        quotes: [],
        error: 'Layanan tarif pengiriman sedang tidak tersedia.',
      },
      { status: 503, headers: NO_CACHE_HEADERS }
    );
  }

  const upstreamPayload = {
    items: projectionItems,
    destination_area_id: typeof body.destination_area_id === 'string' ? body.destination_area_id.trim() : undefined,
    destination_postal_code: typeof body.destination_postal_code === 'string' ? body.destination_postal_code.trim() : undefined,
    destination_latitude: typeof body.destination_latitude === 'number' ? body.destination_latitude : undefined,
    destination_longitude: typeof body.destination_longitude === 'number' ? body.destination_longitude : undefined,
    city: typeof body.city === 'string' ? body.city.trim() : undefined,
    province: typeof body.province === 'string' ? body.province.trim() : undefined,
    district: typeof body.district === 'string' ? body.district.trim() : undefined,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstreamRes = await fetch(`${erpBaseUrl.replace(/\/$/, '')}/api/internal/shipping/quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${erpServiceToken}`,
      },
      body: JSON.stringify(upstreamPayload),
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const upstreamData = (await upstreamRes.json()) as Record<string, unknown>;

    if (!upstreamRes.ok) {
      return Response.json(
        {
          success: false,
          quotes: [],
          error_code: upstreamData.error_code || 'SHIPPING_CALCULATION_FAILED',
          error: upstreamData.error || upstreamData.message || 'Ongkir belum dapat dihitung.',
          service_fee: upstreamData.service_fee,
        },
        { status: upstreamRes.status, headers: NO_CACHE_HEADERS }
      );
    }

    const serviceFeeObj = upstreamData.service_fee as Record<string, unknown> | undefined;

    return Response.json(
      {
        success: true,
        quotes: upstreamData.quotes || [],
        service_fee: serviceFeeObj ? {
          isConfigured: Boolean(serviceFeeObj.is_configured),
          amount: typeof serviceFeeObj.amount === 'number' ? serviceFeeObj.amount : null,
          name: (serviceFeeObj.name as string) || 'Biaya Layanan',
          status: (serviceFeeObj.status as string) || 'ACTIVE',
        } : {
          isConfigured: false,
          amount: null,
          name: 'Biaya Layanan',
          status: 'BLOCKED — OWNER FEE VALUE REQUIRED',
        },
        storage_warning: upstreamData.storage_warning,
      },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  } catch {
    clearTimeout(timeoutId);
    return Response.json(
      {
        success: false,
        quotes: [],
        error: 'Gangguan koneksi ke layanan tarif ERP Callme Yoghurt.',
      },
      { status: 502, headers: NO_CACHE_HEADERS }
    );
  }
}
