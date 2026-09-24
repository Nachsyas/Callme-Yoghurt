'use client';

import { useCartStore, toTransactionProjection } from '@/store/cartStore';
import { executeCheckoutSubmission, type CheckoutPayload, type DeliveryMethod, type PublicCommittedOrderData } from '@/lib/checkout-client';
import { AlertCircle, ArrowLeft, CheckCircle2, MapPin, Phone, ShieldCheck, ShoppingBag, Truck, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { MOTION_TOKENS } from '@/lib/motion';

export default function CheckoutPage() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const { items, getEstimatedTotal, removeItem, clearCart } = useCartStore();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [committedFallback, setCommittedFallback] = useState<PublicCommittedOrderData | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    whatsapp: '',
    address: '',
    delivery: 'instant' as DeliveryMethod,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (items.length === 0) {
      setErrorMessage('Keranjang belanja kosong!');
      return;
    }

    setIsLoading(true);

    const payload: CheckoutPayload = {
      customer: {
        name: formData.name,
        whatsapp: formData.whatsapp,
        address: formData.address,
      },
      items: toTransactionProjection(items),
      delivery_method: formData.delivery,
    };

    const result = await executeCheckoutSubmission(payload);
    setIsLoading(false);

    if (!result.success) {
      setErrorMessage(result.error || 'Gagal memproses pesanan. Silakan coba lagi.');
      return;
    }

    const order = result.data!;
    // Cart is cleared ONLY after server committed order response is received and validated
    clearCart();

    if (result.storageFailed) {
      // Storage failed to persist confirmation, display inline committed fallback
      setCommittedFallback(order);
      return;
    }

    router.push(`/return?order_id=${encodeURIComponent(order.order_id)}`);
  };

  if (committedFallback) {
    return (
      <div className="min-h-screen bg-[#f2f0eb] flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: MOTION_TOKENS.duration.normal, ease: MOTION_TOKENS.ease.out }}
          className="max-w-md w-full bg-white p-8 md:p-10 rounded-[24px] shadow-[0_0_0.5px_rgba(0,0,0,0.14),_0_1px_1px_rgba(0,0,0,0.24)] text-center relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-2 bg-[#00754A]"></div>
          <motion.div
            initial={{ scale: shouldReduceMotion ? 1 : 0.6 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="w-16 h-16 bg-[#00754A]/10 text-[#00754A] rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <CheckCircle2 size={36} />
          </motion.div>
          <h2 className="text-2xl font-bold text-black/87 mb-2">Pesanan Berhasil Diterima!</h2>
          <p className="text-sm text-black/58 mb-6">
            Pesanan Anda telah berhasil diproses dan tercatat di sistem ERP kami.
          </p>
          <div className="bg-gray-50 rounded-[12px] p-4 text-left space-y-2 mb-6 border border-gray-100 text-sm">
            <div className="flex justify-between">
              <span className="text-black/58">Nomor Pesanan:</span>
              <span className="font-bold text-black/87">{committedFallback.order_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-black/58">Status:</span>
              <span className="font-bold text-[#00754A]">{committedFallback.status}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
              <span className="text-black/58 font-bold">Total Pembayaran:</span>
              <span className="font-extrabold text-base text-black/87">
                Rp {committedFallback.total_amount.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
          <div className="bg-[#1E3932] p-4 rounded-[12px] flex items-start gap-3 text-white text-left mb-6">
            <ShieldCheck size={20} className="text-[#A1C349] flex-shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed opacity-90">Pesanan disiapkan dengan standar Cold Chain Logistics. Tim kami akan menghubungi WhatsApp Anda untuk konfirmasi pengiriman.</p>
          </div>
          <Link href="/" className="w-full inline-block bg-[#1E3932] text-white py-4 rounded-[50px] font-bold text-sm hover:bg-black transition-colors">
            Kembali ke Beranda
          </Link>
        </motion.div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#f2f0eb] flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: MOTION_TOKENS.duration.normal }}
          className="text-center flex flex-col items-center"
        >
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
            <ShoppingBag className="w-8 h-8 text-black/20" />
          </div>
          <h2 className="text-2xl font-bold text-black/87 mb-2">Keranjangmu masih kosong</h2>
          <p className="text-black/58 mb-8">Pilih yoghurt favoritmu dan rasakan kesegarannya!</p>
          <Link href="/" className="px-8 py-3 bg-[#00754A] text-white rounded-[50px] font-semibold hover:scale-95 transition-transform shadow-md">
            Kembali ke Katalog
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f0eb] text-black/87 tracking-tight antialiased pt-8 pb-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-10">
          <Link href="/" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm hover:scale-95 transition-transform">
            <ArrowLeft size={20} className="text-black/87" />
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight">Checkout Pesanan</h1>
        </div>

        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: MOTION_TOKENS.duration.fast }}
              className="mb-6 bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-[12px] text-sm flex items-start gap-3 shadow-sm"
            >
              <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <form id="checkout-form" onSubmit={handleCheckout} className="bg-white p-6 md:p-8 rounded-[16px] shadow-[0_0_0.5px_rgba(0,0,0,0.14),_0_1px_1px_rgba(0,0,0,0.24)] space-y-6">
              <h2 className="font-bold text-lg border-b border-gray-100 pb-4">Informasi Pengiriman</h2>
              <div className="space-y-4">
                <div className="relative">
                  <label className="block text-xs font-bold text-black/58 uppercase mb-2">Nama Lengkap</label>
                  <div className="relative">
                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40" />
                    <input
                      required
                      type="text"
                      name="name"
                      maxLength={255}
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-[8px] focus:outline-none focus:border-[#00754A] focus:ring-1 focus:ring-[#00754A]"
                      placeholder="Masukkan nama Anda"
                    />
                  </div>
                </div>
                <div className="relative">
                  <label className="block text-xs font-bold text-black/58 uppercase mb-2">Nomor WhatsApp</label>
                  <div className="relative">
                    <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40" />
                    <input
                      required
                      type="tel"
                      name="whatsapp"
                      maxLength={50}
                      value={formData.whatsapp}
                      onChange={handleInputChange}
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-[8px] focus:outline-none focus:border-[#00754A] focus:ring-1 focus:ring-[#00754A]"
                      placeholder="08123456789"
                    />
                  </div>
                </div>
                <div className="relative">
                  <label className="block text-xs font-bold text-black/58 uppercase mb-2">Alamat Pengiriman</label>
                  <div className="relative">
                    <MapPin size={18} className="absolute left-4 top-4 text-black/40" />
                    <textarea
                      required
                      name="address"
                      rows={3}
                      maxLength={1000}
                      value={formData.address}
                      onChange={handleInputChange}
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-[8px] focus:outline-none focus:border-[#00754A] focus:ring-1 focus:ring-[#00754A] resize-none"
                      placeholder="Detail alamat..."
                    ></textarea>
                  </div>
                </div>
                <div className="pt-2">
                  <label className="block text-xs font-bold text-black/58 uppercase mb-3">Metode Pengiriman (Cold Chain)</label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className={`cursor-pointer border-2 p-4 rounded-[12px] flex items-start gap-3 transition-colors ${formData.delivery === 'instant' ? 'border-[#00754A] bg-[#00754A]/5' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" name="delivery" value="instant" checked={formData.delivery === 'instant'} onChange={handleInputChange} className="mt-1 text-[#00754A]" />
                      <div>
                        <span className="block font-bold text-sm">Instant</span>
                        <span className="block text-xs text-black/58 mt-1">Maks 3 jam tiba</span>
                      </div>
                    </label>
                    <label className={`cursor-pointer border-2 p-4 rounded-[12px] flex items-start gap-3 transition-colors ${formData.delivery === 'sameday' ? 'border-[#00754A] bg-[#00754A]/5' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" name="delivery" value="sameday" checked={formData.delivery === 'sameday'} onChange={handleInputChange} className="mt-1 text-[#00754A]" />
                      <div>
                        <span className="block font-bold text-sm">Sameday</span>
                        <span className="block text-xs text-black/58 mt-1">Tiba hari yang sama</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </form>
            <div className="bg-[#1E3932] p-5 rounded-[12px] flex items-start gap-4 text-white">
              <ShieldCheck size={24} className="text-[#A1C349] flex-shrink-0" />
              <p className="text-sm leading-relaxed opacity-90">Pesanan dikemas standar <span className="font-bold">Cold Chain Logistics</span>.</p>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-white p-6 md:p-8 rounded-[16px] shadow-[0_0_0.5px_rgba(0,0,0,0.14),_0_1px_1px_rgba(0,0,0,0.24)] sticky top-8">
              <h2 className="font-bold text-lg border-b border-gray-100 pb-4 mb-4">Ringkasan Pesanan</h2>
              <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
                <AnimatePresence initial={false}>
                  {items.map((item) => (
                    <motion.div
                      key={item.variant_id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0, padding: 0 }}
                      transition={{ duration: MOTION_TOKENS.duration.fast }}
                      className="flex justify-between items-start gap-4 bg-gray-50 p-4 rounded-[12px] overflow-hidden"
                    >
                      <div className="flex-1">
                        <h4 className="font-bold text-sm text-black/87">{item.name}</h4>
                        <p className="text-xs font-medium text-black/58 mt-1">
                          {item.sku} {item.volume_ml ? `• ${item.volume_ml}ml` : ''} <span className="mx-1">•</span> Qty: {item.quantity}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="font-bold text-sm text-black/87">Rp {(item.display_price * item.quantity).toLocaleString('id-ID')}</span>
                        <button type="button" onClick={() => removeItem(item.variant_id)} className="block text-xs text-red-500 font-medium mt-1 hover:underline ml-auto cursor-pointer">Hapus</button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              <div className="border-t border-gray-100 mt-6 pt-6 space-y-3">
                <div className="flex justify-between items-end pt-2">
                  <div>
                    <span className="font-bold text-black/87 block">Estimasi Total</span>
                    <span className="text-[11px] text-black/40 block mt-0.5">Total akhir diverifikasi oleh sistem saat pesanan dibuat.</span>
                  </div>
                  <motion.span
                    key={getEstimatedTotal()}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: MOTION_TOKENS.duration.fast }}
                    className="text-2xl font-black text-[#00754A]"
                  >
                    Rp {getEstimatedTotal().toLocaleString('id-ID')}
                  </motion.span>
                </div>
              </div>
              <motion.button
                type="submit"
                form="checkout-form"
                disabled={isLoading}
                whileHover={isLoading || shouldReduceMotion ? undefined : { scale: 1.01 }}
                whileTap={isLoading || shouldReduceMotion ? undefined : { scale: 0.98 }}
                className="w-full mt-8 bg-[#00754A] hover:bg-[#006241] text-white py-4 rounded-[50px] font-bold text-base transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-h-[56px]"
              >
                {isLoading ? <span className="animate-pulse">Memproses Pesanan...</span> : <><Truck size={20} />Selesaikan Pesanan</>}
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
