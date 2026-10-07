'use client';

import { useCartStore, toTransactionProjection, type CartItem } from '@/store/cartStore';
import { executeCheckoutSubmission, type CheckoutPayload, type DeliveryMethod, type PublicCommittedOrderData } from '@/lib/checkout-client';
import { type ShippingQuote, type BiteshipArea } from '@/lib/shipping';
import { buildOrderSummary, saveOrderSummary } from '@/lib/order';
import { isUuid } from '@/lib/catalog';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, MapPin, Phone, QrCode, Search, ShieldCheck, ShoppingBag, Store, Truck, User } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { MOTION_TOKENS } from '@/lib/motion';

import type { ServiceFeeConfig } from '@/lib/shipping/service-fee-config';

function getItemArtwork(item: CartItem): string {
  if (item.image_url) return item.image_url;
  const lowerName = (item.name || "").toLowerCase();
  const lowerSku = (item.sku || "").toLowerCase();
  const is1L =
    item.volume_ml === 1000 ||
    lowerName.includes("1000") ||
    lowerName.includes("1 liter") ||
    lowerSku.includes("1000");

  const flavors = ["plain", "stroberi", "mangga", "melon", "anggur", "leci", "vanila"];
  for (const flavor of flavors) {
    if (
      lowerName.includes(flavor) ||
      lowerSku.includes(flavor) ||
      (flavor === "stroberi" && (lowerName.includes("strawberry") || lowerSku.includes("strawberry"))) ||
      (flavor === "vanila" && (lowerName.includes("vanilla") || lowerSku.includes("vanilla")))
    ) {
      return is1L ? `/images/${flavor}.png` : `/images/products/${flavor}-250-500.png`;
    }
  }
  return is1L ? "/images/plain.png" : "/images/products/plain-250-500.png";
}

export default function CheckoutPage() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const { items, getEstimatedTotal, removeItem, clearCart } = useCartStore();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [committedFallback, setCommittedFallback] = useState<PublicCommittedOrderData | null>(null);

  // Address State & Payment Selection
  const [formData, setFormData] = useState({
    name: '',
    whatsapp: '',
    address: '',
    province: 'DKI Jakarta',
    city: 'Jakarta Timur',
    district: 'Cipayung',
    postalCode: '13890',
    paymentMethod: 'manual_qris',
  });

  // Biteship Area Autocomplete State
  const [areaSearchInput, setAreaSearchInput] = useState('');
  const [areaSuggestions, setAreaSuggestions] = useState<BiteshipArea[]>([]);
  const [isSearchingArea, setIsSearchingArea] = useState(false);
  const [selectedArea, setSelectedArea] = useState<BiteshipArea | null>(null);

  // Biteship Shipping Quotes State (Phase 1.7C.19A: Real Rates Only, Zero Pickup)
  const [availableQuotes, setAvailableQuotes] = useState<ShippingQuote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<ShippingQuote | null>(null);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [hasCalculatedShipping, setHasCalculatedShipping] = useState(false);
  const [serviceFeeConfig, setServiceFeeConfig] = useState<ServiceFeeConfig | null>(null);

  // Load authoritative server-side Biaya Layanan configuration on mount
  useEffect(() => {
    let isMounted = true;
    async function loadServiceFee() {
      try {
        const res = await fetch('/api/shipping/quote');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.service_fee) {
            setServiceFeeConfig(data.service_fee);
          }
        }
      } catch {
        // Safe fail-closed
      }
    }
    loadServiceFee();
    return () => {
      isMounted = false;
    };
  }, []);

  // Debounced Biteship Area Lookup
  useEffect(() => {
    const trimmed = areaSearchInput.trim();
    if (trimmed.length < 3) {
      setAreaSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingArea(true);
      try {
        const res = await fetch(`/api/shipping/areas?input=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.areas)) {
          setAreaSuggestions(data.areas);
        } else {
          setAreaSuggestions([]);
        }
      } catch {
        setAreaSuggestions([]);
      } finally {
        setIsSearchingArea(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [areaSearchInput]);

  const handleSelectArea = (area: BiteshipArea) => {
    setSelectedArea(area);
    setAreaSearchInput(area.name);
    setAreaSuggestions([]);
    setFormData((prev) => ({
      ...prev,
      province: area.administrative_division_level_1_name || prev.province,
      city: area.administrative_division_level_2_name || prev.city,
      district: area.administrative_division_level_3_name || prev.district,
      postalCode: area.postal_code ? String(area.postal_code) : prev.postalCode,
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Invalidate selected quote and available quotes when destination or cart changes
  useEffect(() => {
    setSelectedQuote(null);
    setAvailableQuotes([]);
    setHasCalculatedShipping(false);
  }, [
    formData.postalCode,
    formData.city,
    formData.province,
    formData.district,
    selectedArea,
    items,
  ]);

  const handleCalculateShipping = async () => {
    setShippingError(null);
    setIsCalculatingShipping(true);

    try {
      const res = await fetch('/api/shipping/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination_area_id: selectedArea?.id,
          destination_postal_code: formData.postalCode.trim() || undefined,
          destination_latitude: selectedArea?.latitude,
          destination_longitude: selectedArea?.longitude,
          city: formData.city.trim() || 'Jakarta Timur',
          province: formData.province.trim() || 'DKI Jakarta',
          district: formData.district.trim() || 'Cipayung',
          items: items.map((i) => ({
            variant_id: i.variant_id,
            quantity: i.quantity,
          })),
        }),
      });

      const data = await res.json();
      setHasCalculatedShipping(true);

      if (data.service_fee) {
        setServiceFeeConfig(data.service_fee);
      }

      if (data.success && Array.isArray(data.quotes) && data.quotes.length > 0) {
        setAvailableQuotes(data.quotes);
        setSelectedQuote(data.quotes[0]);
        setShippingError(null);
      } else {
        setAvailableQuotes([]);
        setSelectedQuote(null);
        setShippingError(data.error || 'Ongkir belum dapat dihitung');
      }
    } catch {
      setHasCalculatedShipping(true);
      setAvailableQuotes([]);
      setSelectedQuote(null);
      setShippingError('Ongkir belum dapat dihitung: Gangguan koneksi ke layanan tarif.');
    } finally {
      setIsCalculatingShipping(false);
    }
  };

  // Authoritative financial breakdown directly from selected quote (or fallback before quote calculation)
  const subtotal = selectedQuote?.product_subtotal ?? getEstimatedTotal();
  const shippingFee = selectedQuote?.shipping_fee ?? (selectedQuote ? selectedQuote.price : 0);
  const serviceFee =
    selectedQuote?.service_fee ??
    (serviceFeeConfig?.isConfigured && typeof serviceFeeConfig.amount === 'number'
      ? serviceFeeConfig.amount
      : 0);
  const totalPayment = selectedQuote?.payable_total ?? (subtotal + shippingFee + serviceFee);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Prevent checkout with empty cart
    if (items.length === 0) {
      setErrorMessage('Keranjang belanja kosong!');
      return;
    }

    // 2. Prevent invalid quantity
    const hasInvalidQuantity = items.some(
      (item) => !item.quantity || item.quantity <= 0 || !Number.isInteger(item.quantity)
    );
    if (hasInvalidQuantity) {
      setErrorMessage('Jumlah produk dalam keranjang tidak valid!');
      return;
    }

    // 3. Prevent missing or invalid product variant
    const hasInvalidVariant = items.some(
      (item) => !item.variant_id || !isUuid(item.variant_id)
    );
    if (hasInvalidVariant) {
      setErrorMessage('Varian produk dalam keranjang tidak valid!');
      return;
    }

    // 4. Prevent checkout without valid shipping quote
    if (!selectedQuote) {
      setErrorMessage('Ongkir belum dapat dihitung. Silakan hitung dan pilih opsi kurir pengiriman!');
      return;
    }

    // 4b. Prevent checkout without valid service fee configuration (Phase 1.7C.19A)
    if (!serviceFeeConfig || !serviceFeeConfig.isConfigured || serviceFeeConfig.amount === null) {
      setErrorMessage('Biaya Layanan belum dikonfigurasi oleh pemilik bisnis. Komitmen pembayaran diblokir.');
      return;
    }

    // 4c. Prevent checkout without payment method
    if (!formData.paymentMethod) {
      setErrorMessage('Metode pembayaran belum dipilih atau belum tersedia.');
      return;
    }

    // 5. Prevent invalid address
    if (
      !formData.name.trim() ||
      !formData.whatsapp.trim() ||
      !formData.address.trim() ||
      !formData.province.trim() ||
      !formData.city.trim() ||
      !formData.district.trim() ||
      !formData.postalCode.trim()
    ) {
      setErrorMessage('Mohon lengkapi semua field alamat dan kontak pengiriman!');
      return;
    }

    // 6. Prevent negative shipping fee
    if (shippingFee < 0) {
      setErrorMessage('Biaya pengiriman tidak valid!');
      return;
    }

    // 7. Prevent negative service fee
    if (serviceFee < 0) {
      setErrorMessage('Biaya Layanan tidak valid!');
      return;
    }

    setIsLoading(true);

    const areaNote = selectedArea ? ` [Area: ${selectedArea.name}]` : '';
    const consolidatedAddress = [
      formData.address.trim() + areaNote,
      formData.district.trim(),
      formData.city.trim(),
      formData.province.trim(),
      formData.postalCode.trim(),
    ]
      .filter(Boolean)
      .join(', ');

    const backendDeliveryMethod: DeliveryMethod =
      selectedQuote.service_type === 'instant'
        ? 'instant'
        : selectedQuote.service_type === 'sameday'
        ? 'sameday'
        : 'nextday';

    // Requirement 5: Clean customer address without courier/service prefix
    const customerAddress = consolidatedAddress;

    const payload: CheckoutPayload = {
      customer: {
        name: formData.name.trim(),
        whatsapp: formData.whatsapp.trim(),
        address: customerAddress,
      },
      destination: {
        postal_code: formData.postalCode.trim(),
        city: formData.city.trim() || undefined,
        province: formData.province.trim() || undefined,
        district: formData.district.trim() || undefined,
        area_id: selectedArea?.id || undefined,
        latitude: selectedArea?.latitude || undefined,
        longitude: selectedArea?.longitude || undefined,
      },
      items: toTransactionProjection(items),
      delivery_method: backendDeliveryMethod,
      shipping_quote_id: selectedQuote.quote_id,
    };

    const result = await executeCheckoutSubmission(payload);
    setIsLoading(false);

    if (!result.success) {
      setErrorMessage(result.error || 'Gagal memproses pesanan. Silakan coba lagi.');
      return;
    }

    const order = result.data!;

    // Build and persist order summary structure
    try {
      const summary = buildOrderSummary({
        order_number: order.order_number,
        customer_name: formData.name.trim(),
        whatsapp_number: formData.whatsapp.trim(),
        items: items.map((i) => ({
          product_name: i.name,
          variant: i.volume_ml === 1000 ? '1 Liter' : `${i.volume_ml || 250} ml`,
          quantity: i.quantity,
          price: i.display_price,
        })),
        subtotal,
        shipping_fee: shippingFee,
        cold_chain_fee: 0,
        total_amount: order.total_amount,
        payment_status: order.payment?.status || 'PENDING_PAYMENT',
        order_status: 'WAITING_PAYMENT',
        delivery_method: `${selectedQuote.courier_name} - ${selectedQuote.service_name}`,
      });
      saveOrderSummary(summary);
    } catch (err) {
      console.warn('Notice: Failed to persist client order summary:', err);
    }

    // Cart is cleared ONLY after server committed order response is received and validated
    clearCart();

    if (result.storageFailed) {
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
          <div className="absolute top-0 left-0 w-full h-2 bg-[#2E7D32]"></div>
          <motion.div
            initial={{ scale: shouldReduceMotion ? 1 : 0.6 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="w-16 h-16 bg-[#E8F5E9] text-[#2E7D32] rounded-full flex items-center justify-center mx-auto mb-4"
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
              <span className="font-bold text-[#2E7D32]">{committedFallback.status}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
              <span className="text-black/58 font-bold">Total Pembayaran:</span>
              <span className="font-extrabold text-base text-[#2E7D32]">
                Rp {committedFallback.total_amount.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
          <div className="bg-[#1B5E20] p-4 rounded-[12px] flex items-start gap-3 text-white text-left mb-6">
            <ShieldCheck size={20} className="text-emerald-300 flex-shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed opacity-90">Pesanan disiapkan dengan standar Cold Chain Logistics. Tim kami akan menghubungi WhatsApp Anda untuk konfirmasi pengiriman.</p>
          </div>
          <Link href="/" className="w-full inline-block bg-[#2E7D32] hover:bg-[#256628] text-white py-4 rounded-[50px] font-bold text-sm transition-colors shadow-sm">
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
          <Link href="/" className="px-8 py-3 bg-[#2E7D32] hover:bg-[#256628] text-white rounded-[50px] font-semibold hover:scale-95 transition-transform shadow-md">
            Kembali ke Katalog
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f5f0] text-[#1c1917] tracking-tight antialiased pt-6 sm:pt-8 pb-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8 sm:mb-10">
          <Link
            href="/"
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm hover:scale-95 transition-transform border border-black/5 text-[#2E7D32]"
            aria-label="Kembali ke Beranda"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#2E7D32] block">
              Callme Yoghurt Storefront
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1c1917]">
              Checkout Pesanan
            </h1>
          </div>
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT: Customer Address & Shipping Options Form */}
          <div className="lg:col-span-7 space-y-6">
            <form id="checkout-form" onSubmit={handleCheckout} className="space-y-6">
              {/* Card 1: Alamat Pengiriman (Task 1 & Task 6) */}
              <div className="bg-white p-5 sm:p-8 rounded-2xl shadow-xs border border-[#E5E2DA] space-y-5">
                <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="text-[#2E7D32]" size={20} />
                    <h2 className="font-extrabold text-base sm:text-lg text-[#1c1917]">
                      Informasi Alamat Pengiriman
                    </h2>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32]">
                    Wajib Diisi
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Nama Lengkap */}
                  <div>
                    <label className="block text-xs font-bold text-black/60 uppercase mb-1.5">
                      Nama Lengkap
                    </label>
                    <div className="relative">
                      <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40" />
                      <input
                        required
                        type="text"
                        name="name"
                        maxLength={255}
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#2E7D32] focus:ring-1 focus:ring-[#2E7D32] text-sm"
                        placeholder="Masukkan nama lengkap Anda"
                      />
                    </div>
                  </div>

                  {/* Nomor WhatsApp */}
                  <div>
                    <label className="block text-xs font-bold text-black/60 uppercase mb-1.5">
                      Nomor WhatsApp
                    </label>
                    <div className="relative">
                      <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40" />
                      <input
                        required
                        type="tel"
                        name="whatsapp"
                        maxLength={50}
                        value={formData.whatsapp}
                        onChange={handleInputChange}
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#2E7D32] focus:ring-1 focus:ring-[#2E7D32] text-sm"
                        placeholder="Contoh: 08123456789"
                      />
                    </div>
                  </div>

                  {/* Alamat Jalan */}
                  <div>
                    <label className="block text-xs font-bold text-black/60 uppercase mb-1.5">
                      Alamat Lengkap (Nama Jalan, No. Rumah, RT/RW)
                    </label>
                    <div className="relative">
                      <MapPin size={18} className="absolute left-4 top-3.5 text-black/40" />
                      <textarea
                        required
                        name="address"
                        rows={2}
                        maxLength={1000}
                        value={formData.address}
                        onChange={handleInputChange}
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#2E7D32] focus:ring-1 focus:ring-[#2E7D32] resize-none text-sm"
                        placeholder="Contoh: Jl. Merdeka No. 10, RT 02/05"
                      />
                    </div>
                  </div>

                  {/* Biteship Destination Area Autocomplete Search */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-black/60 uppercase">
                        Cari Kecamatan / Kota (Biteship Maps Lookup)
                      </label>
                      <span className="text-[11px] text-[#2E7D32] font-semibold">Otomatis Melengkapi</span>
                    </div>
                    <div className="relative">
                      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40" />
                      <input
                        type="text"
                        value={areaSearchInput}
                        onChange={(e) => setAreaSearchInput(e.target.value)}
                        className="w-full pl-11 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#2E7D32] focus:ring-1 focus:ring-[#2E7D32] text-sm"
                        placeholder="Ketik minimal 3 karakter, misal: Cipayung atau Jakarta Timur"
                      />
                      {isSearchingArea && (
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                          <div className="w-4 h-4 border-2 border-[#2E7D32] border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>

                    {/* Area Suggestions Dropdown */}
                    {areaSuggestions.length > 0 && (
                      <div className="mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-100 z-10 relative">
                        {areaSuggestions.map((area) => (
                          <button
                            key={area.id}
                            type="button"
                            onClick={() => handleSelectArea(area)}
                            className="w-full text-left p-3 hover:bg-[#E8F5E9]/50 text-xs transition-colors flex flex-col gap-0.5 cursor-pointer"
                          >
                            <span className="font-bold text-[#1c1917]">{area.name}</span>
                            <span className="text-[11px] text-black/50">
                              Kode Pos: {area.postal_code || 'N/A'} • ID: {area.id}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedArea && (
                      <div className="mt-2 p-2.5 bg-[#E8F5E9]/70 border border-[#2E7D32]/20 rounded-xl text-xs flex items-center justify-between text-[#1B5E20]">
                        <span className="font-semibold truncate">
                          ✓ Area Terpilih: <strong>{selectedArea.name}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedArea(null);
                            setAreaSearchInput('');
                          }}
                          className="text-[11px] text-red-600 hover:underline ml-2 flex-shrink-0 cursor-pointer"
                        >
                          Ganti
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 2-Column: Provinsi & Kota/Kabupaten */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-black/60 uppercase mb-1.5">
                        Provinsi
                      </label>
                      <input
                        required
                        type="text"
                        name="province"
                        maxLength={100}
                        value={formData.province}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#2E7D32] focus:ring-1 focus:ring-[#2E7D32] text-sm"
                        placeholder="Provinsi"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-black/60 uppercase mb-1.5">
                        Kota / Kabupaten
                      </label>
                      <input
                        required
                        type="text"
                        name="city"
                        maxLength={100}
                        value={formData.city}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#2E7D32] focus:ring-1 focus:ring-[#2E7D32] text-sm"
                        placeholder="Kota / Kabupaten"
                      />
                    </div>
                  </div>

                  {/* 2-Column: Kecamatan & Kode Pos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-black/60 uppercase mb-1.5">
                        Kecamatan
                      </label>
                      <input
                        required
                        type="text"
                        name="district"
                        maxLength={100}
                        value={formData.district}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#2E7D32] focus:ring-1 focus:ring-[#2E7D32] text-sm"
                        placeholder="Kecamatan"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-black/60 uppercase mb-1.5">
                        Kode Pos
                      </label>
                      <input
                        required
                        type="text"
                        name="postalCode"
                        maxLength={10}
                        value={formData.postalCode}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#2E7D32] focus:ring-1 focus:ring-[#2E7D32] text-sm"
                        placeholder="Kode Pos"
                      />
                    </div>
                  </div>

                  {/* "Hitung Ongkir" Button (Task 12) */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleCalculateShipping}
                      disabled={isCalculatingShipping || !formData.address.trim() || !formData.postalCode.trim()}
                      className="w-full py-3.5 px-4 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border-2 border-[#2E7D32] text-[#2E7D32] rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                    >
                      {isCalculatingShipping ? (
                        <>
                          <div className="w-4 h-4 border-2 border-[#2E7D32] border-t-transparent rounded-full animate-spin" />
                          <span>Menghitung Tarif Resmi Biteship...</span>
                        </>
                      ) : (
                        <>
                          <Truck size={18} />
                          <span>Hitung Ongkir Resmi (Biteship Rates)</span>
                        </>
                      )}
                    </button>
                    <p className="text-[11px] text-black/50 text-center mt-1.5">
                      Tarif dihitung otomatis berdasarkan berat paket & SOP Rantai Dingin (0–5°C).
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 2: Opsi Pengiriman (Task 10 & 12: Real Biteship Quotes) */}
              <div className="bg-white p-5 sm:p-8 rounded-2xl shadow-xs border border-[#E5E2DA] space-y-4">
                <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="text-[#2E7D32]" size={20} />
                    <h2 className="font-extrabold text-base sm:text-lg text-[#1c1917]">
                      Opsi Pengiriman & Penanganan Dingin
                    </h2>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32]">
                    Biteship Rates API
                  </span>
                </div>

                {shippingError && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl text-xs flex items-start gap-2.5">
                    <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Ongkir belum dapat dihitung</p>
                      <p className="mt-0.5 text-amber-800">{shippingError}</p>
                      <p className="mt-1 text-black/60">
                        Silakan periksa kembali alamat dan kode pos tujuan, atau coba beberapa saat lagi.
                      </p>
                    </div>
                  </div>
                )}

                {!hasCalculatedShipping && availableQuotes.length === 0 && !shippingError && (
                  <div className="bg-blue-50 border border-blue-200 text-blue-900 p-3.5 rounded-xl text-xs flex items-start gap-2.5">
                    <Truck size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Lengkapi alamat dan klik tombol <strong>Hitung Ongkir Resmi</strong> untuk menampilkan opsi kurir rantai dingin resmi (Instant, Same Day, Next Day).
                    </p>
                  </div>
                )}

                {isCalculatingShipping ? (
                  <div className="p-8 text-center bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                    <div className="w-6 h-6 border-2 border-[#2E7D32] border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs font-medium text-black/60">Mengambil tarif resmi kurir rantai dingin dari Biteship...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {availableQuotes.map((quote) => {
                      const isSelected = selectedQuote?.quote_id === quote.quote_id;
                      return (
                        <label
                          key={quote.quote_id}
                          className={`cursor-pointer border-2 p-4 rounded-xl flex items-start gap-3.5 transition-all ${
                            isSelected
                              ? 'border-[#2E7D32] bg-[#E8F5E9]/50 shadow-xs'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <input
                            type="radio"
                            name="delivery"
                            value={quote.quote_id}
                            checked={isSelected}
                            onChange={() => setSelectedQuote(quote)}
                            className="mt-1 text-[#2E7D32] accent-[#2E7D32]"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-sm sm:text-base text-[#1c1917]">
                                {`${quote.courier_name} ${quote.service_name}`}
                              </span>
                              <span className="font-extrabold text-sm text-[#2E7D32]">
                                Rp {quote.price.toLocaleString('id-ID')}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {quote.duration && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.5 rounded">
                                  <Clock size={12} />
                                  {quote.duration}
                                </span>
                              )}
                              {quote.cold_chain_compliant && (
                                <span className="text-[11px] font-bold text-[#1B5E20] bg-emerald-100/70 px-2 py-0.5 rounded">
                                  Cold Chain
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-black/60 mt-1.5">
                              {quote.description || 'Pengiriman dengan proteksi Rantai Dingin (0–5°C).'}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Card 3: Metode Pembayaran (Manual QRIS) */}
              <div className="bg-white p-5 sm:p-8 rounded-2xl shadow-xs border border-[#E5E2DA] space-y-4">
                <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <QrCode className="text-[#2E7D32]" size={20} />
                    <h2 className="font-extrabold text-base sm:text-lg text-[#1c1917]">
                      Metode Pembayaran
                    </h2>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32]">
                    Bebas Biaya Admin
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Option 1: QRIS */}
                  <label
                    className={`cursor-pointer border-2 p-4 rounded-xl flex items-start gap-3.5 transition-all ${
                      formData.paymentMethod === 'manual_qris'
                        ? 'border-[#2E7D32] bg-[#E8F5E9]/50 shadow-xs'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="manual_qris"
                      checked={formData.paymentMethod === 'manual_qris'}
                      onChange={handleInputChange}
                      className="mt-1 text-[#2E7D32] accent-[#2E7D32]"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm sm:text-base text-[#1c1917]">
                          QRIS (Scan & Bayar Instan)
                        </span>
                        <span className="font-extrabold text-xs text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.5 rounded">
                          0% Fee
                        </span>
                      </div>
                      <p className="text-xs text-black/60 mt-1">
                        Mendukung semua e-wallet & mobile banking: <strong>BCA Mobile, GoPay, OVO, ShopeePay, Dana, LinkAja</strong>, dan seluruh bank di Indonesia.
                      </p>
                      <p className="text-[11px] text-[#2E7D32] font-semibold mt-1.5 flex items-center gap-1">
                        ✓ Kode QRIS resmi Callme Yoghurt langsung tampil setelah pesanan dibuat
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </form>

            {/* Cold Chain Logistics SOP Alert Banner */}
            <div className="bg-[#FFF8E1] border border-[#FFA000]/30 p-4 rounded-xl flex items-start gap-3 text-[#E65100]">
              <AlertCircle size={22} className="text-[#FF8F00] flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold leading-tight">
                  Pemberitahuan Penyimpanan (SOP Callme Yoghurt):
                </p>
                <p className="text-xs leading-relaxed font-medium">
                  Hanya tahan 3 hari di suhu ruang. Langsung segera masukan kulkas begitu barang diterima (Suhu &lt; 5°C).
                </p>
                <p className="text-[11px] text-[#BF360C]/80">
                  Penanganan pengiriman mengikuti SOP produk dairy Callme Yoghurt.
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT: Order Summary & Cost Summary */}
          <div className="lg:col-span-5">
            <div className="bg-white p-5 sm:p-7 rounded-2xl shadow-xs border border-[#E5E2DA] sticky top-8 space-y-5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="font-extrabold text-base sm:text-lg text-[#1c1917]">Ringkasan Pesanan</h2>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32]">
                  {items.reduce((acc, i) => acc + i.quantity, 0)} item
                </span>
              </div>

              {/* Items List */}
              <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-1">
                <AnimatePresence initial={false}>
                  {items.map((item) => (
                    <motion.div
                      key={item.variant_id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0, padding: 0 }}
                      transition={{ duration: MOTION_TOKENS.duration.fast }}
                      className="flex items-center gap-3 bg-gray-50/80 p-3 rounded-xl border border-gray-100 overflow-hidden"
                    >
                      <div className="w-12 h-12 rounded-lg bg-[#E8F5E9]/60 border border-[#2E7D32]/10 flex items-center justify-center p-1 relative flex-shrink-0 overflow-hidden">
                        <Image
                          src={getItemArtwork(item)}
                          alt={item.name}
                          fill
                          sizes="48px"
                          className="object-contain p-0.5"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs sm:text-sm text-[#1c1917] truncate">{item.name}</h4>
                        <p className="text-[11px] font-medium text-black/60 mt-0.5">
                          {item.volume_ml === 1000 ? '1 Liter' : `${item.volume_ml || 250} ml`} • Qty: <strong>{item.quantity}</strong>
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="font-extrabold text-xs sm:text-sm text-[#2E7D32] block">
                          Rp {(item.display_price * item.quantity).toLocaleString('id-ID')}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItem(item.variant_id)}
                          className="text-[11px] text-red-500 font-medium hover:underline cursor-pointer"
                        >
                          Hapus
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Cost Summary */}
              <div className="border-t border-gray-100 pt-4 space-y-2.5 text-sm">
                {/* 1. Subtotal Produk */}
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-black/60 font-medium">Subtotal Produk</span>
                  <span className="text-sm font-bold text-black/80">
                    Rp {subtotal.toLocaleString('id-ID')}
                  </span>
                </div>

                {/* 2. Ongkir */}
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-black/60 font-medium">
                    Ongkir {selectedQuote ? `(${selectedQuote.courier_name} ${selectedQuote.service_name})` : ''}
                  </span>
                  <span className="text-sm font-bold text-black/80">
                    {selectedQuote
                      ? `Rp ${shippingFee.toLocaleString('id-ID')}`
                      : 'Ongkir belum dapat dihitung'}
                  </span>
                </div>

                {/* 3. Biaya Layanan (Phase 1.7C.19A) */}
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-black/60 font-medium">Biaya Layanan</span>
                  <span className="text-sm font-bold text-black/80">
                    {serviceFee > 0
                      ? `Rp ${serviceFee.toLocaleString('id-ID')}`
                      : serviceFeeConfig?.isConfigured && typeof serviceFeeConfig.amount === 'number'
                      ? `Rp ${serviceFeeConfig.amount.toLocaleString('id-ID')}`
                      : 'Konfigurasi belum ditentukan'}
                  </span>
                </div>

                {/* Penanganan Rantai Dingin Reassurance */}
                <div className="flex items-baseline justify-between pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-black/60 font-medium">SOP Pengiriman Dairy</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#E8F5E9] text-[#2E7D32]">
                      SOP 01
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-[#2E7D32]">
                    Sesuai Standar Mutu
                  </span>
                </div>

                {/* 4. Total Pembayaran (Task 13) */}
                <div className="border-t border-gray-100 pt-3 flex items-baseline justify-between">
                  <div>
                    <span className="font-extrabold text-base text-[#1c1917] block">Total Pembayaran</span>
                    <span className="text-[10px] text-black/40 block">Termasuk ongkir kurir & biaya layanan</span>
                  </div>
                  <motion.span
                    key={totalPayment}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: MOTION_TOKENS.duration.fast }}
                    className="text-xl sm:text-2xl font-black text-[#2E7D32] tracking-tight"
                  >
                    Rp {totalPayment.toLocaleString('id-ID')}
                  </motion.span>
                </div>
              </div>

              {/* Submit Button */}
              <motion.button
                type="submit"
                form="checkout-form"
                disabled={
                  isLoading ||
                  isCalculatingShipping ||
                  !selectedQuote ||
                  !serviceFeeConfig?.isConfigured ||
                  !formData.paymentMethod
                }
                whileHover={
                  isLoading ||
                  isCalculatingShipping ||
                  !selectedQuote ||
                  !serviceFeeConfig?.isConfigured ||
                  !formData.paymentMethod ||
                  shouldReduceMotion
                    ? undefined
                    : { scale: 1.01 }
                }
                whileTap={
                  isLoading ||
                  isCalculatingShipping ||
                  !selectedQuote ||
                  !serviceFeeConfig?.isConfigured ||
                  !formData.paymentMethod ||
                  shouldReduceMotion
                    ? undefined
                    : { scale: 0.98 }
                }
                className="w-full bg-[#2E7D32] hover:bg-[#256628] active:bg-[#1B5E20] text-white py-3.5 rounded-full font-extrabold text-sm sm:text-base transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-h-[50px]"
              >
                {isLoading ? (
                  <span className="animate-pulse">Memproses Pesanan...</span>
                ) : !selectedQuote ? (
                  <span>Hitung & Pilih Ongkir Terlebih Dahulu</span>
                ) : !serviceFeeConfig?.isConfigured ? (
                  <span>Konfigurasi Biaya Layanan Belum Lengkap</span>
                ) : !formData.paymentMethod ? (
                  <span>Pilih Metode Pembayaran Terlebih Dahulu</span>
                ) : (
                  <>
                    <Truck size={18} />
                    <span>Selesaikan Pesanan</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



