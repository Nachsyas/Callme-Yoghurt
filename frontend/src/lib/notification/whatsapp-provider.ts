/**
 * Phase 1.7C.18 — WhatsApp Providers (Task 4 & Task 5)
 * Manual WhatsApp URL provider and future API provider abstractions.
 */

import type { NotificationContext, NotificationSendResult, WhatsAppProvider } from './types.ts';
import { generateWhatsAppMessage } from './templates.ts';
import { normalizeIndonesianPhone } from '../security/pii-masking.ts';

/**
 * Validates Indonesian phone numbers for WhatsApp compatibility.
 */
export function validateWhatsAppNumber(phone: string): {
  valid: boolean;
  normalizedPhone: string;
} {
  const safePhone = typeof phone === 'string' ? phone : '';
  const normalized = normalizeIndonesianPhone(safePhone);
  // Indonesian mobile numbers are typically 628xxxxxxxxxx (10 to 15 digits)
  const isValid = normalized.startsWith('628') && normalized.length >= 10 && normalized.length <= 15;
  return {
    valid: isValid,
    normalizedPhone: normalized,
  };
}

/**
 * Task 4: Manual WhatsApp Provider.
 * Generates an actionable `https://wa.me/{phone}?text={encoded_message}` link.
 * Does NOT send messages automatically.
 */
export class ManualWhatsAppProvider implements WhatsAppProvider {
  public readonly providerName = 'manual_whatsapp';

  public validateNumber(phone: string): { valid: boolean; normalizedPhone: string } {
    return validateWhatsAppNumber(phone);
  }

  public async sendMessage(
    recipientOrContext: string | NotificationContext,
    messageInput?: string,
    metadata?: Record<string, unknown>
  ): Promise<NotificationSendResult> {
    let recipient: string;
    let message: string;
    let meta = metadata;

    if (typeof recipientOrContext === 'object' && recipientOrContext !== null) {
      recipient = recipientOrContext.recipient_phone;
      message = messageInput || generateWhatsAppMessage(recipientOrContext);
      meta = {
        order_number: recipientOrContext.order_number,
        event: recipientOrContext.event,
        ...metadata,
      };
    } else {
      recipient = recipientOrContext;
      message = messageInput || '';
    }

    const { valid, normalizedPhone } = this.validateNumber(recipient);

    if (!valid && !normalizedPhone) {
      return {
        success: false,
        provider: this.providerName,
        recipient_phone: recipient,
        message,
        status: 'FAILED',
        error: 'Nomor WhatsApp tidak valid. Format harus nomor seluler Indonesia yang valid (08... / 628...).',
        timestamp: new Date().toISOString(),
      };
    }

    const cleanNumber = normalizedPhone || normalizeIndonesianPhone(recipient);
    const encodedMessage = encodeURIComponent(message);
    const url = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;

    return {
      success: true,
      provider: this.providerName,
      recipient_phone: cleanNumber,
      message,
      url,
      wa_link: url,
      status: 'GENERATED',
      timestamp: new Date().toISOString(),
      ...(meta?.order_number ? { external_id: `wa-manual-${meta.order_number}` } : {}),
    };
  }
}

/**
 * Helper to normalize send arguments across provider stubs.
 */
function extractRecipientAndMessage(
  recipientOrContext: string | NotificationContext,
  messageInput?: string
): { recipient: string; message: string } {
  if (typeof recipientOrContext === 'object' && recipientOrContext !== null) {
    return {
      recipient: recipientOrContext.recipient_phone,
      message: messageInput || generateWhatsAppMessage(recipientOrContext),
    };
  }
  return {
    recipient: recipientOrContext,
    message: messageInput || '',
  };
}

/**
 * Task 5: Placeholder for official WhatsApp Business Cloud API.
 */
export class WhatsAppBusinessApiProvider implements WhatsAppProvider {
  public readonly providerName = 'whatsapp_business_api';

  public validateNumber(phone: string): { valid: boolean; normalizedPhone: string } {
    return validateWhatsAppNumber(phone);
  }

  public async sendMessage(
    recipientOrContext: string | NotificationContext,
    messageInput?: string,
    metadata?: Record<string, unknown>
  ): Promise<NotificationSendResult> {
    const { recipient, message } = extractRecipientAndMessage(recipientOrContext, messageInput);
    const { valid, normalizedPhone } = this.validateNumber(recipient);
    if (!valid) {
      return {
        success: false,
        provider: this.providerName,
        recipient_phone: recipient,
        message,
        status: 'FAILED',
        error: 'Nomor penerima tidak valid untuk WhatsApp Business API.',
        timestamp: new Date().toISOString(),
      };
    }

    // Foundation stub: ready for Meta Cloud API integration
    return {
      success: false,
      provider: this.providerName,
      recipient_phone: normalizedPhone,
      message,
      status: 'GENERATED',
      error: 'WhatsApp Business API belum dikonfigurasi pada tahap foundation ini.',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Task 5: Placeholder for Twilio WhatsApp provider.
 */
export class TwilioWhatsAppProvider implements WhatsAppProvider {
  public readonly providerName = 'twilio_whatsapp';

  public validateNumber(phone: string): { valid: boolean; normalizedPhone: string } {
    return validateWhatsAppNumber(phone);
  }

  public async sendMessage(
    recipientOrContext: string | NotificationContext,
    messageInput?: string
  ): Promise<NotificationSendResult> {
    const { recipient, message } = extractRecipientAndMessage(recipientOrContext, messageInput);
    const { normalizedPhone } = this.validateNumber(recipient);
    return {
      success: false,
      provider: this.providerName,
      recipient_phone: normalizedPhone,
      message,
      status: 'GENERATED',
      error: 'Twilio provider placeholder — belum diaktifkan.',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Task 5: Placeholder for WATI (WhatsApp Team Inbox) provider.
 */
export class WatiWhatsAppProvider implements WhatsAppProvider {
  public readonly providerName = 'wati_whatsapp';

  public validateNumber(phone: string): { valid: boolean; normalizedPhone: string } {
    return validateWhatsAppNumber(phone);
  }

  public async sendMessage(
    recipientOrContext: string | NotificationContext,
    messageInput?: string
  ): Promise<NotificationSendResult> {
    const { recipient, message } = extractRecipientAndMessage(recipientOrContext, messageInput);
    const { normalizedPhone } = this.validateNumber(recipient);
    return {
      success: false,
      provider: this.providerName,
      recipient_phone: normalizedPhone,
      message,
      status: 'GENERATED',
      error: 'WATI provider placeholder — belum diaktifkan.',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Task 5: Placeholder for Qontak (Mekari) provider.
 */
export class QontakWhatsAppProvider implements WhatsAppProvider {
  public readonly providerName = 'qontak_whatsapp';

  public validateNumber(phone: string): { valid: boolean; normalizedPhone: string } {
    return validateWhatsAppNumber(phone);
  }

  public async sendMessage(
    recipientOrContext: string | NotificationContext,
    messageInput?: string
  ): Promise<NotificationSendResult> {
    const { recipient, message } = extractRecipientAndMessage(recipientOrContext, messageInput);
    const { normalizedPhone } = this.validateNumber(recipient);
    return {
      success: false,
      provider: this.providerName,
      recipient_phone: normalizedPhone,
      message,
      status: 'GENERATED',
      error: 'Qontak provider placeholder — belum diaktifkan.',
      timestamp: new Date().toISOString(),
    };
  }
}
