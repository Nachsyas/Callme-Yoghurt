'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { getValidOrderConfirmation, type StoredConfirmationRecord } from '@/lib/checkout-client';
import {
  getOrderSummary,
  generateDigitalReceipt,
  generateWhatsAppReceipt,
  type OrderSummary,
} from '@/lib/order';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  MessageSquare,
  Package,
  QrCode,
  ShieldCheck,
  Store,
  Truck,
} from 'lucide-react';
import Link from 'next/link';

function ReturnPageContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');

  const [confirmation, setConfirmation] = useState<StoredConfirmationRecord | null>(null);
  const [orderSummary, setOrderSummary] = useState<OrderSummary | null>(null);
  const [checked, setChecked] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const [showReceiptDetails, setShowReceiptDetails] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const validRecord = getValidOrderConfirmation(orderId);
    setConfirmation(validRecord);
    if (validRecord) {
      const summary = getOrderSummary(validRecord.order_number) || getOrderSummary();
      setOrderSummary(summary);
    }
    setChecked(true);
  }, [orderId]);

  if (!checked) {
    return (
      <div className="min-h-screen bg-[#f2f0eb] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-8 md:p-10 rounded-[24px] shadow-[0_0_0.5px_rgba(0,0,0,0.14),_0_1px_1px_rgba(0,0,0,0.24)] text-center">
          <div className="w-12 h-12 border-4 border-[#2E7D32] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm font-medium text-black/58">Memverifikasi konfirmasi pesanan...</p>
        </div>
      </div>
    );
  }

  // If no matching valid confirmation is found in browser session, fail closed
  if (!confirmation) {
    return (
      <div className="min-h-screen bg-[#f2f0eb] flex items-center justify-center p-6">
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24 }}
          className="max-w-md w-full bg-white p-8 md:p-10 rounded-[24px] shadow-[0_0_0.5px_rgba(0,0,0,0.14),_0_1px_1px_rgba(0,0,0,0.24)] text-center relative overflow-hidden"
        >
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={40} className="text-black/40" />
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold text-black/87 tracking-tight mb-3">
            Konfirmasi Tidak Ditemukan
          </h1>

          <p className="text-black/58 text-sm md:text-base leading-relaxed mb-8">
            Sesi konfirmasi pesanan tidak ditemukan atau telah kedaluwarsa. Jika Anda baru saja membuat pesanan, silakan periksa konfirmasi melalui WhatsApp atau hubungi admin Callme Yoghurt.
          </p>

          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 bg-[#2E7D32] text-white py-4 rounded-[50px] font-bold transition-transform active:scale-95 hover:bg-[#256628]"
          >
            Kembali ke Beranda
            <ArrowRight size={18} />
          </Link>
        </motion.div>
      </div>
    );
  }

  const payment = confirmation.payment;

  // Construct effective order summary (Task 3)
  const effectiveSummary: OrderSummary = orderSummary || {
    order_number: confirmation.order_number,
    customer_name: 'Pelanggan Setia Callme Yoghurt',
    whatsapp_number: '-',
    items: [
      {
        product_name: 'Callme Yoghurt Pure Fresh',
        variant: 'Standard Pack',
        quantity: 1,
        price: confirmation.total_amount,
      },
    ],
    subtotal: confirmation.total_amount,
    shipping_fee: 0,
    cold_chain_fee: 0,
    total_amount: confirmation.total_amount,
    payment_status: payment?.status || 'PENDING_PAYMENT',
    order_status: paymentConfirmed ? 'PAYMENT_CONFIRMED' : 'WAITING_PAYMENT',
  };

  // Generate digital receipt plain text (Task 4)
  const digitalReceiptText = generateDigitalReceipt(effectiveSummary);

  // Generate WhatsApp confirmation URL (Task 5)
  const whatsAppReceipt = generateWhatsAppReceipt({
    orderSummary: {
      ...effectiveSummary,
      payment_status: paymentConfirmed ? 'PAID' : effectiveSummary.payment_status,
      order_status: paymentConfirmed ? 'PAYMENT_CONFIRMED' : effectiveSummary.order_status,
    },
  });

  const handleCopyReceipt = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(digitalReceiptText).then(() => {
        setCopiedReceipt(true);
        setTimeout(() => setCopiedReceipt(false), 2500);
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f5f0] flex items-center justify-center p-4 sm:p-6 py-12">
      <motion.div
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }}
        className="max-w-lg w-full bg-white p-6 sm:p-8 rounded-[24px] shadow-sm border border-[#E5E2DA] text-center relative overflow-hidden space-y-6"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-[#2E7D32]"></div>

        <motion.div
          initial={shouldReduceMotion ? { scale: 1, opacity: 1 } : { scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.08, type: "spring", stiffness: 350, damping: 25 }}
          className="w-16 h-16 bg-[#E8F5E9] rounded-full flex items-center justify-center mx-auto"
        >
          <CheckCircle2 size={36} className="text-[#2E7D32]" />
        </motion.div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1c1917] tracking-tight mb-2">
            Pesanan Berhasil!
          </h1>
          <p className="text-black/60 text-xs sm:text-sm leading-relaxed max-w-sm mx-auto">
            Terima kasih telah berbelanja di Callme Yoghurt. Pesanan Anda telah terkonfirmasi di sistem ERP kami.
          </p>
        </div>

        {/* Order Details & Lifecycle Status (Task 1 & Task 6) */}
        <div className="bg-gray-50 rounded-2xl p-4 sm:p-5 text-left border border-gray-100 space-y-2.5">
          <div className="flex justify-between items-center text-sm">
            <span className="text-black/60">Nomor Pesanan</span>
            <span className="font-extrabold text-black/90 tracking-tight font-mono text-sm sm:text-base">
              {confirmation.order_number}
            </span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-black/60">Status Pesanan</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#2E7D32] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#2E7D32]"></span>
                {confirmation.status}
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32]">
                {paymentConfirmed ? 'PAYMENT_CONFIRMED' : (orderSummary?.order_status || 'WAITING_PAYMENT')}
              </span>
            </div>
          </div>

          {payment && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-black/60">Status Pembayaran</span>
              <span className="font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full flex items-center gap-1.5 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                {payment.status}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center text-sm pt-2.5 border-t border-gray-200/80">
            <span className="text-black/70 font-semibold">Total Pembayaran</span>
            <span className="font-black text-lg text-[#2E7D32]">
              Rp {confirmation.total_amount.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* Reusable Order Summary Section (Task 3 & Task 6) */}
        {orderSummary && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 text-left border border-gray-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <span className="font-extrabold text-xs sm:text-sm text-[#1c1917] uppercase tracking-wider">
                Ringkasan Pesanan (Order Summary)
              </span>
              <span className="text-[11px] text-black/50">
                Customer: <strong>{effectiveSummary.customer_name}</strong>
              </span>
            </div>

            {/* Items List */}
            <div className="space-y-2">
              {effectiveSummary.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start text-xs border-b border-gray-50 pb-1.5">
                  <div>
                    <span className="font-bold text-black/85 block">{item.product_name}</span>
                    <span className="text-black/50 text-[11px]">{item.variant} • Qty: {item.quantity}</span>
                  </div>
                  <span className="font-semibold text-black/75">
                    Rp{(item.price * item.quantity).toLocaleString('id-ID')}
                  </span>
                </div>
              ))}
            </div>

            {/* Fee Breakdown */}
            <div className="space-y-1 text-xs text-black/60 pt-1">
              <div className="flex justify-between">
                <span>Subtotal Produk:</span>
                <span className="font-medium text-black/80">Rp{effectiveSummary.subtotal.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span>Ongkos Kirim:</span>
                <span className="font-medium text-black/80">
                  {effectiveSummary.shipping_fee === 0 ? 'Gratis' : `Rp${effectiveSummary.shipping_fee.toLocaleString('id-ID')}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Cold Chain Packaging:</span>
                <span className="font-medium text-[#2E7D32]">Rp{effectiveSummary.cold_chain_fee.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>
        )}

        {/* Digital Receipt Section (Task 4 & Task 6) */}
        <div className="bg-[#FAF9F5] border border-[#E5E2DA] rounded-2xl p-4 text-left space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="text-[#2E7D32]" size={18} />
              <span className="font-bold text-xs sm:text-sm text-[#1c1917]">
                Struk Digital Resmi (Receipt)
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyReceipt}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#2E7D32] bg-[#E8F5E9] hover:bg-[#d4edd7] px-2.5 py-1 rounded-full transition-colors cursor-pointer"
            >
              {copiedReceipt ? (
                <>
                  <Check size={12} />
                  <span>Struk Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Salin Struk Digital</span>
                </>
              )}
            </button>
          </div>

          <div className="text-xs">
            <button
              type="button"
              onClick={() => setShowReceiptDetails(!showReceiptDetails)}
              className="cursor-pointer text-[#2E7D32] font-semibold flex items-center justify-between w-full py-1 select-none hover:underline"
            >
              <span>{showReceiptDetails ? 'Sembunyikan Struk Teks' : 'Lihat Format Struk Teks'}</span>
              <span className={`text-[10px] text-black/40 transition-transform ${showReceiptDetails ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
            {showReceiptDetails && (
              <pre className="mt-2 text-[11px] font-mono leading-relaxed bg-white p-3 rounded-xl border border-gray-200 text-black/80 max-h-36 overflow-y-auto whitespace-pre-wrap">
                {digitalReceiptText}
              </pre>
            )}
          </div>
        </div>

        {/* QRIS Instruction Card (from Phase 1.7C.14) */}
        {payment && (
          <div className="border border-[#2E7D32]/25 bg-[#E8F5E9]/30 rounded-2xl p-5 text-left space-y-4">
            <div className="flex items-center justify-between border-b border-[#2E7D32]/15 pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="text-[#2E7D32]" size={20} />
                <span className="font-extrabold text-sm sm:text-base text-[#1c1917]">
                  Instruksi Pembayaran QRIS
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.5 rounded">
                <Clock size={12} />
                30 Menit
              </span>
            </div>

            {/* QR Code Presentation Box */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col items-center justify-center text-center shadow-xs">
              <div className="text-[11px] font-black uppercase tracking-widest text-[#2E7D32] mb-2">
                QRIS Standar Pembayaran Nasional
              </div>

              {/* Crisp SVG QR Code Graphic */}
              <div className="w-48 h-48 bg-white p-2 border-2 border-gray-100 rounded-lg flex items-center justify-center relative">
                <svg
                  className="w-full h-full"
                  viewBox="0 0 100 100"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Position detection patterns (Corner Squares) */}
                  <rect x="5" y="5" width="26" height="26" fill="#1c1917" rx="3" />
                  <rect x="9" y="9" width="18" height="18" fill="white" rx="1" />
                  <rect x="13" y="13" width="10" height="10" fill="#1c1917" rx="1" />

                  <rect x="69" y="5" width="26" height="26" fill="#1c1917" rx="3" />
                  <rect x="73" y="9" width="18" height="18" fill="white" rx="1" />
                  <rect x="77" y="13" width="10" height="10" fill="#1c1917" rx="1" />

                  <rect x="5" y="69" width="26" height="26" fill="#1c1917" rx="3" />
                  <rect x="9" y="73" width="18" height="18" fill="white" rx="1" />
                  <rect x="13" y="77" width="10" height="10" fill="#1c1917" rx="1" />

                  {/* Matrix Grid Data Simulation */}
                  <rect x="36" y="8" width="5" height="5" fill="#1c1917" />
                  <rect x="46" y="8" width="5" height="5" fill="#1c1917" />
                  <rect x="56" y="8" width="5" height="5" fill="#1c1917" />
                  <rect x="36" y="18" width="5" height="5" fill="#1c1917" />
                  <rect x="51" y="18" width="5" height="5" fill="#1c1917" />
                  <rect x="36" y="28" width="5" height="5" fill="#1c1917" />
                  <rect x="46" y="28" width="5" height="5" fill="#1c1917" />
                  <rect x="56" y="28" width="5" height="5" fill="#1c1917" />

                  <rect x="8" y="36" width="5" height="5" fill="#1c1917" />
                  <rect x="18" y="36" width="5" height="5" fill="#1c1917" />
                  <rect x="28" y="36" width="5" height="5" fill="#1c1917" />
                  <rect x="8" y="46" width="5" height="5" fill="#1c1917" />
                  <rect x="23" y="46" width="5" height="5" fill="#1c1917" />
                  <rect x="8" y="56" width="5" height="5" fill="#1c1917" />
                  <rect x="18" y="56" width="5" height="5" fill="#1c1917" />
                  <rect x="28" y="56" width="5" height="5" fill="#1c1917" />

                  <rect x="69" y="36" width="5" height="5" fill="#1c1917" />
                  <rect x="79" y="36" width="5" height="5" fill="#1c1917" />
                  <rect x="89" y="36" width="5" height="5" fill="#1c1917" />
                  <rect x="74" y="46" width="5" height="5" fill="#1c1917" />
                  <rect x="89" y="46" width="5" height="5" fill="#1c1917" />
                  <rect x="69" y="56" width="5" height="5" fill="#1c1917" />
                  <rect x="84" y="56" width="5" height="5" fill="#1c1917" />

                  <rect x="36" y="69" width="5" height="5" fill="#1c1917" />
                  <rect x="46" y="69" width="5" height="5" fill="#1c1917" />
                  <rect x="56" y="69" width="5" height="5" fill="#1c1917" />
                  <rect x="41" y="79" width="5" height="5" fill="#1c1917" />
                  <rect x="56" y="79" width="5" height="5" fill="#1c1917" />
                  <rect x="36" y="89" width="5" height="5" fill="#1c1917" />
                  <rect x="51" y="89" width="5" height="5" fill="#1c1917" />

                  <rect x="69" y="69" width="5" height="5" fill="#1c1917" />
                  <rect x="79" y="74" width="5" height="5" fill="#1c1917" />
                  <rect x="89" y="69" width="5" height="5" fill="#1c1917" />
                  <rect x="69" y="84" width="5" height="5" fill="#1c1917" />
                  <rect x="79" y="89" width="5" height="5" fill="#1c1917" />
                  <rect x="89" y="84" width="5" height="5" fill="#1c1917" />

                  {/* Center Badge */}
                  <rect x="40" y="40" width="20" height="20" fill="white" rx="4" stroke="#2E7D32" strokeWidth="2" />
                  <circle cx="50" cy="50" r="6" fill="#2E7D32" />
                </svg>
              </div>

              <div className="mt-2 text-xs font-bold text-black/80">
                {payment.account_name || 'CALLME YOGHURT INDONESIA'}
              </div>
              <div className="text-[11px] text-black/50">NMID: ID102600291884</div>
            </div>

            {/* Steps Instruction */}
            <div className="space-y-1.5 text-xs text-black/70">
              <div className="font-bold text-black/80 text-xs mb-1">Panduan Pembayaran:</div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">1</span>
                <span>Buka aplikasi BCA Mobile, GoPay, OVO, Dana, ShopeePay, atau m-Banking Anda.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">2</span>
                <span>Pindai (scan) kode QRIS di atas dan periksa nama penerima.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">3</span>
                <span>Pastikan nominal transfer tepat sesuai dengan Total Pembayaran di atas.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">4</span>
                <span>Selesaikan transfer dan tekan tombol konfirmasi di bawah ini.</span>
              </div>
            </div>

            {/* Payment Confirmation Required */}
            <div className="pt-2 space-y-2.5">
              {paymentConfirmed ? (
                <div className="p-3 bg-[#E8F5E9] border border-[#2E7D32]/30 rounded-xl text-xs font-bold text-[#2E7D32] flex items-center justify-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>Konfirmasi Diterima! Tim admin sedang memverifikasi pembayaran Anda.</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPaymentConfirmed(true)}
                  className="w-full bg-[#2E7D32] hover:bg-[#256628] active:bg-[#1B5E20] text-white py-3 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 size={16} />
                  <span>Saya Sudah Membayar</span>
                </button>
              )}

              {/* WhatsApp Receipt Button (Task 5 & 6) */}
              <a
                href={whatsAppReceipt.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-[#25D366] hover:bg-[#20ba59] text-white py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <MessageSquare size={15} />
                <span>Konfirmasi via WhatsApp Resmi</span>
              </a>
            </div>
          </div>
        )}

        {/* Cold Chain Guarantee Banner (SOP 01) */}
        <div className="bg-[#1E3932] text-white rounded-xl p-3.5 flex items-start gap-3 text-left">
          <Package size={20} className="text-[#A1C349] flex-shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed opacity-90 space-y-0.5">
            <span className="block font-bold text-white">Jaminan Kesegaran Cold Chain (0–5°C)</span>
            <p className="text-[11px] text-white/80">
              Hanya tahan 3 hari di suhu ruang. Langsung segera masukan kulkas begitu barang diterima (Suhu &lt; 5°C).
            </p>
          </div>
        </div>

        <Link
          href="/"
          className="w-full flex items-center justify-center gap-2 bg-[#2E7D32] hover:bg-[#256628] text-white py-3.5 rounded-full font-bold text-sm transition-transform active:scale-95"
        >
          Kembali ke Beranda
          <ArrowRight size={18} />
        </Link>
      </motion.div>
    </div>
  );
}

export default function ReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f2f0eb] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white p-8 md:p-10 rounded-[24px] shadow-[0_0_0.5px_rgba(0,0,0,0.14),_0_1px_1px_rgba(0,0,0,0.24)] text-center">
            <div className="w-12 h-12 border-4 border-[#00754A] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm font-medium text-black/58">Memuat...</p>
          </div>
        </div>
      }
    >
      <ReturnPageContent />
    </Suspense>
  );
}
