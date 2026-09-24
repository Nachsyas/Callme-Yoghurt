"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { MOTION_TOKENS } from "@/lib/motion";
import {
  parseNetContentMl,
  type PublicCatalogProduct,
  type PublicCatalogVariant,
} from "@/lib/catalog";

export type FlavorSize = 250 | 500 | 1000;

export interface FlavorPresentation {
  slug: string;
  name: string;
  sub: string;
  color: string;
  artwork: string;
}

// Retain alias for backwards compatibility
export type CatalogFlavor = FlavorPresentation;

export interface CatalogCardProps {
  flavor: FlavorPresentation;
  erpProduct?: PublicCatalogProduct | null;
  isErpOnline?: boolean;
  catalogLoading?: boolean;
  index: number;
}

const SIZE_SCALES: Record<FlavorSize, number> = {
  250: 0.90,
  500: 1.00,
  1000: 1.00, // Do NOT imply 250/500 photographed bottle is physically 1L; keep scale neutral 1.0
};

// Official preview fallback prices (stale display only, never checkout authority)
const PREVIEW_PRICES: Record<FlavorSize, number> = {
  250: 16000,
  500: 30000,
  1000: 55000,
};

export function CatalogCard({
  flavor,
  erpProduct = null,
  isErpOnline = false,
  catalogLoading = false,
  index,
}: CatalogCardProps) {
  const [selectedSize, setSelectedSize] = useState<FlavorSize>(250);
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const openCart = useCartStore((state) => state.openCart);
  const shouldReduceMotion = useReducedMotion();

  // ERP variant lookup through exact net content parsing (DECIMAL 18,6 scaled BigInt)
  const variant250 = erpProduct?.variants.find((v: PublicCatalogVariant) => {
    const ml = parseNetContentMl(v.net_content?.quantity, v.net_content?.uom);
    return ml === 250;
  });

  const variant500 = erpProduct?.variants.find((v: PublicCatalogVariant) => {
    const ml = parseNetContentMl(v.net_content?.quantity, v.net_content?.uom);
    return ml === 500;
  });

  const variant1000 = erpProduct?.variants.find((v: PublicCatalogVariant) => {
    const ml = parseNetContentMl(v.net_content?.quantity, v.net_content?.uom);
    return ml === 1000;
  });

  const currentVariant =
    selectedSize === 250 ? variant250 : selectedSize === 500 ? variant500 : variant1000;

  const displayName = erpProduct?.name || flavor.name;
  const displaySlug = erpProduct?.slug || flavor.slug;
  const displaySub = erpProduct?.description || flavor.sub;

  const isAvailable = isErpOnline ? Boolean(currentVariant) : false;
  const currentPrice = currentVariant?.price.amount ?? PREVIEW_PRICES[selectedSize];
  const currentScale = SIZE_SCALES[selectedSize];

  const handleAddToCart = () => {
    if (!isErpOnline || !currentVariant) {
      // Preview mode / ERP offline:
      // STRICT INVARIANT: Preview products MUST NOT be allowed to enter a transactional checkout cart.
      // Never send preview/fake variant IDs to checkout.
      return;
    }

    // Authoritative ERP Variant ID (UUIDv7/v4 from database)
    addItem({
      variant_id: currentVariant.variant_id,
      sku: currentVariant.sku,
      name: currentVariant.name,
      volume_ml: selectedSize,
      quantity: 1,
      display_price: currentVariant.price.amount,
    });

    setAdded(true);
    openCart();
    setTimeout(() => setAdded(false), 1400);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: shouldReduceMotion ? 0.01 : MOTION_TOKENS.duration.normal,
        delay: shouldReduceMotion ? 0 : Math.min(index * 0.08, 0.4),
        ease: MOTION_TOKENS.ease.out,
      }}
      whileHover={shouldReduceMotion ? undefined : { y: -4 }}
      className="product-card w-[82vw] sm:w-[320px] md:w-[360px] flex-shrink-0 bg-white rounded-[24px] shadow-sm hover:shadow-md border border-[#E5E2DA] flex flex-col overflow-hidden relative group transition-shadow duration-300 snap-center"
    >
      {/* Top Visual Container */}
      <div
        className={`w-full h-56 sm:h-64 ${flavor.color} flex items-end justify-center relative px-6 pb-2 pt-8 overflow-hidden transition-colors duration-500`}
      >
        <div className="absolute inset-0 bg-black/5 mix-blend-overlay" />

        {/* Cold Chain Badge */}
        <div className="absolute top-4 left-4 z-20">
          <span className="bg-white/90 backdrop-blur-xs text-[#1E3932] text-[10px] font-bold px-2.5 py-1 rounded-full shadow-xs">
            0°C – 4°C Cold Chain
          </span>
        </div>

        {/* Size Badge */}
        <div className="absolute top-4 right-4 z-20">
          <span className="bg-black/20 text-white text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
            {selectedSize === 1000 ? "1 Liter" : `${selectedSize} ml`}
          </span>
        </div>

        {/* Product Visual Area: Neutral 1L State or 250/500ml Bottle Artwork */}
        {selectedSize === 1000 ? (
          <div className="relative w-full h-full flex flex-col items-center justify-center z-10 p-4 text-center">
            <div className="w-20 h-28 rounded-2xl border-2 border-dashed border-white/50 bg-white/10 flex flex-col items-center justify-center p-2 mb-2 backdrop-blur-xs">
              <span className="text-white/90 font-black text-xl tracking-tight">1L</span>
              <span className="text-white/70 text-[9px] font-medium uppercase tracking-wider">Kemasan Besar</span>
            </div>
            <span className="bg-black/50 backdrop-blur-xs text-white text-[10px] font-medium px-3 py-1 rounded-full inline-block shadow-xs">
              Foto resmi 1L segera hadir
            </span>
          </div>
        ) : (
          <motion.div
            animate={{ scale: currentScale }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: MOTION_TOKENS.duration.normal, ease: MOTION_TOKENS.ease.out }
            }
            className="relative w-full h-full flex items-center justify-center z-10 origin-bottom"
          >
            {flavor.artwork ? (
              <Image
                src={flavor.artwork}
                alt={displayName}
                fill
                sizes="(max-width: 640px) 280px, 360px"
                className="object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.18)]"
              />
            ) : (
              <div className="w-24 h-32 rounded-2xl bg-white/20 border border-white/30 flex flex-col items-center justify-center text-white p-2">
                <span className="font-extrabold text-2xl tracking-tight">{displayName.slice(0, 2).toUpperCase()}</span>
                <span className="text-[10px] font-medium opacity-80 mt-1">{selectedSize} ml</span>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Bottom Content Area */}
      <div className="p-5 sm:p-6 flex flex-col flex-grow justify-between bg-white z-20 space-y-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-extrabold text-[#1E3932] tracking-tight">
            {displayName}
          </h3>
          <p className="text-xs sm:text-sm text-[#5C6F68] mt-1">{displaySub}</p>
        </div>

        {/* Size Selector */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[11px] font-bold text-[#5C6F68] uppercase tracking-wider">
            <span>Pilihan Ukuran</span>
            {selectedSize === 1000 && (
              <span className="text-[10px] text-[#8A9590] normal-case">Ukuran 1 Liter</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#FAF9F7] rounded-xl border border-[#E5E2DA]">
            {([250, 500, 1000] as FlavorSize[]).map((size) => {
              const active = selectedSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSelectedSize(size)}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all relative cursor-pointer ${
                    active
                      ? "bg-[#00754A] text-white shadow-xs"
                      : "text-[#5C6F68] hover:text-[#1E3932] hover:bg-white/60"
                  }`}
                >
                  {size === 1000 ? "1 Liter" : `${size} ml`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Price & Actions */}
        <div className="pt-2 border-t border-[#F2F0EB] flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] text-[#8A9590] uppercase tracking-wider block font-semibold">
              Harga
            </span>
            <div className="h-7 overflow-hidden flex items-center">
              <motion.span
                key={selectedSize}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: shouldReduceMotion ? 0.01 : MOTION_TOKENS.duration.fast,
                  ease: MOTION_TOKENS.ease.out,
                }}
                className="text-lg sm:text-xl font-black text-[#00754A]"
              >
                Rp {currentPrice.toLocaleString("id-ID")}
              </motion.span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/product/${displaySlug}`}
              className="px-3 py-2 text-xs font-bold text-[#00754A] hover:bg-[#E8F5E9] rounded-xl transition-colors cursor-pointer"
            >
              Detail
            </Link>

            <motion.button
              type="button"
              onClick={handleAddToCart}
              disabled={!isAvailable || catalogLoading}
              whileHover={shouldReduceMotion || !isAvailable ? undefined : { scale: 1.02 }}
              whileTap={shouldReduceMotion || !isAvailable ? undefined : { scale: 0.96 }}
              aria-label={`Tambah ${displayName} ke keranjang`}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs min-w-[108px] justify-center ${
                !isAvailable || catalogLoading
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : added
                    ? "bg-[#1E3932] text-white cursor-pointer"
                    : "bg-[#00754A] text-white hover:bg-[#006241] cursor-pointer"
              }`}
            >
              {catalogLoading ? (
                <span>Memeriksa...</span>
              ) : !isErpOnline ? (
                <span title="Katalog dalam mode pratinjau — pemesanan memerlukan koneksi backend ERP">
                  Pratinjau
                </span>
              ) : added ? (
                <>
                  <Check size={14} className="text-[#A1C349]" />
                  <span>Masuk!</span>
                </>
              ) : (
                <>
                  <ShoppingBag size={14} />
                  <span>+ Keranjang</span>
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
