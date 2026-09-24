"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { MOTION_TOKENS } from "@/lib/motion";

export type FlavorSize = 250 | 500 | 1000;

export interface CatalogFlavor {
  id: string;
  name: string;
  sub: string;
  prices: Record<FlavorSize, number>;
  color: string;
}

interface CatalogCardProps {
  flavor: CatalogFlavor;
  index: number;
}

const SIZE_SCALES: Record<FlavorSize, number> = {
  250: 0.90,
  500: 1.0,
  1000: 1.08,
};

export function CatalogCard({ flavor, index }: CatalogCardProps) {
  const [selectedSize, setSelectedSize] = useState<FlavorSize>(250);
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const openCart = useCartStore((state) => state.openCart);
  const shouldReduceMotion = useReducedMotion();

  const currentPrice = flavor.prices[selectedSize];
  const currentScale = shouldReduceMotion ? 1 : SIZE_SCALES[selectedSize];

  const handleAddToCart = () => {
    addItem({
      variant_id: `prod-${flavor.id}-${selectedSize}`,
      sku: `CY-${flavor.id.toUpperCase().slice(0, 3)}-${selectedSize}`,
      name: `${flavor.name} ${selectedSize === 1000 ? "1 Liter" : `${selectedSize} ml`}`,
      volume_ml: selectedSize,
      quantity: 1,
      display_price: currentPrice,
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
        duration: MOTION_TOKENS.duration.normal,
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

        {/* Animated Product Image */}
        <motion.div
          animate={{ scale: currentScale }}
          transition={{
            duration: MOTION_TOKENS.duration.normal,
            ease: MOTION_TOKENS.ease.out,
          }}
          className="relative w-full h-full flex items-center justify-center z-10 origin-bottom"
        >
          <Image
            src={`/images/${flavor.id}.png`}
            alt={flavor.name}
            fill
            sizes="(max-width: 640px) 280px, 360px"
            className="object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.18)]"
          />
        </motion.div>
      </div>

      {/* Bottom Content Area */}
      <div className="p-5 sm:p-6 flex flex-col flex-grow justify-between bg-white z-20 space-y-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-extrabold text-[#1E3932] tracking-tight">
            {flavor.name}
          </h3>
          <p className="text-xs sm:text-sm text-[#5C6F68] mt-1">{flavor.sub}</p>
        </div>

        {/* Size Selector */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[11px] font-bold text-[#5C6F68] uppercase tracking-wider">
            <span>Pilihan Ukuran</span>
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
                transition={{ duration: MOTION_TOKENS.duration.fast, ease: MOTION_TOKENS.ease.out }}
                className="text-lg sm:text-xl font-black text-[#00754A]"
              >
                Rp {currentPrice.toLocaleString("id-ID")}
              </motion.span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/product/${flavor.id}`}
              className="px-3 py-2 text-xs font-bold text-[#00754A] hover:bg-[#E8F5E9] rounded-xl transition-colors cursor-pointer"
            >
              Detail
            </Link>

            <motion.button
              type="button"
              onClick={handleAddToCart}
              whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs min-w-[108px] justify-center ${
                added
                  ? "bg-[#1E3932] text-white"
                  : "bg-[#00754A] text-white hover:bg-[#006241]"
              }`}
            >
              {added ? (
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
