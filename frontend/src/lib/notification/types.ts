/**
 * Phase 1.7C.18 — WhatsApp Notification Foundation
 * Type definitions for notification layer, events, and provider abstractions.
 */

/**
 * Supported Order Lifecycle Notification Event Types (Task 2).
 */
export type NotificationEventType =
  | 'ORDER_CREATED'
  | 'PAYMENT_CONFIRMED'
  | 'ORDER_PROCESSING'
  | 'ORDER_READY_TO_SHIP'
  | 'ORDER_DELIVERED';

export const NOTIFICATION_EVENT_TYPES: readonly NotificationEventType[] = [
  'ORDER_CREATED',
  'PAYMENT_CONFIRMED',
  'ORDER_PROCESSING',
  'ORDER_READY_TO_SHIP',
  'ORDER_DELIVERED',
] as const;

/**
 * Item summary passed into notification generators (Task 3).
 */
export interface NotificationItem {
  product_name: string;
  variant: string;
  quantity: number;
  price?: number;
}

/**
 * Input context passed to WhatsApp message generators (Task 3).
 */
export interface NotificationContext {
  event: NotificationEventType;
  order_number: string;
  customer_name: string;
  recipient_phone: string;
  items: NotificationItem[];
  total: number;
  status: string;
  delivery_method?: string;
  tracking_number?: string;
  notes?: string;
}

/**
 * Result returned from a WhatsApp notification provider (Task 4 & 5).
 */
export interface NotificationSendResult {
  success: boolean;
  provider: string;
  recipient_phone: string;
  message: string;
  url?: string; // For manual provider: https://wa.me/{phone}?text={encoded_message}
  wa_link?: string; // Canonical alias for generated URL
  external_id?: string;
  status?: 'GENERATED' | 'SENT' | 'FAILED';
  error?: string;
  timestamp: string;
}

/**
 * Notification record persisted on order for audit & admin display (Task 7).
 */
export interface OrderNotificationRecord {
  id: string;
  order_id: string;
  order_number: string;
  event: NotificationEventType;
  recipient_phone: string;
  message: string;
  wa_link: string;
  provider: string; // e.g. 'manual_whatsapp', 'business_api'
  status: 'GENERATED' | 'SENT' | 'FAILED';
  created_at: string;
}

/**
 * Future WhatsApp Provider Interface (Task 5).
 * Enables plugging in WhatsApp Business API, Twilio, WATI, Qontak without architectural rewrite.
 */
export interface WhatsAppProvider {
  readonly providerName: string;
  sendMessage(
    recipient: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<NotificationSendResult>;
  validateNumber(phone: string): { valid: boolean; normalizedPhone: string };
}
