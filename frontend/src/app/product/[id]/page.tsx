'use client';

import { useCartStore } from '@/store/cartStore';
import {
  ArrowLeft,
  Check,
  Clock,
  Heart,
  Info,
  Leaf,
  Minus,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Snowflake,
  Sparkles,
  ThumbsUp,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { MOTION_TOKENS } from '@/lib/motion';
import {
  parseNetContentMl,
  type PublicCatalogData,
  type PublicCatalogProduct,
  type PublicCatalogVariant,
} from '@/lib/catalog';

interface FlavorData {
  name: string;
  brandColor: string;
  darkBg: string;
  tagline: string;
  description: string;
  ingredients: string[];
  nutrition: {
    calories: string;
    protein: string;
    fat: string;
    sugar: string;
  };
}

const FLAVORS: Record<string, FlavorData> = {
  plain: {
    name: 'Plain Pure Original',
    brandColor: '#cba258',
    darkBg: '#271900',
    tagline: 'Yogurt stirred murni tanpa tambahan gula.',
    description:
      'Yogurt stirred murni tanpa tambahan gula dengan tekstur super kental, lembut, dan creamy kualitas homemade terbaik.',
    ingredients: [
      'Yogurt kental murni (99,5%)',
      'Kultur Bakteri Probiotik Hidup (L. Bulgaricus, S. Thermophilus, L. Acidophilus)',
    ],
    nutrition: { calories: '110kcal', protein: '8.5g', fat: '3.2g', sugar: '0g' },
  },
  stroberi: {
    name: 'Stroberi Summer Blush',
    brandColor: '#D81E5B',
    darkBg: '#3b1c21',
    tagline: 'Paduan rasa stroberi buah segar aromatik.',
    description:
      'Paduan rasa stroberi buah segar aromatik dengan yogurt kental premium dan tambahan topping jelly / nata de coco yang kenyal.',
    ingredients: [
      'Yogurt kental (86,3%)',
      'Gula pasir murni',
      'Perisa stroberi buah alami',
      'Topping Jelly / Nata de Coco',
    ],
    nutrition: { calories: '120kcal', protein: '8g', fat: '3g', sugar: '12g' },
  },
  mangga: {
    name: 'Mangga Tropical Gold',
    brandColor: '#F9A03F',
    darkBg: '#3d230d',
    tagline: 'Kombinasi rasa asam manis segar eksotis.',
    description:
      'Yogurt lembut stirred premium dengan mangga harum manis masak pohon pilihan. Kaya probiotik hidup.',
    ingredients: [
      'Yogurt kental (86,3%)',
      'Gula pasir murni',
      'Perisa mangga alami',
      'Topping Jelly / Nata de Coco',
    ],
    nutrition: { calories: '130kcal', protein: '7.5g', fat: '2.8g', sugar: '14g' },
  },
  melon: {
    name: 'Melon Emerald Fresh',
    brandColor: '#A1C349',
    darkBg: '#232d0f',
    tagline: 'Sensasi kesegaran buah melon premium berair.',
    description:
      'Kaya probiotik aktif untuk kesehatan pencernaan maksimal sehari-hari berpadu dengan kesegaran melon.',
    ingredients: [
      'Yogurt kental (86,3%)',
      'Gula pasir murni',
      'Perisa melon alami',
      'Topping Jelly / Nata de Coco',
    ],
    nutrition: { calories: '115kcal', protein: '8.2g', fat: '3g', sugar: '10g' },
  },
  anggur: {
    name: 'Anggur Royal Purple',
    brandColor: '#7A3B69',
    darkBg: '#3B1C33',
    tagline: 'Sensasi rasa anggur merah premium manis eksklusif.',
    description:
      'Dipadu dengan stirred yoghurt kental yang lembut, lengkap dengan sensasi mengunyah dari topping jelly.',
    ingredients: [
      'Yogurt kental (86,3%)',
      'Gula pasir murni',
      'Perisa anggur alami',
      'Topping Jelly / Nata de Coco',
    ],
    nutrition: { calories: '120kcal', protein: '8g', fat: '3g', sugar: '12g' },
  },
  leci: {
    name: 'Leci Sweet Bliss',
    brandColor: '#ff8da1',
    darkBg: '#4a1523',
    tagline: 'Rasa leci manis harum khas yang menyegarkan.',
    description:
      'Berpadu dengan kelembutan stirred yoghurt alami. Memberi kesegaran instan bernutrisi.',
    ingredients: [
      'Yogurt kental (86,3%)',
      'Gula pasir murni',
      'Perisa leci alami',
      'Topping Jelly / Nata de Coco',
    ],
    nutrition: { calories: '118kcal', protein: '8g', fat: '3g', sugar: '13g' },
  },
  vanila: {
    name: 'Vanila Velvet Orchid',
    brandColor: '#f3e5AB',
    darkBg: '#3d361c',
    tagline: 'Kehangatan rasa vanila klasik.',
    description:
      'Berpadu kentalnya susu fermentasi dari peternakan lokal terbaik. Halus, manis pas, dan menenangkan.',
    ingredients: [
      'Yogurt kental (86,3%)',
      'Gula pasir murni',
      'Perisa vanila alami',
      'Topping Jelly / Nata de Coco',
    ],
    nutrition: { calories: '125kcal', protein: '8.2g', fat: '3.5g', sugar: '12g' },
  },
};

const FLAVOR_IMAGES: Record<string, string> = {
  plain: '/images/plain.png',
  stroberi: '/images/stroberi.png',
  mangga: '/images/mangga.png',
  melon: '/images/melon.png',
  anggur: '/images/anggur.png',
  leci: '/images/leci.png',
  vanila: '/images/vanila.png',
};

type FlavorKey = keyof typeof FLAVORS;

// Standard catalog preview pricing for display fallback when ERP is offline
const PREVIEW_PRICES: Record<number, number> = {
  250: 15000,
  1000: 55000,
};

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  // Match visual presentation
  const requestedSlug = id.trim().toLowerCase();
  const isKnownFlavor = requestedSlug in FLAVORS;

  const visualFlavorKey = (isKnownFlavor ? requestedSlug : 'plain') as FlavorKey;
  const flavor = FLAVORS[visualFlavorKey];
  const imageSrc = FLAVOR_IMAGES[visualFlavorKey] || '/images/all-variants.png';

  const [selectedSize, setSelectedSize] = useState<250 | 1000>(250);
  const [quantity, setQuantity] = useState<number>(1);
  const [catalogLoading, setCatalogLoading] = useState<boolean>(true);
  const [erpProduct, setErpProduct] = useState<PublicCatalogProduct | null>(null);
  const [demoNoticeVisible, setDemoNoticeVisible] = useState<boolean>(false);
  const [added, setAdded] = useState<boolean>(false);

  const addItem = useCartStore((state) => state.addItem);
  const items = useCartStore((state) => state.items);
  const openCart = useCartStore((state) => state.openCart);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isKnownFlavor) {
      setCatalogLoading(false);
      return;
    }
    let isMounted = true;
    async function loadCatalog() {
      try {
        const res = await fetch('/api/catalog');
        if (!res.ok) {
          if (isMounted) setCatalogLoading(false);
          return;
        }
        const data: PublicCatalogData = await res.json();
        if (isMounted) {
          const matched = data.products?.find(
            (p: PublicCatalogProduct) => p.slug.toLowerCase() === requestedSlug
          );
          setErpProduct(matched || null);
          setCatalogLoading(false);
        }
      } catch {
        if (isMounted) setCatalogLoading(false);
      }
    }
    loadCatalog();
    return () => {
      isMounted = false;
    };
  }, [requestedSlug, isKnownFlavor]);

  // Ensure uncataloged route does NOT render another product.
  // Must render 404 Not Found with message "Produk tidak ditemukan".
  if (!isKnownFlavor) {
    notFound();
  }

  // Authoritative variant matching from ERP
  const variant250 = erpProduct?.variants.find((v: PublicCatalogVariant) => {
    const ml = parseNetContentMl(v.net_content?.quantity, v.net_content?.uom);
    return ml === 250;
  });

  const variant1000 = erpProduct?.variants.find((v: PublicCatalogVariant) => {
    const ml = parseNetContentMl(v.net_content?.quantity, v.net_content?.uom);
    return ml === 1000;
  });

  const isErpOnline = Boolean(erpProduct);

  // Variant availability logic
  // When ERP is online: strictly follow ERP variants
  // When ERP is offline: use Catalog Preview Mode (Part 4 specification)
  const is250Available = isErpOnline ? Boolean(variant250) : true;
  const is1000Available = isErpOnline ? Boolean(variant1000) : true;

  const price250 = variant250?.price.amount ?? PREVIEW_PRICES[250];
  const price1000 = variant1000?.price.amount ?? PREVIEW_PRICES[1000];

  const currentVariant = selectedSize === 250 ? variant250 : variant1000;
  const isCurrentAvailable = selectedSize === 250 ? is250Available : is1000Available;
  const currentPrice = selectedSize === 250 ? price250 : price1000;

  const handleAddToCart = () => {
    if (isErpOnline && currentVariant) {
      // Authoritative ERP Checkout Flow
      addItem({
        variant_id: currentVariant.variant_id,
        sku: currentVariant.sku,
        name: currentVariant.name,
        volume_ml: selectedSize,
        quantity: quantity,
        display_price: currentVariant.price.amount,
      });
      setAdded(true);
      setTimeout(() => setAdded(false), 1400);
      openCart();
    } else {
      // Catalog Preview Mode (ERP offline)
      addItem({
        variant_id: `preview-${requestedSlug}-${selectedSize}`,
        sku: `CY-${requestedSlug.toUpperCase().slice(0, 3)}-${selectedSize}`,
        name: `${flavor.name} ${selectedSize}ml (Preview)`,
        volume_ml: selectedSize,
        quantity: quantity,
        display_price: currentPrice,
      });
      setDemoNoticeVisible(true);
      setAdded(true);
      setTimeout(() => setAdded(false), 1400);
      openCart();
    }
  };

  const increaseQty = () => setQuantity((prev) => prev + 1);
  const decreaseQty = () => setQuantity((prev) => (prev > 1 ? prev - 1 : 1));

  return (
    <div className="bg-[#f7f5f0] text-[#1c1917] tracking-[-0.01em] min-h-screen font-sans antialiased">
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 w-full z-50 bg-[#f7f5f0]/95 backdrop-blur-md border-b border-black/5 h-16 flex items-center shadow-sm">
        <div className="flex justify-between items-center px-4 sm:px-6 w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-black/60 hover:text-[#00754A] transition-colors"
            >
              <ArrowLeft size={16} />
              <span>Kembali ke Menu</span>
            </Link>
          </div>

          <Link href="/" className="font-extrabold text-lg text-[#00754A] tracking-tight">
            Callme Yoghurt
          </Link>

          <button
            type="button"
            onClick={openCart}
            className="flex items-center gap-2 px-4 py-2 bg-[#00754A] text-white rounded-full font-semibold text-xs hover:bg-[#006241] active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            <ShoppingBag size={14} />
            <span>Keranjang</span>
            {items.length > 0 && (
              <span className="bg-[#A1C349] text-[#1E3932] text-[10px] font-black rounded-full px-1.5 py-0.2 min-w-[16px] text-center">
                {items.reduce((acc, i) => acc + i.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Breadcrumbs */}
        <nav className="mb-6 flex items-center gap-2 text-xs font-medium text-black/50">
          <Link href="/" className="hover:text-[#00754A] transition-colors">
            Menu
          </Link>
          <span>/</span>
          <span className="text-black/80 font-bold capitalize">{requestedSlug}</span>
        </nav>

        {/* E-Commerce Product Hero Grid (Desktop: Left Image 350-400px, Right Info) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* LEFT COLUMN: Product Image Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: MOTION_TOKENS.duration.normal, ease: MOTION_TOKENS.ease.out }}
            className="lg:col-span-5 flex flex-col items-center"
          >
            {/* Square Container: Desktop 350-400px (max-w-[380px]), Mobile 250-300px (max-w-[280px]) */}
            <div className="w-full max-w-[280px] sm:max-w-[340px] lg:max-w-[380px] aspect-square mx-auto bg-white rounded-2xl shadow-sm border border-black/5 p-4 sm:p-6 relative flex items-center justify-center overflow-hidden">
              {/* Flavor Tag */}
              <div className="absolute top-3.5 left-3.5 z-10">
                <span
                  className="text-white font-bold text-[11px] px-3 py-1 rounded-full shadow-sm tracking-wide block"
                  style={{ backgroundColor: flavor.brandColor }}
                >
                  Premium Varian
                </span>
              </div>

              {/* Cold Chain Badge */}
              <div className="absolute top-3.5 right-3.5 z-10">
                <span className="bg-[#1E3932] text-white font-bold text-[10px] px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                  <Snowflake size={11} className="text-emerald-300" />
                  <span>0°C – 4°C</span>
                </span>
              </div>

              {/* Real Product Image with Smooth Scale Transition */}
              <motion.div
                animate={{ scale: selectedSize === 1000 ? 1.05 : 0.95 }}
                transition={{ duration: MOTION_TOKENS.duration.normal, ease: MOTION_TOKENS.ease.out }}
                className="relative w-full h-full flex items-center justify-center"
              >
                <Image
                  src={imageSrc}
                  alt={flavor.name}
                  fill
                  sizes="(max-width: 640px) 280px, (max-width: 1024px) 340px, 380px"
                  className="object-contain p-2 drop-shadow-md"
                  priority
                />
              </motion.div>
            </div>

            {/* Quality Badges below image */}
            <div className="w-full max-w-[380px] mt-4 flex items-center justify-between px-2 text-[11px] text-black/60 font-medium">
              <span className="flex items-center gap-1">
                <Leaf size={13} className="text-emerald-600" />
                <span>100% Organik</span>
              </span>
              <span className="flex items-center gap-1">
                <Heart size={13} className="text-rose-500" />
                <span>Tanpa Pengawet</span>
              </span>
              <span className="flex items-center gap-1">
                <Sparkles size={13} className="text-amber-500" />
                <span>Homemade Kental</span>
              </span>
            </div>
          </motion.div>

          {/* RIGHT COLUMN: Product Information & Purchase Hierarchy */}
          <motion.div
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: MOTION_TOKENS.duration.normal, delay: 0.05 }}
            className="lg:col-span-7 flex flex-col space-y-6"
          >
            {/* 1. Header & Title */}
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#00754A] block mb-1.5">
                Kentalnya Nikmat • Homemade Quality
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1c1917] tracking-tight mb-2">
                {flavor.name}
              </h1>
              <p className="text-sm sm:text-base text-black/70 leading-relaxed font-normal">
                {flavor.description}
              </p>
            </div>

            {/* 2. Price Section */}
            <div className="border-y border-black/5 py-4 flex items-baseline justify-between">
              <div>
                <span className="text-xs font-semibold text-black/50 block">Harga Satuan</span>
                <motion.span
                  key={selectedSize}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: MOTION_TOKENS.duration.fast }}
                  className="text-3xl font-extrabold text-[#00754A] tracking-tight block"
                >
                  Rp {currentPrice.toLocaleString('id-ID')}
                </motion.span>
              </div>
              <span className="text-xs text-black/40 font-medium text-right">
                Ukuran: <strong>{selectedSize} ml</strong>
              </span>
            </div>

            {/* 3. ERP Status Notice (Catalog Preview Mode vs Live ERP) */}
            {!isErpOnline && !catalogLoading && (
              <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-3">
                <Info size={16} className="text-amber-700 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 leading-relaxed">
                  <strong>Mode Pratinjau Katalog</strong> — Menampilkan data estimasi produk.
                  Koneksi transaksi live tersambung otomatis saat backend ERP aktif.
                </div>
              </div>
            )}

            {/* 4. Variant Selection (Compact UX per Part 4 specification) */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-black/60">
                  Pilih Ukuran
                </label>
                <span className="text-[11px] text-black/40">
                  {selectedSize === 250 ? 'Kemasan Praktis Sekali Minum' : 'Kemasan Keluarga Hemat'}
                </span>
              </div>

              {/* Compact Variant Grid */}
              <div className="grid grid-cols-2 gap-3 max-w-lg">
                {/* 250 ml Variant Button */}
                <button
                  type="button"
                  disabled={!is250Available}
                  onClick={() => setSelectedSize(250)}
                  className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                    selectedSize === 250 && is250Available
                      ? 'border-2 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  } ${!is250Available ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer active:scale-[0.99]'}`}
                  style={{
                    borderColor:
                      selectedSize === 250 && is250Available ? flavor.brandColor : undefined,
                    backgroundColor:
                      selectedSize === 250 && is250Available
                        ? `${flavor.brandColor}0d`
                        : undefined,
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-sm text-[#1c1917]">250 ml</span>
                    {selectedSize === 250 && is250Available && (
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: flavor.brandColor }}
                      />
                    )}
                  </div>
                  <div className="font-semibold text-xs mt-1 text-black/70">
                    Rp {price250.toLocaleString('id-ID')}
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                    <Check size={12} />
                    <span>Tersedia</span>
                  </div>
                </button>

                {/* 1 Liter Variant Button */}
                <button
                  type="button"
                  disabled={!is1000Available}
                  onClick={() => setSelectedSize(1000)}
                  className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                    selectedSize === 1000 && is1000Available
                      ? 'border-2 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  } ${!is1000Available ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer active:scale-[0.99]'}`}
                  style={{
                    borderColor:
                      selectedSize === 1000 && is1000Available ? flavor.brandColor : undefined,
                    backgroundColor:
                      selectedSize === 1000 && is1000Available
                        ? `${flavor.brandColor}0d`
                        : undefined,
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-sm text-[#1c1917]">1 Liter</span>
                    {selectedSize === 1000 && is1000Available && (
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: flavor.brandColor }}
                      />
                    )}
                  </div>
                  <div className="font-semibold text-xs mt-1 text-black/70">
                    Rp {price1000.toLocaleString('id-ID')}
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                    <Check size={12} />
                    <span>Tersedia</span>
                  </div>
                </button>
              </div>
            </div>

            {/* 5. Availability Status & Cold Chain Logistics Indicator */}
            <div className="p-3 bg-white rounded-xl border border-black/5 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Stok Siap Kirim — Jakarta Central Cold Chain Hub (WH-COLD-JKT-01)</span>
              </div>
              <p className="text-[11px] text-black/50 flex items-center gap-1.5">
                <Clock size={12} className="text-black/40" />
                <span>
                  Pesanan sebelum 15:00 WIB dikirim hari yang sama dengan cooler bag khusus.
                </span>
              </p>
            </div>

            {/* 6. Quantity Stepper & Add to Cart Purchase Action */}
            <div className="bg-white p-5 rounded-2xl border border-black/5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 border border-gray-200 rounded-full px-2 py-1.5">
                  <button
                    type="button"
                    onClick={decreaseQty}
                    aria-label="Kurangi jumlah"
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 active:scale-90 transition-transform"
                  >
                    <Minus size={14} className="text-black/70" />
                  </button>
                  <span className="font-bold text-base w-6 text-center text-[#1c1917]">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={increaseQty}
                    aria-label="Tambah jumlah"
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 active:scale-90 transition-transform"
                  >
                    <Plus size={14} className="text-black/70" />
                  </button>
                </div>

                <div className="text-right">
                  <span className="block text-[11px] text-black/50 font-medium">Estimasi Total</span>
                  <span className="text-2xl font-extrabold text-[#00754A]">
                    Rp {(currentPrice * quantity).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <motion.button
                type="button"
                onClick={handleAddToCart}
                disabled={!isCurrentAvailable || catalogLoading}
                whileHover={shouldReduceMotion || !isCurrentAvailable ? undefined : { scale: 1.01 }}
                whileTap={shouldReduceMotion || !isCurrentAvailable ? undefined : { scale: 0.98 }}
                className={`w-full text-white py-3.5 rounded-full font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2.5 shadow-md cursor-pointer ${
                  !isCurrentAvailable || catalogLoading
                    ? 'opacity-50 cursor-not-allowed bg-gray-400'
                    : added
                      ? 'bg-[#1E3932]'
                      : 'hover:opacity-95'
                }`}
                style={{
                  backgroundColor:
                    !isCurrentAvailable || catalogLoading
                      ? undefined
                      : added
                        ? '#1E3932'
                        : flavor.brandColor,
                }}
              >
                {added ? (
                  <>
                    <Check size={18} className="text-[#A1C349]" />
                    <span>Berhasil Ditambahkan!</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart size={18} />
                    <span>
                      {catalogLoading
                        ? 'Memeriksa Katalog...'
                        : isCurrentAvailable
                          ? 'Tambahkan ke Pesanan'
                          : 'Varian Belum Tersedia'}
                    </span>
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </div>

        {/* BOTTOM SECTION: Ingredients, Nutrition Facts & Cold Chain Storage */}
        <div className="mt-12 sm:mt-16 pt-10 border-t border-black/10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Ingredients */}
            <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#00754A] flex items-center gap-2">
                <Leaf size={14} />
                <span>Komposisi Alami</span>
              </h3>
              <ul className="space-y-2.5 text-xs text-black/70">
                {flavor.ingredients.map((ing, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: flavor.brandColor }}
                    />
                    <span>{ing}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Nutrition Facts */}
            <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#00754A] flex items-center gap-2">
                <Info size={14} />
                <span>Informasi Nilai Gizi</span>
              </h3>
              <div className="space-y-2 text-xs divide-y divide-gray-100">
                <div className="flex justify-between items-center pt-1.5">
                  <span className="text-black/60">Kalori</span>
                  <span className="font-bold text-black/90">{flavor.nutrition.calories}</span>
                </div>
                <div className="flex justify-between items-center pt-1.5">
                  <span className="text-black/60">Protein</span>
                  <span className="font-bold text-black/90">{flavor.nutrition.protein}</span>
                </div>
                <div className="flex justify-between items-center pt-1.5">
                  <span className="text-black/60">Lemak</span>
                  <span className="font-bold text-black/90">{flavor.nutrition.fat}</span>
                </div>
                <div className="flex justify-between items-center pt-1.5">
                  <span className="text-black/60">Gula Alami</span>
                  <span className="font-bold text-black/90">{flavor.nutrition.sugar}</span>
                </div>
              </div>
            </div>

            {/* Cold Chain Storage Instructions (Mandatory SOP) */}
            <div className="bg-[#f0f5f2] p-6 rounded-2xl border border-[#00754A]/20 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#00754A] flex items-center gap-2">
                <Snowflake size={14} />
                <span>Instruksi Penyimpanan</span>
              </h3>
              <ul className="text-xs text-black/80 space-y-2 list-disc list-inside leading-relaxed">
                <li>
                  Hanya tahan <strong>3 hari di suhu ruang</strong>.
                </li>
                <li>
                  Tahan <strong>2 bulan</strong> di dalam kulkas (suhu &lt; 5°C).
                </li>
                <li>Segera masukkan ke kulkas begitu pesanan diterima.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Brand Story and Guarantee Section */}
        <section className="bg-[#1E3932] text-white rounded-2xl p-8 sm:p-12 mt-10 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <Leaf size={24} className="text-emerald-300" />
              </div>
              <h4 className="font-bold text-base">100% Organik</h4>
              <p className="text-xs text-white/70 leading-relaxed max-w-xs">
                Susu sapi organik segar yang diproses secara higienis setiap hari.
              </p>
            </div>
            <div className="flex flex-col items-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <Heart size={24} className="text-rose-300" />
              </div>
              <h4 className="font-bold text-base">Tanpa Pengawet</h4>
              <p className="text-xs text-white/70 leading-relaxed max-w-xs">
                Menjamin kesegaran probiotik hidup tanpa tambahan bahan kimia buatan.
              </p>
            </div>
            <div className="flex flex-col items-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <ThumbsUp size={24} className="text-amber-300" />
              </div>
              <h4 className="font-bold text-base">Rasa Premium</h4>
              <p className="text-xs text-white/70 leading-relaxed max-w-xs">
                Ekstrak buah murni memberikan sensasi rasa mewah sekelas kafe modern.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Floating Checkout Cart Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <motion.button
          type="button"
          onClick={openCart}
          whileHover={shouldReduceMotion ? undefined : { scale: 1.08 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
          aria-label="Buka Keranjang Belanja"
          className="relative flex items-center justify-center bg-[#00754A] hover:bg-[#006241] text-white rounded-full w-14 h-14 shadow-lg cursor-pointer transition-colors"
        >
          <ShoppingBag size={22} />
          {items.length > 0 && (
            <motion.span
              key={items.length}
              initial={shouldReduceMotion ? undefined : { scale: 1.3 }}
              animate={{ scale: 1 }}
              transition={{ duration: MOTION_TOKENS.duration.fast }}
              className="absolute -top-1 -right-1 bg-brand-strawberry text-white text-[11px] font-black rounded-full w-6 h-6 flex items-center justify-center border-2 border-white shadow-xs"
            >
              {items.reduce((acc, i) => acc + i.quantity, 0)}
            </motion.span>
          )}
        </motion.button>
      </div>

      {/* Footer */}
      <footer className="bg-[#1E3932] text-white mt-16 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-6 space-y-3">
              <span className="text-xl font-extrabold text-white block tracking-tight">
                Callme Yoghurt Cipayung
              </span>
              <p className="text-xs text-white/70 leading-relaxed">
                Bambu Kuning Residence Blok A No.3A RT.11/RW 01,
                <br />
                Bambu Apus, Cipayung, Jakarta Timur, 13890.
              </p>
              <p className="text-xs font-semibold text-white/80">
                WA: 081316353365 • Email: yoghurtcallme@gmail.com
              </p>
            </div>
            <div className="md:col-span-6 flex items-center md:justify-end text-xs text-white/50">
              <p>© 2026 Callme Yoghurt. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>

      {/* Cart Drawer */}
      <CartDrawer />
    </div>
  );
}
