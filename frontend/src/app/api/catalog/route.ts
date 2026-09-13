import { parsePublicCatalogResponse } from '../../../lib/catalog.ts';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const erpBaseUrl = process.env.ERP_INTERNAL_URL;
  const erpServiceToken = process.env.ERP_SERVICE_TOKEN;

  // Security-critical configuration must fail closed.
  // There is deliberately no development fallback credential and no simulated catalog.
  if (!erpBaseUrl || !erpServiceToken) {
    console.error('Catalog BFF is unavailable because ERP internal configuration is incomplete.');
    return Response.json(
      { error: 'Catalog service is temporarily unavailable' },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  const requestId = crypto.randomUUID();

  try {
    const upstreamUrl = `${erpBaseUrl.replace(/\/$/, '')}/api/internal/catalog/products`;
    const backendResponse = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${erpServiceToken}`,
        'X-Request-Id': requestId,
      },
      cache: 'no-store',
    });

    if (!backendResponse.ok) {
      console.error('ERP catalog request failed.', {
        requestId,
        status: backendResponse.status,
      });

      return Response.json(
        {
          error: 'Unable to retrieve catalog',
          request_id: requestId,
        },
        {
          status: 502,
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      );
    }

    const responseBody: unknown = await backendResponse.json();
    const publicCatalog = parsePublicCatalogResponse(responseBody);

    if (!publicCatalog) {
      console.error('ERP catalog response failed public contract validation.', {
        requestId,
      });

      return Response.json(
        {
          error: 'Unable to process catalog response',
          request_id: requestId,
        },
        {
          status: 502,
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      );
    }

    return Response.json(publicCatalog, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('ERP catalog transport failure.', {
      requestId,
      error: error instanceof Error ? error.message : 'unknown error',
    });

    return Response.json(
      {
        error: 'Catalog service is temporarily unavailable',
        request_id: requestId,
      },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}
