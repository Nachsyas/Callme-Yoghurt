/**
 * Phase 1.7C.18 — WhatsApp Message Templates (Task 3)
 * Reusable, branded notification template generators for Callme Yoghurt order events.
 */

import type { NotificationContext, NotificationEventType } from './types.ts';

function formatRupiah(amount: number): string {
  return `Rp${amount.toLocaleString('id-ID')}`;
}

function formatItemList(items: NotificationContext['items']): string {
  return items
    .map((item) => `• ${item.product_name} (${item.variant}) x${item.quantity}`)
    .join('\n');
}

/**
 * Generates formatted WhatsApp text message based on order event lifecycle.
 */
export function generateWhatsAppMessage(context: NotificationContext): string {
  const { event, order_number, customer_name, items, total, status } = context;
  const itemsText = formatItemList(items);
  const formattedTotal = formatRupiah(total);

  switch (event) {
    case 'ORDER_CREATED':
      return [
        `*CALLME YOGHURT — PESANAN DITERIMA* 🥛`,
        ``,
        `Halo Kak *${customer_name}*, terima kasih telah berbelanja di Callme Yoghurt! Pesanan Anda telah berhasil dibuat.`,
        ``,
        `📋 *Nomor Pesanan:* ${order_number}`,
        `📦 *Status:* ${status}`,
        ``,
        `*Daftar Produk:*`,
        itemsText,
        ``,
        `*Total Pembayaran:* ${formattedTotal}`,
        ``,
        `Silakan selesaikan pembayaran dan kirimkan bukti bayar agar pesanan dapat segera diproses.`,
        ``,
        `❄️ _Penanganan pengiriman mengikuti SOP Cold Chain produk dairy Callme Yoghurt. Hanya tahan 3 hari di suhu ruang. Langsung segera masukan kulkas begitu barang diterima (Suhu < 5°C)._`,
      ].join('\n');

    case 'PAYMENT_CONFIRMED':
      return [
        `*CALLME YOGHURT — PEMBAYARAN TERKONFIRMASI* ✅`,
        ``,
        `Halo Kak *${customer_name}*, pembayaran untuk pesanan *${order_number}* sebesar *${formattedTotal}* telah kami terima dan *TERVERIFIKASI*.`,
        ``,
        `🔒 *Status Inventaris:* Stok produk berhasil direservasi (FEFO Allocation).`,
        `📦 *Status Pesanan:* ${status}`,
        ``,
        `*Rincian Pesanan:*`,
        itemsText,
        ``,
        `Pesanan Anda segera dijadwalkan untuk proses pengemasan suhu dingin (Cold Chain fulfillment).`,
        ``,
        `Terima kasih atas kepercayaan Anda! ✨`,
      ].join('\n');

    case 'ORDER_PROCESSING':
      return [
        `*CALLME YOGHURT — PESANAN SEDANG DIPROSES* 🧊`,
        ``,
        `Halo Kak *${customer_name}*, pesanan Anda *${order_number}* sedang disiapkan di fasilitas Cold Room kami.`,
        ``,
        `📦 *Status:* ${status}`,
        `❄️ *Standar Pengiriman:* Penanganan pengiriman mengikuti SOP Cold Chain produk dairy Callme Yoghurt.`,
        ``,
        `*Item yang Dikemas:*`,
        itemsText,
        ``,
        `Kami memastikan yogurt tetap dalam suhu ideal sebelum diserahkan kepada kurir.`,
      ].join('\n');

    case 'ORDER_READY_TO_SHIP':
      return [
        `*CALLME YOGHURT — PESANAN SIAP DIKIRIM* 🛵`,
        ``,
        `Kabar baik Kak *${customer_name}*! Pesanan *${order_number}* telah selesai dikemas dan siap diantar oleh kurir.`,
        ``,
        `📦 *Status:* ${status}`,
        context.delivery_method ? `🚚 *Layanan:* ${context.delivery_method}` : `🚚 *Layanan:* Pengiriman Rantai Dingin`,
        context.tracking_number ? `🔖 *No. Resi/Pelacakan:* ${context.tracking_number}` : ``,
        ``,
        `*Item Pengiriman:*`,
        itemsText,
        ``,
        `*Total:* ${formattedTotal}`,
        ``,
        `❄️ *Standar Pengiriman:* Penanganan pengiriman mengikuti SOP Cold Chain produk dairy Callme Yoghurt.`,
        ``,
        `Mohon pastikan ada penerima di alamat tujuan untuk segera menerima paket dingin ini.`,
      ].filter(Boolean).join('\n');

    case 'ORDER_DELIVERED':
      return [
        `*CALLME YOGHURT — PESANAN TELAH TIBA* 🎉`,
        ``,
        `Halo Kak *${customer_name}*, pesanan *${order_number}* telah berhasil diterima.`,
        ``,
        `*Ringkasan Item:*`,
        itemsText,
        ``,
        `⚠️ *PENTING — INSTRUKSI PENYIMPANAN:*`,
        `Hanya tahan 3 hari di suhu ruang. Langsung segera masukan kulkas begitu barang diterima (Suhu < 5°C).`,
        ``,
        `Selamat menikmati Callme Yoghurt segar alami! 🍃`,
      ].join('\n');

    default:
      return [
        `*CALLME YOGHURT — UPDATE PESANAN*`,
        ``,
        `Halo Kak *${customer_name}*, terdapat pembaruan pada pesanan *${order_number}*:`,
        `Status: ${status}`,
        `Total: ${formattedTotal}`,
      ].join('\n');
  }
}
