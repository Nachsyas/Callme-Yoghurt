import type { OrderSummary, WhatsAppReceiptOptions, WhatsAppReceiptResult } from './types.ts';
import { normalizeIndonesianPhone } from '../security/pii-masking.ts';

const DEFAULT_ADMIN_WHATSAPP = '628123456789';

function formatRupiah(amount: number): string {
  return `Rp${amount.toLocaleString('id-ID')}`;
}

/**
 * Generates a clean digital receipt in text format (Phase 1.7C.15 Task 4).
 *
 * Example structure:
 * CALLME YOGHURT
 *
 * Order:
 * CMY-20260926-0001
 *
 * Customer:
 * Budi Santoso
 *
 * Plain Pure Original
 * 500ml x2
 *
 * Subtotal:
 * Rp60.000
 *
 * Shipping:
 * Rp20.000
 *
 * Cold Chain:
 * Rp5.000
 *
 * TOTAL:
 * Rp85.000
 */
export function generateDigitalReceipt(summary: OrderSummary): string {
  const itemsText = summary.items
    .map((item) => `${item.product_name}\n${item.variant} x${item.quantity}`)
    .join('\n\n');

  return [
    'CALLME YOGHURT',
    '',
    'Order:',
    summary.order_number,
    '',
    'Customer:',
    summary.customer_name,
    '',
    itemsText,
    '',
    'Subtotal:',
    formatRupiah(summary.subtotal),
    '',
    'Shipping:',
    formatRupiah(summary.shipping_fee),
    '',
    'Cold Chain:',
    formatRupiah(summary.cold_chain_fee),
    '',
    'TOTAL:',
    formatRupiah(summary.total_amount),
    '',
    'Status:',
    `${summary.order_status} (Payment: ${summary.payment_status})`,
  ].join('\n');
}

/**
 * Generates a WhatsApp receipt URL and message payload (Phase 1.7C.15 Task 5).
 *
 * Output: https://wa.me/{number}?text={encoded_message}
 *
 * Does not send messages automatically.
 */
export function generateWhatsAppReceipt(options: WhatsAppReceiptOptions): WhatsAppReceiptResult {
  const summary = options.orderSummary;
  const rawTargetPhone = options.phoneNumber || DEFAULT_ADMIN_WHATSAPP;
  const cleanPhone = normalizeIndonesianPhone(rawTargetPhone) || DEFAULT_ADMIN_WHATSAPP;

  const itemsList = summary.items
    .map((i) => `• ${i.product_name} (${i.variant}) x${i.quantity} — ${formatRupiah(i.price * i.quantity)}`)
    .join('\n');

  const greeting =
    options.customGreeting ||
    `Halo Admin Callme Yoghurt, saya ingin konfirmasi pesanan dengan nomor *${summary.order_number}*.`;

  const messageLines = [
    '*CALLME YOGHURT — STRUK PESANAN RESMI*',
    '',
    `*No. Pesanan:* ${summary.order_number}`,
    `*Customer:* ${summary.customer_name}`,
    `*WhatsApp:* ${summary.whatsapp_number}`,
    '',
    '*Rincian Item:*',
    itemsList,
    '',
    '*Rincian Biaya:*',
    `- Subtotal Produk: ${formatRupiah(summary.subtotal)}`,
    `- Biaya Pengiriman: ${formatRupiah(summary.shipping_fee)}`,
    `- Cold Chain Packaging: ${formatRupiah(summary.cold_chain_fee)}`,
    `*TOTAL PEMBAYARAN: ${formatRupiah(summary.total_amount)}*`,
    '',
    `*Status Pembayaran:* ${summary.payment_status}`,
    `*Status Pesanan:* ${summary.order_status}`,
    '',
    '❄️ *Jaminan Cold Chain Logistics (0–5°C):*',
    'Segera simpan di dalam kulkas setelah pesanan tiba.',
    '',
    greeting,
  ];

  const rawMessage = messageLines.join('\n');
  const encodedMessage = encodeURIComponent(rawMessage);
  const url = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

  return {
    phoneNumber: cleanPhone,
    rawMessage,
    encodedMessage,
    url,
  };
}
