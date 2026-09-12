import { getRateLimiter, getClientIdentifier } from '../../../lib/security/rate-limit.ts';

type DeliveryMethod = 'instant' | 'sameday' | 'nextday';

type CheckoutRequest = {
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
};

export interface PublicOrderData {
  order_id: string;
  order_number: string;
  status: string;
  total_amount?: number;
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

function parseCheckoutRequest(value: unknown): CheckoutRequest | null {
  if (!isRecord(value) || !isRecord(value.customer) || !Array.isArray(value.items)) {
    return null;
  }

  const { customer, items, delivery_method: deliveryMethod } = value;

  if (
    !isNonEmptyString(customer.name) ||
    !isNonEmptyString(customer.whatsapp) ||
    !isNonEmptyString(customer.address) ||
    !isDeliveryMethod(deliveryMethod) ||
    items.length === 0
  ) {
    return null;
  }

  const parsedItems: CheckoutRequest['items'] = [];

  for (const item of items) {
    if (
      !isRecord(item) ||
      !isNonEmptyString(item.variant_id) ||
      typeof item.quantity !== 'number' ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0
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
 * Never blindly forwards arbitrary upstream fields, internal credentials, database info, or debug traces.
 */
export function parsePublicOrderResponse(value: unknown, requestId: string): PublicOrderData | null {
  if (!isRecord(value)) {
    return null;
  }

  const rawOrderId = isNonEmptyString(value.order_id)
    ? value.order_id.trim()
    : isNonEmptyString(value.order_number)
      ? value.order_number.trim()
      : null;

  const rawOrderNumber = isNonEmptyString(value.order_number)
    ? value.order_number.trim()
    : isNonEmptyString(value.order_id)
      ? value.order_id.trim()
      : null;

  const rawStatus = isNonEmptyString(value.status) ? value.status.trim() : null;

  if (!rawOrderId || !rawOrderNumber || !rawStatus) {
    return null;
  }

  const sanitized: PublicOrderData = {
    order_id: rawOrderId,
    order_number: rawOrderNumber,
    status: rawStatus,
    request_id: requestId,
  };

  if (
    typeof value.total_amount === 'number' &&
    Number.isFinite(value.total_amount) &&
    value.total_amount >= 0
  ) {
    sanitized.total_amount = value.total_amount;
  }

  return sanitized;
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

  // Security-critical configuration must fail closed. There is deliberately
  // no development fallback credential and no simulated success response.
  if (!erpBaseUrl || !erpServiceToken) {
    console.error('Checkout BFF is unavailable because ERP internal configuration is incomplete.');
    return Response.json(
      { error: 'Checkout service is temporarily unavailable' },
      { status: 503, headers: rateLimitHeaders },
    );
  }

  const requestId = crypto.randomUUID();
  const idempotencyKey = request.headers.get('idempotency-key');

  try {
    const backendResponse = await fetch(`${erpBaseUrl.replace(/\/$/, '')}/api/internal/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${erpServiceToken}`,
        'X-Request-Id': requestId,
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    if (!backendResponse.ok) {
      console.error('ERP checkout request failed.', {
        requestId,
        status: backendResponse.status,
      });

      return Response.json(
        {
          error: 'Unable to process checkout',
          request_id: requestId,
        },
        {
          status: backendResponse.status >= 400 && backendResponse.status < 500 ? backendResponse.status : 502,
          headers: rateLimitHeaders,
        },
      );
    }

    const responseBody: unknown = await backendResponse.json();
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
      { status: 200, headers: rateLimitHeaders },
    );
  } catch (error) {
    console.error('ERP checkout transport failure.', {
      requestId,
      error: error instanceof Error ? error.message : 'unknown error',
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
