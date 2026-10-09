import type { PaymentStatus } from '../payment/types.ts';
import type { OrderNotificationRecord } from '../notification/types.ts';

/**
 * Customer order lifecycle statuses (Phase 1.7C.15 Task 1).
 * Maintained with strict backward compatibility with ERP OrderStatus.
 */
export type OrderLifecycleStatus =
  | 'WAITING_PAYMENT'
  | 'PAYMENT_CONFIRMED'
  | 'PROCESSING'
  | 'READY_TO_SHIP'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

export const ORDER_LIFECYCLE_STATUSES: readonly OrderLifecycleStatus[] = [
  'WAITING_PAYMENT',
  'PAYMENT_CONFIRMED',
  'PROCESSING',
  'READY_TO_SHIP',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
] as const;

/**
 * Item line within the reusable Order Summary structure (Task 3).
 */
export interface OrderSummaryItem {
  product_name: string;
  variant: string;
  quantity: number;
  price: number;
}

/**
 * Reusable Order Summary structure (Task 3).
 */
export interface OrderSummary {
  order_number: string;
  customer_name: string;
  whatsapp_number: string;
  items: OrderSummaryItem[];
  subtotal: number;
  shipping_fee: number;
  cold_chain_fee: number;
  total_amount: number;
  payment_status: PaymentStatus;
  order_status: OrderLifecycleStatus;
  delivery_method?: string;
  created_at?: string;
}

/**
 * Options for generating human-readable order numbers (Task 2).
 */
export interface OrderNumberOptions {
  prefix?: string;
  date?: Date;
  sequence?: number | string;
  randomLength?: number;
}

/**
 * Options for generating WhatsApp receipts (Task 5).
 */
export interface WhatsAppReceiptOptions {
  phoneNumber?: string;
  orderSummary: OrderSummary;
  customGreeting?: string;
}

/**
 * Result of generating WhatsApp receipt link (Task 5).
 */
export interface WhatsAppReceiptResult {
  phoneNumber: string;
  rawMessage: string;
  encodedMessage: string;
  url: string;
}

/**
 * Customer details within an Admin Order Record (Phase 1.7C.16 Task 1 & 2).
 */
export interface AdminOrderCustomer {
  name: string;
  whatsapp: string;
  address: string;
}

/**
 * Cost breakdown within an Admin Order Record (Phase 1.7C.16 Task 2).
 */
export interface AdminOrderCost {
  subtotal: number;
  shipping_fee: number;
  cold_chain_fee: number;
  total_amount: number;
}

/**
 * Payment details and verification placeholder within an Admin Order (Phase 1.7C.16 Task 2 & 4).
 */
export interface AdminOrderPayment {
  method: string;
  status: PaymentStatus;
  proof_status: 'waiting_verification' | 'verified' | 'rejected';
  proof_url?: string;
  verified_at?: string;
}

/**
 * Inventory Reservation Statuses (Phase 1.7C.17 Task 3).
 * AVAILABLE -> RESERVED -> FULFILLED. Cancellation: RESERVED -> RELEASED.
 */
export type InventoryReservationStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'FULFILLED'
  | 'RELEASED'
  | 'PENDING'
  | 'UNAVAILABLE';

/**
 * Fulfillment Audit Log Event Types (Phase 1.7C.17 Task 6).
 */
export type FulfillmentEventType =
  | 'ORDER_PAYMENT_CONFIRMED'
  | 'INVENTORY_RESERVED'
  | 'ORDER_PROCESSING'
  | 'ORDER_READY_TO_SHIP'
  | 'INVENTORY_RELEASED';

/**
 * Per-item inventory reservation details (Phase 1.7C.17 Task 1 & 5).
 */
export interface InventoryReservationItem {
  product_name: string;
  variant: string;
  quantity: number;
  available_stock: number;
  reserved_quantity: number;
  status: InventoryReservationStatus;
}

/**
 * Inventory fulfillment status attached to an Order (Phase 1.7C.17 Task 5).
 */
export interface OrderInventoryDetail {
  reservation_id: string;
  status: InventoryReservationStatus;
  summary_status: 'READY' | 'RESERVED' | 'FULFILLED' | 'RELEASED' | 'PENDING' | 'UNAVAILABLE';
  items: InventoryReservationItem[];
  reserved_at?: string;
  fulfilled_at?: string;
  released_at?: string;
}

/**
 * Append-only audit log entry for order fulfillment events (Phase 1.7C.17 Task 6).
 */
export interface FulfillmentAuditLogEntry {
  id: string;
  order_id: string;
  order_number: string;
  event_type: FulfillmentEventType;
  description: string;
  timestamp: string;
  actor: string;
  metadata?: Record<string, unknown>;
}

/**
 * Authoritative Admin Order Record (Phase 1.7C.16 & Phase 1.7C.17).
 */
export interface AdminOrderRecord {
  id: string;
  order_number: string;
  order_date: string;
  customer: AdminOrderCustomer;
  items: OrderSummaryItem[];
  cost: AdminOrderCost;
  payment: AdminOrderPayment;
  order_status: OrderLifecycleStatus;
  delivery_method: string;
  inventory: OrderInventoryDetail;
  audit_logs: FulfillmentAuditLogEntry[];
  notifications: OrderNotificationRecord[];
  created_at: string;
  updated_at: string;
}

/**
 * Dashboard summary KPI metrics (Phase 1.7C.16 Task 6).
 */
export interface OrderDashboardMetrics {
  today_orders: number;
  waiting_payment: number;
  processing: number;
  ready_to_ship: number;
  completed_orders: number;
  cancelled_orders: number;
  total_revenue: number;
  gross_order_value?: number;
  pending_payments_value?: number;
  settled_revenue?: number;
  recognized_revenue?: number;
}
