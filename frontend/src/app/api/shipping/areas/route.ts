import { NextRequest } from 'next/server';
import { biteshipClient } from '@/lib/shipping/biteship-client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get('input') || searchParams.get('query') || '';

  const sanitizedInput = input.trim();
  if (sanitizedInput.length < 3) {
    return Response.json(
      {
        success: true,
        areas: [],
        message: 'Masukkan minimal 3 karakter untuk mencari area kecamatan/kota.',
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  const result = await biteshipClient.searchAreas(sanitizedInput);

  if (!result.success) {
    return Response.json(
      {
        success: false,
        areas: [],
        error: result.error || 'Gagal mencari area.',
      },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  return Response.json(
    {
      success: true,
      areas: result.areas,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
