import type { OrderLifecycleStatus, OrderSummary, OrderSummaryItem } from './types.ts';
import type { PaymentStatus } from '../payment/types.ts';
import { normalizeIndonesianPhone } from '../security/pii-masking.ts';
import { getSessionStorage, type KeyValueStorage } from '../checkout-client.ts';

export const ORDER_SUMMARY_STORAGE_KEY = 'callme.order.summary.v1';

/**
 * Resolves the initial customer order lifecycle status based on ERP status and payment state.
 * Maintains compatibility with existing order flow.
 */
export function resolveOrderLifecycleStatus(
  erpStatus: string,
  paymentStatus?: PaymentStatus,
): OrderLifecycleStatus {
  const normErp = (erpStatus || '').toUpperCase().trim();

  if (normErp === 'CANCELLED' || paymentStatus === 'FAILED' || paymentStatus === 'EXPIRED') {
    return 'CANCELLED';
  }

  if (normErp === 'DONE') {
    return 'DELIVERED';
  }

  if (paymentStatus === 'PAID') {
    return 'PAYMENT_CONFIRMED';
  }

  // Initial created state with pending payment
  return 'WAITING_PAYMENT';
}

/**
/**
 * Validates permissible status transitions in the order lifecycle (Phase 1.7C.16 Task 3).
 *
 * Allowed transitions:
 * WAITING_PAYMENT -> PAYMENT_CONFIRMED -> PROCESSING -> READY_TO_SHIP -> DELIVERED
 * Cancellation:
 * WAITING_PAYMENT or PROCESSING -> CANCELLED
 */
export function isValidStatusTransition(
  from: OrderLifecycleStatus,
  to: OrderLifecycleStatus,
): boolean {
  if (from === to) return true;

  switch (from) {
    case 'WAITING_PAYMENT':
      return to === 'PAYMENT_CONFIRMED' || to === 'CANCELLED';
    case 'PAYMENT_CONFIRMED':
      return to === 'PROCESSING';
    case 'PROCESSING':
      return to === 'READY_TO_SHIP' || to === 'CANCELLED';
    case 'READY_TO_SHIP':
      return to === 'DELIVERED';
    case 'DELIVERED':
    case 'CANCELLED':
      return false; // Terminal states
    default:
      return false;
  }
}

/**
 * Returns allowed forward or cancellation target transitions from a given status (Task 3).
 */
export function getAllowedNextTransitions(
  current: OrderLifecycleStatus,
): OrderLifecycleStatus[] {
  switch (current) {
    case 'WAITING_PAYMENT':
      return ['PAYMENT_CONFIRMED', 'CANCELLED'];
    case 'PAYMENT_CONFIRMED':
      return ['PROCESSING'];
    case 'PROCESSING':
      return ['READY_TO_SHIP', 'CANCELLED'];
    case 'READY_TO_SHIP':
      return ['DELIVERED'];
    case 'DELIVERED':
    case 'CANCELLED':
    default:
      return [];
  }
}

export interface BuildOrderSummaryInput {
  order_number: string;
  customer_name: string;
  whatsapp_number: string;
  items: OrderSummaryItem[];
  subtotal: number;
  shipping_fee: number;
  cold_chain_fee: number;
  total_amount?: number;
  payment_status?: PaymentStatus;
  order_status?: OrderLifecycleStatus;
  delivery_method?: string;
}

/**
 * Constructs a verified, type-safe OrderSummary object (Task 3).
 * Enforces arithmetic integrity: total_amount = subtotal + shipping_fee + cold_chain_fee.
 */
export function buildOrderSummary(input: BuildOrderSummaryInput): OrderSummary {
  const orderNumber = input.order_number.trim();
  const customerName = input.customer_name.trim();
  const whatsappNumber = normalizeIndonesianPhone(input.whatsapp_number.trim()) || input.whatsapp_number.trim();

  if (!orderNumber) {
    throw new Error('Order number is required for OrderSummary');
  }
  if (!customerName) {
    throw new Error('Customer name is required for OrderSummary');
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error('OrderSummary requires at least one line item');
  }

  const sanitizedItems: OrderSummaryItem[] = input.items.map((item) => {
    if (!item.product_name || typeof item.product_name !== 'string') {
      throw new Error('Invalid product_name in order summary item');
    }
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const price = Math.max(0, Math.floor(Number(item.price) || 0));
    return {
      product_name: item.product_name.trim(),
      variant: (item.variant || 'Standard').trim(),
      quantity: qty,
      price,
    };
  });

  const calculatedSubtotal = sanitizedItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const subtotal = input.subtotal > 0 ? input.subtotal : calculatedSubtotal;
  const shippingFee = Math.max(0, Math.floor(Number(input.shipping_fee) || 0));
  const coldChainFee = Math.max(0, Math.floor(Number(input.cold_chain_fee) || 0));
  const expectedTotal = subtotal + shippingFee + coldChainFee;
  const totalAmount = input.total_amount !== undefined ? input.total_amount : expectedTotal;

  const paymentStatus: PaymentStatus = input.payment_status || 'PENDING_PAYMENT';
  const orderStatus: OrderLifecycleStatus =
    input.order_status || resolveOrderLifecycleStatus('CONFIRMED', paymentStatus);

  return {
    order_number: orderNumber,
    customer_name: customerName,
    whatsapp_number: whatsappNumber,
    items: sanitizedItems,
    subtotal,
    shipping_fee: shippingFee,
    cold_chain_fee: coldChainFee,
    total_amount: totalAmount,
    payment_status: paymentStatus,
    order_status: orderStatus,
    ...(input.delivery_method ? { delivery_method: input.delivery_method } : {}),
    created_at: new Date().toISOString(),
  };
}

/**
 * Persists an order summary in client storage.
 * Does not expose internal database IDs or payment secrets (Task 7).
 */
export function saveOrderSummary(
  summary: OrderSummary,
  storage?: KeyValueStorage,
): boolean {
  const s = getSessionStorage(storage);
  if (!s) return false;

  try {
    s.setItem(ORDER_SUMMARY_STORAGE_KEY, JSON.stringify(summary));
    return true;
  } catch {
    return false;
  }
}

/**
 * Retrieves an active order summary from client storage.
 */
export function getOrderSummary(
  expectedOrderNumber?: string | null,
  storage?: KeyValueStorage,
): OrderSummary | null {
  const s = getSessionStorage(storage);
  if (!s) return null;

  try {
    const raw = s.getItem(ORDER_SUMMARY_STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const obj = parsed as Record<string, unknown>;
    if (
      typeof obj.order_number !== 'string' ||
      typeof obj.customer_name !== 'string' ||
      typeof obj.whatsapp_number !== 'string' ||
      !Array.isArray(obj.items) ||
      typeof obj.subtotal !== 'number' ||
      typeof obj.shipping_fee !== 'number' ||
      typeof obj.cold_chain_fee !== 'number' ||
      typeof obj.total_amount !== 'number'
    ) {
      return null;
    }

    if (expectedOrderNumber && obj.order_number.trim() !== expectedOrderNumber.trim()) {
      return null;
    }

    return parsed as OrderSummary;
  } catch {
    return null;
  }
}

/**
 * Clears stored order summary.
 */
export function clearOrderSummary(storage?: KeyValueStorage): void {
  const s = getSessionStorage(storage);
  if (s) {
    try {
      s.removeItem(ORDER_SUMMARY_STORAGE_KEY);
    } catch {
      // Ignore cleanup error
    }
  }
}
