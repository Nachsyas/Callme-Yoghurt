'use client';

import { useCartStore } from '@/store/cartStore';
import {
  ArrowLeft,
  Award,
  Check,
  Clock,
  Heart,
  Info,
  Leaf,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Snowflake,
  Sparkles,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { MOTION_TOKENS } from '@/lib/motion';
import {
  getProductPresentation,
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
}

// Visual presentation metadata for known flavors (fallback and styling only, not price or variant authority)
const FLAVORS: Record<string, FlavorData> = {
  plain: {
    name: 'Plain',
    brandColor: '#cba258',
    darkBg: '#271900',
    tagline: 'Yoghurt rasa Plain.',
    description: 'Yoghurt rasa Plain.',
  },
  stroberi: {
    name: 'Stroberi',
    brandColor: '#D81E5B',
    darkBg: '#3b1c21',
    tagline: 'Yoghurt rasa Stroberi.',
    description: 'Yoghurt rasa Stroberi.',
  },
  mangga: {
    name: 'Mangga',
    brandColor: '#F9A03F',
    darkBg: '#3d230d',
    tagline: 'Yoghurt rasa Mangga.',
    description: 'Yoghurt rasa Mangga.',
  },
  melon: {
    name: 'Melon',
    brandColor: '#A1C349',
    darkBg: '#232d0f',
    tagline: 'Yoghurt rasa Melon.',
    description: 'Yoghurt rasa Melon.',
  },
  anggur: {
    name: 'Anggur',
    brandColor: '#7A3B69',
    darkBg: '#3B1C33',
    tagline: 'Yoghurt rasa Anggur.',
    description: 'Yoghurt rasa Anggur.',
  },
  leci: {
    name: 'Leci',
    brandColor: '#ff8da1',
    darkBg: '#4a1523',
    tagline: 'Yoghurt rasa Leci.',
    description: 'Yoghurt rasa Leci.',
  },
  vanila: {
    name: 'Vanila',
    brandColor: '#f3e5AB',
    darkBg: '#3d361c',
    tagline: 'Yoghurt rasa Vanila.',
    description: 'Yoghurt rasa Vanila.',
  },
};

// Retained for catalog invariant test compliance (catalog-validation.test.ts)
const FLAVOR_IMAGES: Record<string, string> = {
  plain: '/images/plain.png',
  stroberi: '/images/stroberi.png',
  mangga: '/images/mangga.png',
  melon: '/images/melon.png',
  anggur: '/images/anggur.png',
  leci: '/images/leci.png',
  vanila: '/images/vanila.png',
};

// Official confirmed 250/500ml artwork from owner
const OFFICIAL_PRODUCT_ARTWORK: Record<string, string> = {
  plain: '/images/products/plain-250-500.png',
  stroberi: '/images/products/stroberi-250-500.png',
  mangga: '/images/products/mangga-250-500.png',
  melon: '/images/products/melon-250-500.png',
  anggur: '/images/products/anggur-250-500.png',
  leci: '/images/products/leci-250-500.png',
  vanila: '/images/products/vanila-250-500.png',
};

type FlavorKey = keyof typeof FLAVORS;
export type ProductSize = 250 | 500 | 1000;

// Standard catalog preview pricing for display fallback when ERP is offline (Phase 1.7C.2: 16k / 30k / 55k)
const PREVIEW_PRICES: Record<ProductSize, number> = {
  250: 16000,
  500: 30000,
  1000: 55000,
};

const FLAVOR_UUID_INDEX: Record<string, string> = {
  plain: '0001',
  stroberi: '0002',
  mangga: '0003',
  melon: '0004',
  anggur: '0005',
  leci: '0006',
  vanila: '0007',
};

const SLUG_ALIASES: Record<string, string> = {
  strawberry: 'stroberi',
  vanilla: 'vanila',
};

function getFallbackVariant(slug: string, displayName: string, size: ProductSize): PublicCatalogVariant {
  const flavorIndex = FLAVOR_UUID_INDEX[slug] || '0099';
  const sizeIndex = size === 250 ? '000000000001' : size === 500 ? '000000000002' : '000000000003';
  const variantId = `01940a00-${flavorIndex}-7000-8000-${sizeIndex}`;
  const price = PREVIEW_PRICES[size];
  const sizeLabel = size === 1000 ? '1000ml' : `${size}ml`;

  return {
    variant_id: variantId,
    sku: `CY-${slug.toUpperCase()}-${size}`,
    name: `${displayName} ${sizeLabel}`,
    net_content: {
      quantity: `${size}.000000`,
      uom: 'ML',
    },
    price: {
      currency: 'IDR',
      amount: price,
    },
  };
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const rawSlug = id.trim().toLowerCase();
  const requestedSlug = SLUG_ALIASES[rawSlug] || rawSlug;
  const presentation = getProductPresentation(requestedSlug);
  const isKnownFlavor = requestedSlug in FLAVORS;

  const visualFlavorKey = (isKnownFlavor ? requestedSlug : 'plain') as FlavorKey;
  const fallbackFlavor = FLAVORS[visualFlavorKey];

  const [selectedSize, setSelectedSize] = useState<ProductSize>(250);
  const [quantity, setQuantity] = useState<number>(1);
  const [catalogLoading, setCatalogLoading] = useState<boolean>(true);
  const [catalogLoaded, setCatalogLoaded] = useState<boolean>(false);
  const [catalogOnline, setCatalogOnline] = useState<boolean>(false);
  const [erpProduct, setErpProduct] = useState<PublicCatalogProduct | null>(null);
  const [added, setAdded] = useState<boolean>(false);

  const addItem = useCartStore((state) => state.addItem);
  const items = useCartStore((state) => state.items);
  const openCart = useCartStore((state) => state.openCart);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    let isMounted = true;
    async function loadCatalog() {
      try {
        const res = await fetch('/api/catalog');
        if (!res.ok) {
          if (isMounted) {
            setCatalogLoading(false);
            setCatalogLoaded(true);
            setCatalogOnline(false);
          }
          return;
        }
        const data: PublicCatalogData = await res.json();
        if (isMounted) {
          const matched = data.products?.find(
            (p: PublicCatalogProduct) => p.slug.toLowerCase() === requestedSlug
          );
          setErpProduct(matched || null);
          setCatalogOnline(true);
          setCatalogLoading(false);
          setCatalogLoaded(true);
        }
      } catch {
        if (isMounted) {
          setCatalogLoading(false);
          setCatalogLoaded(true);
          setCatalogOnline(false);
        }
      }
    }
    loadCatalog();
    return () => {
      isMounted = false;
    };
  }, [requestedSlug]);

  // Dynamic ERP Authority:
  // Legitimate ERP products must never 404 simply because they lack hardcoded presentation entry.
  // Unknown / nonexistent slug must 404 whenever catalog is online and product does not exist in ERP.
  if (catalogLoaded) {
    if (catalogOnline) {
      if (!erpProduct) {
        notFound();
      }
    } else {
      if (!isKnownFlavor) {
        notFound();
      }
    }
  }

  // Authoritative names and content from ERP
  const displayName = erpProduct?.name || fallbackFlavor.name;
  const displayTagline = erpProduct?.description || fallbackFlavor.tagline;
  const brandColor = presentation.brandColor;
  // Size-specific image mapping:
  // - 1000ml (1 Liter): Official 1L bottle artwork (/images/{slug}.png)
  // - 250ml / 500ml: Official 250/500ml bottle artwork (/images/products/{slug}-250-500.png)
  const image1L =
    (isKnownFlavor ? FLAVOR_IMAGES[requestedSlug] : undefined) || presentation.artwork;
  const image250_500 =
    (isKnownFlavor ? OFFICIAL_PRODUCT_ARTWORK[requestedSlug] : undefined) || presentation.artwork;
  const currentImageSrc =
    selectedSize === 1000 ? image1L : image250_500;

  // Authoritative variant matching from ERP via exact net content parsing (250ml, 500ml, 1000ml)
  const erpVariant250 = erpProduct?.variants.find((v: PublicCatalogVariant) => {
    const ml = parseNetContentMl(v.net_content?.quantity, v.net_content?.uom);
    return ml === 250;
  });

  const erpVariant500 = erpProduct?.variants.find((v: PublicCatalogVariant) => {
    const ml = parseNetContentMl(v.net_content?.quantity, v.net_content?.uom);
    return ml === 500;
  });

  const erpVariant1000 = erpProduct?.variants.find((v: PublicCatalogVariant) => {
    const ml = parseNetContentMl(v.net_content?.quantity, v.net_content?.uom);
    return ml === 1000;
  });

  // Storefront fallback variants for interaction when ERP connectivity is not yet available (Task 2)
  const fallback250 = getFallbackVariant(requestedSlug, displayName, 250);
  const fallback500 = getFallbackVariant(requestedSlug, displayName, 500);
  const fallback1000 = getFallbackVariant(requestedSlug, displayName, 1000);

  const variant250 = erpVariant250 || fallback250;
  const variant500 = erpVariant500 || fallback500;
  const variant1000 = erpVariant1000 || fallback1000;

  const has250Variant = Boolean(variant250);
  const has500Variant = Boolean(variant500);
  const has1000Variant = Boolean(variant1000);

  const price250 = variant250.price.amount;
  const price500 = variant500.price.amount;
  const price1000 = variant1000.price.amount;

  const currentVariant =
    selectedSize === 250 ? variant250 : selectedSize === 500 ? variant500 : variant1000;
  const hasCurrentVariant = Boolean(currentVariant);
  const currentPrice = currentVariant.price.amount;

  // Visual scale mapping (250 = 0.90, 500 = 1.00, 1000 = 1.00 neutral)
  const currentScale = selectedSize === 250 ? 0.90 : 1.00;

  const handleAddToCart = () => {
    if (!currentVariant) return;

    addItem({
      variant_id: currentVariant.variant_id,
      sku: currentVariant.sku,
      name: currentVariant.name,
      volume_ml: selectedSize,
      quantity: quantity,
      display_price: currentVariant.price.amount,
      image_url: currentImageSrc,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
    openCart();
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
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-black/60 hover:text-[#2E7D32] transition-colors"
            >
              <ArrowLeft size={16} />
              <span>Kembali ke Menu</span>
            </Link>
          </div>

          <Link href="/" className="font-extrabold text-lg text-[#2E7D32] tracking-tight">
            Callme Yoghurt
          </Link>

          <button
            type="button"
            onClick={openCart}
            aria-label="Buka Keranjang Belanja"
            className="flex items-center gap-2 px-4 py-2 bg-[#2E7D32] text-white rounded-full font-semibold text-xs hover:bg-[#256628] active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            <ShoppingBag size={14} />
            <span>Keranjang</span>
            {items.length > 0 && (
              <span className="bg-[#E8F5E9] text-[#2E7D32] text-[10px] font-black rounded-full px-1.5 py-0.2 min-w-[16px] text-center">
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
            transition={{ duration: shouldReduceMotion ? 0.01 : MOTION_TOKENS.duration.normal, ease: MOTION_TOKENS.ease.out }}
            className="lg:col-span-5 flex flex-col items-center"
          >
            {/* Square Container: Desktop 350-400px (max-w-[380px]), Mobile 250-300px (max-w-[280px]) */}
            <div className="w-full max-w-[280px] sm:max-w-[340px] lg:max-w-[380px] aspect-square mx-auto bg-white rounded-2xl shadow-sm border border-black/5 p-4 sm:p-6 relative flex items-center justify-center overflow-hidden">
              {/* Flavor Tag */}
              <div className="absolute top-3.5 left-3.5 z-10">
                <span
                  className="text-white font-bold text-[11px] px-3 py-1 rounded-full shadow-sm tracking-wide block"
                  style={{ backgroundColor: brandColor }}
                >
                  Varian Resmi
                </span>
              </div>

              {/* Cold Chain Badge */}
              <div className="absolute top-3.5 right-3.5 z-10">
                <span className="bg-[#1E3932] text-white font-bold text-[10px] px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                  <Snowflake size={11} className="text-emerald-300" />
                  <span>0–5°C</span>
                </span>
              </div>

              {/* Product Visual Area: Updates image and scale according to selected size */}
              <motion.div
                key={selectedSize}
                animate={{ scale: currentScale }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { duration: MOTION_TOKENS.duration.fast, ease: MOTION_TOKENS.ease.out }
                }
                className="relative w-full h-full flex items-center justify-center"
              >
                {currentImageSrc ? (
                  <Image
                    src={currentImageSrc}
                    alt={`${displayName} ${selectedSize === 1000 ? '1 Liter' : `${selectedSize} ml`}`}
                    fill
                    sizes="(max-width: 640px) 280px, (max-width: 1024px) 340px, 380px"
                    className="object-contain p-2 drop-shadow-md"
                    priority
                  />
                ) : (
                  <div className="w-28 h-40 rounded-2xl bg-black/5 border border-black/10 flex flex-col items-center justify-center text-black/50 p-2">
                    <span className="font-extrabold text-3xl tracking-tight">{displayName.slice(0, 2).toUpperCase()}</span>
                    <span className="text-xs font-semibold mt-1">{selectedSize === 1000 ? '1 Liter' : `${selectedSize} ml`}</span>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Quality Badges below image */}
            <div className="w-full max-w-[380px] mt-4 grid grid-cols-3 gap-2 px-1 text-[11px] font-medium">
              <span className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-[#E8F5E9] text-[#2E7D32] rounded-lg border border-[#2E7D32]/15">
                <Snowflake size={13} className="text-[#2E7D32]" />
                <span className="text-[10px] font-bold">0–5°C Dingin</span>
              </span>
              <span className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-[#E8F5E9] text-[#2E7D32] rounded-lg border border-[#2E7D32]/15">
                <ShieldCheck size={13} className="text-[#2E7D32]" />
                <span className="text-[10px] font-bold">CPPOB</span>
              </span>
              <span className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-[#E8F5E9] text-[#2E7D32] rounded-lg border border-[#2E7D32]/15">
                <Award size={13} className="text-[#2E7D32]" />
                <span className="text-[10px] font-bold">HAKI Resmi</span>
              </span>
            </div>
          </motion.div>

          {/* RIGHT COLUMN: Product Information & Purchase Hierarchy */}
          <motion.div
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0.01 : MOTION_TOKENS.duration.normal, delay: 0.05 }}
            className="lg:col-span-7 flex flex-col space-y-6"
          >
            {/* 1. Header & Title */}
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#2E7D32] block mb-1.5">
                Katalog Resmi Callme Yoghurt
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1c1917] tracking-tight mb-2">
                {displayName}
              </h1>
              <p className="text-sm sm:text-base text-black/70 leading-relaxed font-normal">
                {displayTagline}
              </p>
            </div>

            {/* 2. Price Section */}
            <div className="border-y border-[#E5E2DA] py-4 flex items-baseline justify-between bg-[#E8F5E9]/30 -mx-4 sm:-mx-6 px-4 sm:px-6 rounded-xl">
              <div>
                <span className="text-xs font-semibold text-black/50 block">Harga Satuan</span>
                <motion.span
                  key={selectedSize}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: shouldReduceMotion ? 0.01 : MOTION_TOKENS.duration.fast }}
                  className="text-3xl font-extrabold text-[#2E7D32] tracking-tight block"
                >
                  Rp {currentPrice.toLocaleString('id-ID')}
                </motion.span>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-xs font-bold border border-[#2E7D32]/25 shadow-xs">
                  <span>Ukuran:</span>
                  <strong>{selectedSize === 1000 ? '1 Liter' : `${selectedSize} ml`}</strong>
                </span>
              </div>
            </div>

            {/* 3. Variant Size Selector (250 ml, 500 ml, 1 Liter) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-black/70">
                  Pilih Ukuran
                </label>
                <span className="text-[11px] text-black/50 font-medium">
                  {selectedSize === 250
                    ? 'Kemasan Praktis Sekali Minum'
                    : selectedSize === 500
                      ? 'Ukuran Pas Sehari-hari'
                      : 'Kemasan Keluarga Hemat'}
                </span>
              </div>

              {/* 3-Column Variant Grid */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3 max-w-lg">
                {/* 250 ml Variant Button */}
                <button
                  type="button"
                  onClick={() => setSelectedSize(250)}
                  className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer active:scale-[0.99] ${
                    selectedSize === 250
                      ? 'border-[#2E7D32] bg-[#2E7D32] text-white shadow-md'
                      : 'border-[#E5E2DA] hover:border-[#2E7D32]/50 bg-white text-[#1c1917]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`font-extrabold text-sm ${selectedSize === 250 ? 'text-white' : 'text-[#1c1917]'}`}>
                      250 ml
                    </span>
                    {selectedSize === 250 ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-white ring-2 ring-white/50" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-black/10" />
                    )}
                  </div>
                  <div className={`font-bold text-xs mt-1.5 ${selectedSize === 250 ? 'text-emerald-100' : 'text-black/70'}`}>
                    Rp {price250.toLocaleString('id-ID')}
                  </div>
                  <div className="mt-2.5 flex items-center gap-1 text-[10px] font-semibold">
                    {selectedSize === 250 ? (
                      <span className="inline-flex items-center gap-1 bg-white/20 text-white px-2 py-0.5 rounded-full">
                        <Check size={11} />
                        <span>Terpilih</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[#2E7D32]">
                        <Check size={11} />
                        <span>Varian aktif</span>
                      </span>
                    )}
                  </div>
                </button>

                {/* 500 ml Variant Button */}
                <button
                  type="button"
                  onClick={() => setSelectedSize(500)}
                  className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer active:scale-[0.99] ${
                    selectedSize === 500
                      ? 'border-[#2E7D32] bg-[#2E7D32] text-white shadow-md'
                      : 'border-[#E5E2DA] hover:border-[#2E7D32]/50 bg-white text-[#1c1917]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`font-extrabold text-sm ${selectedSize === 500 ? 'text-white' : 'text-[#1c1917]'}`}>
                      500 ml
                    </span>
                    {selectedSize === 500 ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-white ring-2 ring-white/50" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-black/10" />
                    )}
                  </div>
                  <div className={`font-bold text-xs mt-1.5 ${selectedSize === 500 ? 'text-emerald-100' : 'text-black/70'}`}>
                    Rp {price500.toLocaleString('id-ID')}
                  </div>
                  <div className="mt-2.5 flex items-center gap-1 text-[10px] font-semibold">
                    {selectedSize === 500 ? (
                      <span className="inline-flex items-center gap-1 bg-white/20 text-white px-2 py-0.5 rounded-full">
                        <Check size={11} />
                        <span>Terpilih</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[#2E7D32]">
                        <Check size={11} />
                        <span>Varian aktif</span>
                      </span>
                    )}
                  </div>
                </button>

                {/* 1 Liter Variant Button */}
                <button
                  type="button"
                  onClick={() => setSelectedSize(1000)}
                  className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer active:scale-[0.99] ${
                    selectedSize === 1000
                      ? 'border-[#2E7D32] bg-[#2E7D32] text-white shadow-md'
                      : 'border-[#E5E2DA] hover:border-[#2E7D32]/50 bg-white text-[#1c1917]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`font-extrabold text-sm ${selectedSize === 1000 ? 'text-white' : 'text-[#1c1917]'}`}>
                      1 Liter
                    </span>
                    {selectedSize === 1000 ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-white ring-2 ring-white/50" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-black/10" />
                    )}
                  </div>
                  <div className={`font-bold text-xs mt-1.5 ${selectedSize === 1000 ? 'text-emerald-100' : 'text-black/70'}`}>
                    Rp {price1000.toLocaleString('id-ID')}
                  </div>
                  <div className="mt-2.5 flex items-center gap-1 text-[10px] font-semibold">
                    {selectedSize === 1000 ? (
                      <span className="inline-flex items-center gap-1 bg-white/20 text-white px-2 py-0.5 rounded-full">
                        <Check size={11} />
                        <span>Terpilih</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[#2E7D32]">
                        <Check size={11} />
                        <span>Varian aktif</span>
                      </span>
                    )}
                  </div>
                </button>
              </div>
            </div>

            {/* 4. Cold Chain Logistics Fulfillment Info */}
            <div className="p-3.5 bg-[#E8F5E9]/60 rounded-xl border border-[#2E7D32]/20 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#2E7D32]">
                <Snowflake size={14} className="text-[#2E7D32]" />
                <span>Distribusi Rantai Dingin (0–5°C) — Jakarta Hub</span>
              </div>
              <p className="text-[11px] text-[#1B5E20]/80 flex items-center gap-1.5 font-medium">
                <Clock size={12} className="text-[#2E7D32]" />
                <span>
                  Pengiriman dingin terjaga dengan coolpack khusus untuk menjamin kesegaran rasa.
                </span>
              </p>
            </div>

            {/* 5. Quantity Stepper & Add to Cart Purchase Action */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E2DA] shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 bg-[#E8F5E9]/40 border border-[#2E7D32]/20 rounded-full px-2 py-1.5">
                  <button
                    type="button"
                    onClick={decreaseQty}
                    aria-label="Kurangi jumlah"
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-white hover:bg-[#E8F5E9] active:scale-90 transition-transform cursor-pointer border border-[#2E7D32]/10"
                  >
                    <Minus size={14} className="text-[#2E7D32]" />
                  </button>
                  <span className="font-bold text-base w-6 text-center text-[#1c1917]">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={increaseQty}
                    aria-label="Tambah jumlah"
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-white hover:bg-[#E8F5E9] active:scale-90 transition-transform cursor-pointer border border-[#2E7D32]/10"
                  >
                    <Plus size={14} className="text-[#2E7D32]" />
                  </button>
                </div>

                <div className="text-right">
                  <span className="block text-[11px] text-black/50 font-medium">Estimasi Subtotal</span>
                  <span className="font-extrabold text-xl text-[#2E7D32] tracking-tight">
                    Rp {(currentPrice * quantity).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <motion.button
                type="button"
                onClick={handleAddToCart}
                whileHover={shouldReduceMotion ? undefined : { scale: 1.01 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                className={`w-full text-white py-3.5 px-6 rounded-full font-extrabold text-sm sm:text-base transition-all flex items-center justify-center gap-2.5 shadow-md ${
                  added
                    ? 'bg-[#1B5E20] shadow-[#1B5E20]/30 cursor-pointer'
                    : 'bg-[#2E7D32] hover:bg-[#256628] active:bg-[#1B5E20] shadow-[#2E7D32]/25 cursor-pointer'
                }`}
              >
                {added ? (
                  <>
                    <Check size={18} className="text-white" />
                    <span>Berhasil Ditambahkan ke Keranjang!</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart size={18} />
                    <span>Tambah ke Keranjang</span>
                    <span className="sr-only">Tambahkan ke Pesanan</span>
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#2E7D32] flex items-center gap-2">
                <Leaf size={14} />
                <span>Informasi Komposisi</span>
              </h3>
              <p className="text-xs text-black/70 leading-relaxed">
                Informasi komposisi mengikuti label produk resmi.
              </p>
            </div>

            {/* Nutrition Facts */}
            <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#2E7D32] flex items-center gap-2">
                <Info size={14} />
                <span>Informasi Nilai Gizi</span>
              </h3>
              <p className="text-xs text-black/70 leading-relaxed">
                Informasi gizi akan diperbarui berdasarkan label produk resmi.
              </p>
            </div>

            {/* Cold Chain Storage Instructions (Mandatory SOP 01) */}
            <div className="bg-[#f0f5f2] p-6 rounded-2xl border border-[#2E7D32]/20 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#2E7D32] flex items-center gap-2">
                <Snowflake size={14} />
                <span>Penyimpanan Rantai Dingin</span>
              </h3>
              <div className="space-y-2 text-xs text-black/75 leading-relaxed">
                <p>
                  <strong>Suhu Optimal:</strong> Simpan segera di kulkas pada suhu{' '}
                  <strong className="text-[#2E7D32]">0–5°C</strong>.
                </p>
                <p>
                  <strong>Ketahanan Produk:</strong> Hanya tahan 3 hari di suhu ruang. Langsung segera masukan kulkas begitu barang diterima.
                </p>
                <p>
                  <strong>Peringatan Mutu:</strong> Jangan dibekukan di dalam freezer atau dibiarkan di
                  suhu ruang lebih dari 4 jam untuk menjaga kualitas kesegaran yoghurt.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Checkout Cart Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <motion.button
          type="button"
          onClick={openCart}
          whileHover={shouldReduceMotion ? undefined : { scale: 1.08 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
          aria-label="Buka Keranjang Belanja"
          className="relative flex items-center justify-center bg-[#2E7D32] hover:bg-[#256628] text-white rounded-full w-14 h-14 shadow-lg cursor-pointer transition-colors"
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
      <footer className="mt-20 border-t border-black/5 bg-white py-8 text-center text-xs text-black/40">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 Callme Yoghurt Cipayung. Seluruh hak cipta dilindungi.</p>
          <div className="mt-2 flex justify-center gap-4 text-black/60 font-medium">
            <span>Bambu Apus, Cipayung, Jakarta Timur</span>
            <span>•</span>
            <span>Cold Chain Standard (0–5°C)</span>
            <span>•</span>
            <span>HAKI IDM000981336</span>
          </div>
        </div>
      </footer>

      {/* Cart Drawer */}
      <CartDrawer />
    </div>
  );
}
