import { NextRequest } from 'next/server';
import { BiteshipShippingProvider } from '@/lib/shipping/biteship-provider';
import { getServiceFeeConfig } from '@/lib/shipping/service-fee-config';
import type { ShippingCalculationInput } from '@/lib/shipping/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/shipping/quote
 * Returns server-authoritative service fee configuration ("Biaya Layanan")
 * for checkout display and initialization.
 */
export async function GET(): Promise<Response> {
  const serviceFee = getServiceFeeConfig();
  return Response.json(
    {
      success: true,
      service_fee: serviceFee,
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}

/**
 * POST /api/shipping/quote
 * Calculates real Biteship rates filtered by Cold Chain policy (SOP 01)
 * and returns permitted quotes along with server-authoritative Biaya Layanan.
 * Zero unapproved store pickup or synthetic fallback prices.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const serviceFee = getServiceFeeConfig();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      {
        success: false,
        quotes: [],
        error: 'Payload permintaan kalkulasi ongkir tidak valid.',
        service_fee: serviceFee,
      },
      {
        status: 400,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }

  const destination_area_id =
    typeof body.destination_area_id === 'string' ? body.destination_area_id.trim() : undefined;
  const destination_postal_code =
    typeof body.destination_postal_code === 'string' ? body.destination_postal_code.trim() : undefined;
  const destination_latitude =
    typeof body.destination_latitude === 'number' ? body.destination_latitude : undefined;
  const destination_longitude =
    typeof body.destination_longitude === 'number' ? body.destination_longitude : undefined;
  const city = typeof body.city === 'string' ? body.city.trim() : 'Jakarta Timur';
  const province = typeof body.province === 'string' ? body.province.trim() : 'DKI Jakarta';
  const district = typeof body.district === 'string' ? body.district.trim() : 'Cipayung';
  const weight_grams = typeof body.weight_grams === 'number' ? body.weight_grams : undefined;

  let items: ShippingCalculationInput['items'] = undefined;
  if (Array.isArray(body.items)) {
    items = body.items.map((item: Record<string, unknown>) => ({
      name: typeof item.name === 'string' ? item.name : 'Callme Yoghurt',
      quantity: typeof item.quantity === 'number' ? item.quantity : 1,
      value: typeof item.value === 'number' ? item.value : 35000,
      weight_grams: typeof item.weight_grams === 'number' ? item.weight_grams : undefined,
    }));
  }

  const input: ShippingCalculationInput = {
    city,
    province,
    district,
    weight: typeof body.weight === 'number' ? body.weight : 1,
    weight_grams,
    delivery_method: 'instant',
    destination_area_id,
    destination_postal_code,
    destination_latitude,
    destination_longitude,
    items,
  };

  const provider = new BiteshipShippingProvider();
  const quoteResult = await provider.fetchQuotes(input);

  if (!quoteResult.success) {
    return Response.json(
      {
        success: false,
        quotes: [],
        error: quoteResult.error || 'Ongkir belum dapat dihitung',
        service_fee: serviceFee,
      },
      {
        status: 422,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }

  // Phase 1.7C.19A: Strictly real Biteship cold-chain quotes only. Zero unapproved store pickup injection.
  return Response.json(
    {
      success: true,
      quotes: quoteResult.quotes,
      service_fee: serviceFee,
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
