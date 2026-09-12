import { NextResponse } from 'next/server';

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

export async function POST(request: Request) {
  let rawPayload: unknown;

  try {
    rawPayload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const payload = parseCheckoutRequest(rawPayload);

  if (!payload) {
    return NextResponse.json({ error: 'Invalid checkout payload' }, { status: 400 });
  }

  const erpBaseUrl = process.env.ERP_INTERNAL_URL;
  const erpServiceToken = process.env.ERP_SERVICE_TOKEN;

  // Security-critical configuration must fail closed. There is deliberately
  // no development fallback credential and no simulated success response.
  if (!erpBaseUrl || !erpServiceToken) {
    console.error('Checkout BFF is unavailable because ERP internal configuration is incomplete.');
    return NextResponse.json(
      { error: 'Checkout service is temporarily unavailable' },
      { status: 503 },
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

      return NextResponse.json(
        {
          error: 'Unable to process checkout',
          request_id: requestId,
        },
        { status: backendResponse.status >= 400 && backendResponse.status < 500 ? backendResponse.status : 502 },
      );
    }

    const responseBody: unknown = await backendResponse.json();

    return NextResponse.json(
      {
        success: true,
        request_id: requestId,
        data: responseBody,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('ERP checkout transport failure.', {
      requestId,
      error: error instanceof Error ? error.message : 'unknown error',
    });

    return NextResponse.json(
      {
        error: 'Checkout service is temporarily unavailable',
        request_id: requestId,
      },
      { status: 502 },
    );
  }
}
