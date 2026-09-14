import { getRateLimiter, getClientIdentifier } from '../../../lib/security/rate-limit.ts';
import { isUuid } from '../../../lib/catalog.ts';

type DeliveryMethod = 'instant' | 'sameday' | 'nextday';

interface CheckoutRequest {
  customer: {
    name: string;
    whatsapp: string;
    address: string;
  };
  items: Array<{
    variant_id: string;
    quantity: number;
  }>;
  delivery_method: DeliveryMethod;
}

interface PublicOrderData {
  order_id: string;
  order_number: string;
  status: 'CONFIRMED';
  total_amount: number;
  request_id: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDeliveryMethod(value: unknown): value is DeliveryMethod {
  return value === 'instant' || value === 'sameday' || value === 'nextday';
}

/**
 * Validates edge checkout request with strict bounds mirroring ERP authority.
 *
 * Invariants (Gate 0E.2B):
 * - customer.name: 1..255 chars
 * - customer.whatsapp: 1..50 chars
 * - customer.address: 1..1000 chars
 * - items: 1..50 items
 * - variant_id: valid UUID string
 * - quantity: integer 1..100
 * - delivery_method: instant | sameday | nextday
 */
function parseCheckoutRequest(value: unknown): CheckoutRequest | null {
  if (!isRecord(value) || !isRecord(value.customer) || !Array.isArray(value.items)) {
    return null;
  }

  const { customer, items, delivery_method: deliveryMethod } = value;

  if (
    !isNonEmptyString(customer.name) ||
    customer.name.trim().length > 255 ||
    !isNonEmptyString(customer.whatsapp) ||
    customer.whatsapp.trim().length > 50 ||
    !isNonEmptyString(customer.address) ||
    customer.address.trim().length > 1000 ||
    !isDeliveryMethod(deliveryMethod) ||
    items.length < 1 ||
    items.length > 50
  ) {
    return null;
  }

  const parsedItems: CheckoutRequest['items'] = [];

  for (const item of items) {
    if (
      !isRecord(item) ||
      !isUuid(item.variant_id) ||
      typeof item.quantity !== 'number' ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 100
    ) {
      return null;
    }

    parsedItems.push({
      variant_id: item.variant_id.trim(),
      quantity: item.quantity,
    });
  }

  return {
    customer: {
      name: customer.name.trim(),
      whatsapp: customer.whatsapp.trim(),
      address: customer.address.trim(),
    },
    items: parsedItems,
    delivery_method: deliveryMethod,
  };
}

/**
 * Validates and transforms upstream ERP order response into an explicit, sanitized public DTO.
 *
 * Invariants (Gate 0E.2B):
 * - Requires explicit, independent order_id (UUID), order_number, status === 'CONFIRMED', and non-negative total_amount.
 * - Zero fallback fabrication between order_id and order_number.
 * - Never forwards arbitrary upstream fields, internal credentials, database info, or debug traces.
 */
function parsePublicOrderResponse(value: unknown, requestId: string): PublicOrderData | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isUuid(value.order_id) ||
    typeof value.order_number !== 'string' ||
    value.order_number.trim().length === 0 ||
    value.status !== 'CONFIRMED' ||
    typeof value.total_amount !== 'number' ||
    !Number.isInteger(value.total_amount) ||
    value.total_amount < 0
  ) {
    return null;
  }

  return {
    order_id: value.order_id.trim(),
    order_number: value.order_number.trim(),
    status: 'CONFIRMED',
    total_amount: value.total_amount,
    request_id: requestId,
  };
}

export async function POST(request: Request): Promise<Response> {
  // Rate limiting check at the BFF edge boundary
  const rateLimiter = getRateLimiter();
  const clientId = getClientIdentifier(request);
  // Default checkout write limit: 5 requests per 60-second window
  const rateLimitResult = await rateLimiter.check(`checkout:${clientId}`, 5, 60);

  const rateLimitHeaders = {
    'X-RateLimit-Limit': String(rateLimitResult.limit),
    'X-RateLimit-Remaining': String(rateLimitResult.remaining),
    'X-RateLimit-Reset': String(rateLimitResult.resetAt),
  };

  if (!rateLimitResult.success) {
    return Response.json(
      {
        error: 'Too many checkout requests. Please try again later.',
        retry_after: rateLimitResult.retryAfter,
      },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders,
          'Retry-After': String(rateLimitResult.retryAfter),
        },
      },
    );
  }

  // Idempotency-Key is mandatory at the edge
  const rawIdempotencyKey = request.headers.get('idempotency-key');
  if (
    !rawIdempotencyKey ||
    rawIdempotencyKey.trim().length === 0 ||
    rawIdempotencyKey.trim().length > 200
  ) {
    return Response.json(
      { error: 'Missing or invalid Idempotency-Key header' },
      { status: 400, headers: rateLimitHeaders },
    );
  }
  const idempotencyKey = rawIdempotencyKey.trim();

  let rawPayload: unknown;
  try {
    rawPayload = await request.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON payload' },
      { status: 400, headers: rateLimitHeaders },
    );
  }

  const payload = parseCheckoutRequest(rawPayload);
  if (!payload) {
    return Response.json(
      { error: 'Invalid checkout payload' },
      { status: 400, headers: rateLimitHeaders },
    );
  }

  const erpBaseUrl = process.env.ERP_INTERNAL_URL;
  const erpServiceToken = process.env.ERP_SERVICE_TOKEN;

  // Security-critical configuration must fail closed.
  if (!erpBaseUrl || !erpServiceToken) {
    console.error('Checkout BFF is unavailable because ERP internal configuration is incomplete.');
    return Response.json(
      { error: 'Checkout service is temporarily unavailable' },
      { status: 503, headers: rateLimitHeaders },
    );
  }

  const requestId = crypto.randomUUID();

  try {
    const backendResponse = await fetch(`${erpBaseUrl.replace(/\/$/, '')}/api/internal/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${erpServiceToken}`,
        'X-Request-Id': requestId,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    if (backendResponse.status !== 200 && backendResponse.status !== 201) {
      console.error('ERP checkout request failed.', {
        requestId,
        status: backendResponse.status,
      });

      let mappedStatus = 502;
      let mappedError = 'Unable to process checkout';

      if (backendResponse.status === 409) {
        mappedStatus = 409;
        mappedError = 'Checkout conflict or inventory unavailable';
      } else if (backendResponse.status === 422) {
        mappedStatus = 422;
        mappedError = 'Invalid checkout data';
      } else if (backendResponse.status === 503) {
        mappedStatus = 503;
        mappedError = 'Checkout service is temporarily unavailable';
      }

      return Response.json(
        {
          error: mappedError,
          request_id: requestId,
        },
        {
          status: mappedStatus,
          headers: rateLimitHeaders,
        },
      );
    }

    let responseBody: unknown;
    try {
      responseBody = await backendResponse.json();
    } catch {
      return Response.json(
        {
          error: 'Unable to process checkout response',
          request_id: requestId,
        },
        {
          status: 502,
          headers: rateLimitHeaders,
        },
      );
    }

    const publicOrderData = parsePublicOrderResponse(responseBody, requestId);
    if (!publicOrderData) {
      console.error('ERP checkout response failed public contract validation.', {
        requestId,
      });

      return Response.json(
        {
          error: 'Unable to process checkout response',
          request_id: requestId,
        },
        {
          status: 502,
          headers: rateLimitHeaders,
        },
      );
    }

    return Response.json(
      {
        success: true,
        request_id: requestId,
        data: publicOrderData,
      },
      {
        status: backendResponse.status,
        headers: rateLimitHeaders,
      },
    );
  } catch {
    console.error('ERP checkout transport failure.', {
      requestId,
      errorCategory: 'transport_failure',
    });

    return Response.json(
      {
        error: 'Checkout service is temporarily unavailable',
        request_id: requestId,
      },
      { status: 502, headers: rateLimitHeaders },
    );
  }
}
