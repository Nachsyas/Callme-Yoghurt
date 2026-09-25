"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { MOTION_TOKENS } from "@/lib/motion";
import type { PublicCatalogProduct } from "@/lib/catalog";

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

export function CatalogCard({
  flavor,
  erpProduct = null,
  index,
}: CatalogCardProps) {
  const shouldReduceMotion = useReducedMotion();

  const displayName = erpProduct?.name || flavor.name;
  const displaySlug = erpProduct?.slug || flavor.slug;
  const displaySub = erpProduct?.description || flavor.sub;

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
            0–5°C Cold Chain
          </span>
        </div>

        {/* Product Visual Area: Official Flavor Artwork */}
        <div className="relative w-full h-full flex items-center justify-center z-10 origin-bottom">
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
              <span className="font-extrabold text-2xl tracking-tight">
                {displayName.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Content Area */}
      <div className="p-5 sm:p-6 flex flex-col flex-grow justify-between bg-white z-20 space-y-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-extrabold text-[#1E3932] tracking-tight">
            {displayName}
          </h3>
          <p className="text-xs sm:text-sm text-[#5C6F68] mt-1 leading-relaxed">
            {displaySub}
          </p>
        </div>

        {/* Single Navigation CTA: Lihat Detail */}
        <div className="pt-2 border-t border-[#F2F0EB]">
          <Link
            href={`/product/${displaySlug}`}
            className="w-full py-3 px-4 bg-[#00754A] hover:bg-[#006241] text-white rounded-xl text-xs sm:text-sm font-bold text-center flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer group-hover:shadow-md active:scale-[0.99]"
          >
            <span>Lihat Detail</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </motion.article>
  );
}

