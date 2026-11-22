/**
 * Phase 1.7C.18 — Notification Service (Task 1 & Task 6)
 * Orchestrates event template rendering, provider selection, and audit record generation.
 */

import type {
  NotificationContext,
  NotificationEventType,
  NotificationSendResult,
  OrderNotificationRecord,
  WhatsAppProvider,
} from './types.ts';
import { generateWhatsAppMessage } from './templates.ts';
import { ManualWhatsAppProvider } from './whatsapp-provider.ts';

export class NotificationService {
  private defaultProvider: WhatsAppProvider;
  private providers: Map<string, WhatsAppProvider> = new Map();

  constructor(defaultProvider?: WhatsAppProvider) {
    this.defaultProvider = defaultProvider || new ManualWhatsAppProvider();
    this.registerProvider(this.defaultProvider.providerName, this.defaultProvider);
  }

  public registerProvider(name: string, provider: WhatsAppProvider): void {
    this.providers.set(name, provider);
  }

  public getProvider(name?: string): WhatsAppProvider {
    if (name && this.providers.has(name)) {
      return this.providers.get(name)!;
    }
    return this.defaultProvider;
  }

  /**
   * Main Dispatcher: Order Event -> Notification Service -> WhatsApp Provider (Goal Architecture).
   */
  public async dispatchOrderNotification(
    context: NotificationContext,
    options?: {
      providerName?: string;
      orderId?: string;
    }
  ): Promise<{
    result: NotificationSendResult;
    record: OrderNotificationRecord;
  }> {
    const provider = this.getProvider(options?.providerName);
    const message = generateWhatsAppMessage(context);

    const result = await provider.sendMessage(context.recipient_phone, message, {
      order_number: context.order_number,
      event: context.event,
    });

    const now = new Date().toISOString();
    const record: OrderNotificationRecord = {
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      order_id: options?.orderId || context.order_number,
      order_number: context.order_number,
      event: context.event,
      recipient_phone: result.recipient_phone,
      message,
      wa_link: result.url || '',
      provider: provider.providerName,
      status: result.success ? 'GENERATED' : 'FAILED',
      created_at: now,
    };

    return { result, record };
  }

  /**
   * Synchronous helper for generating manual WhatsApp link and notification record immediately.
   */
  public createManualNotification(
    context: NotificationContext,
    orderId?: string
  ): OrderNotificationRecord {
    const message = generateWhatsAppMessage(context);
    const manualProvider = new ManualWhatsAppProvider();
    const { normalizedPhone } = manualProvider.validateNumber(context.recipient_phone);
    const cleanNumber = normalizedPhone || context.recipient_phone.replace(/\D+/g, '');
    const encoded = encodeURIComponent(message);
    const waLink = `https://wa.me/${cleanNumber}?text=${encoded}`;

    return {
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      order_id: orderId || context.order_number,
      order_number: context.order_number,
      event: context.event,
      recipient_phone: cleanNumber,
      message,
      wa_link: waLink,
      provider: manualProvider.providerName,
      status: 'GENERATED',
      created_at: new Date().toISOString(),
    };
  }
}

export const notificationService = new NotificationService();
