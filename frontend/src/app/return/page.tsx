'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { getValidOrderConfirmation, type StoredConfirmationRecord } from '@/lib/checkout-client';
import { AlertCircle, ArrowRight, CheckCircle2, Package, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

function ReturnPageContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');

  const [confirmation, setConfirmation] = useState<StoredConfirmationRecord | null>(null);
  const [checked, setChecked] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const validRecord = getValidOrderConfirmation(orderId);
    setConfirmation(validRecord);
    setChecked(true);
  }, [orderId]);

  if (!checked) {
    return (
      <div className="min-h-screen bg-[#f2f0eb] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-8 md:p-10 rounded-[24px] shadow-[0_0_0.5px_rgba(0,0,0,0.14),_0_1px_1px_rgba(0,0,0,0.24)] text-center">
          <div className="w-12 h-12 border-4 border-[#00754A] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
            className="w-full flex items-center justify-center gap-2 bg-[#1E3932] text-white py-4 rounded-[50px] font-bold transition-transform active:scale-95 hover:bg-black"
          >
            Kembali ke Beranda
            <ArrowRight size={18} />
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f0eb] flex items-center justify-center p-6">
      <motion.div
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }}
        className="max-w-md w-full bg-white p-8 md:p-10 rounded-[24px] shadow-[0_0_0.5px_rgba(0,0,0,0.14),_0_1px_1px_rgba(0,0,0,0.24)] text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-[#00754A]"></div>

        <motion.div
          initial={shouldReduceMotion ? { scale: 1, opacity: 1 } : { scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.08, type: "spring", stiffness: 350, damping: 25 }}
          className="w-20 h-20 bg-[#00754A]/10 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <CheckCircle2 size={40} className="text-[#00754A]" />
        </motion.div>

        <h1 className="text-2xl md:text-3xl font-extrabold text-black/87 tracking-tight mb-2">
          Pesanan Berhasil!
        </h1>

        <p className="text-black/58 text-sm leading-relaxed mb-6">
          Terima kasih telah berbelanja di Callme Yoghurt. Pesanan Anda telah terkonfirmasi dan sedang diproses dengan standar Cold Chain.
        </p>

        <div className="bg-gray-50 rounded-[16px] p-5 text-left border border-gray-100 mb-6 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-black/58">Nomor Pesanan</span>
            <span className="font-bold text-black/87">{confirmation.order_number}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-black/58">Status</span>
            <span className="font-bold text-[#00754A] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00754A]"></span>
              {confirmation.status}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-200">
            <span className="text-black/70 font-semibold">Total Pembayaran</span>
            <span className="font-extrabold text-base text-black/87">
              Rp {confirmation.total_amount.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        <div className="bg-[#1E3932] text-white rounded-[16px] p-4 flex items-start gap-3.5 mb-8 text-left">
          <Package size={22} className="text-[#A1C349] flex-shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed opacity-90 space-y-1">
            <span className="block font-bold text-white">Jaminan Kesegaran Dingin</span>
            <p>Pengiriman terjaga pada suhu 2°C - 4°C dengan ice gel pack khusus. Admin akan segera menghubungi WhatsApp Anda.</p>
          </div>
        </div>

        <Link
          href="/"
          className="w-full flex items-center justify-center gap-2 bg-[#1E3932] text-white py-4 rounded-[50px] font-bold transition-transform active:scale-95 hover:bg-black"
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
