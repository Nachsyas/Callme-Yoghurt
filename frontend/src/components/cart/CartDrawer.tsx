"use client";

import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCartStore, type CartItem } from "@/store/cartStore";
import { drawerVariants, modalBackdropVariants, MOTION_TOKENS } from "@/lib/motion";

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

export function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQuantity, getEstimatedTotal } = useCartStore();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closeCart();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeCart]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const total = getEstimatedTotal();
  const totalItemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          id="cart-drawer"
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Keranjang Belanja"
        >
          {/* Backdrop */}
          <motion.div
            variants={modalBackdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={closeCart}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            aria-hidden="true"
          />

          {/* Sliding Panel */}
          <motion.div
            ref={drawerRef}
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative w-full max-w-md bg-[#F2F0EB] text-[#1c1917] shadow-2xl flex flex-col h-full z-10 overflow-hidden font-sans border-l border-[#E5E2DA]"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 bg-white border-b border-[#E5E2DA] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center font-bold">
                  <ShoppingBag size={18} />
                </div>
                <div>
                  <h2 className="font-extrabold text-base tracking-tight text-[#1c1917]">
                    Keranjang Belanja
                  </h2>
                  <p className="text-[11px] text-[#2E7D32] font-semibold">
                    {totalItemCount} item pilihan yoghurt
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCart}
                aria-label="Tutup Keranjang"
                className="p-2 rounded-xl text-black/50 hover:text-[#2E7D32] hover:bg-[#E8F5E9] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm text-black/20">
                    <ShoppingBag size={28} />
                  </div>
                  <h3 className="font-bold text-base text-[#1c1917]">Keranjang Masih Kosong</h3>
                  <p className="text-xs text-black/60 max-w-xs leading-relaxed">
                    Pilih varian rasa favorit Anda dari katalog resmi Callme Yoghurt.
                  </p>
                  <button
                    type="button"
                    onClick={closeCart}
                    className="mt-2 px-6 py-2.5 bg-[#2E7D32] text-white rounded-full text-xs font-bold hover:bg-[#256628] active:scale-95 transition-all shadow-sm cursor-pointer"
                  >
                    Lihat Katalog
                  </button>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {items.map((item) => (
                    <motion.div
                      key={item.variant_id}
                      layout
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0, padding: 0 }}
                      transition={{ duration: MOTION_TOKENS.duration.fast }}
                      data-variant-id={item.variant_id}
                      className="bg-white p-4 rounded-2xl border border-[#E5E2DA] shadow-xs flex flex-col gap-3 overflow-hidden"
                    >
                      <div className="flex items-start gap-3">
                        {/* Clear Product Thumbnail */}
                        <div className="w-16 h-16 rounded-xl bg-[#E8F5E9]/50 border border-[#2E7D32]/15 flex items-center justify-center p-1 relative flex-shrink-0 overflow-hidden">
                          <Image
                            src={getItemArtwork(item)}
                            alt={item.name}
                            fill
                            sizes="64px"
                            className="object-contain p-1"
                          />
                        </div>

                        {/* Product Information */}
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between items-start gap-1">
                            <h4 className="font-bold text-sm text-[#1c1917] truncate leading-snug">
                              {item.name}
                            </h4>
                            <button
                              type="button"
                              onClick={() => removeItem(item.variant_id)}
                              aria-label={`Hapus ${item.name}`}
                              className="p-1.5 rounded-lg text-black/40 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer flex-shrink-0 -mr-1 -mt-1"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#E8F5E9] text-[#2E7D32] border border-[#2E7D32]/20">
                              {item.volume_ml === 1000 ? "1 Liter" : `${item.volume_ml || 250} ml`}
                            </span>
                            <span className="text-[11px] font-mono text-black/40">
                              {item.sku}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quantity & Subtotal */}
                      <div className="flex items-center justify-between pt-2.5 border-t border-[#F2F0EB]">
                        <div className="flex items-center gap-1.5 bg-[#E8F5E9]/40 border border-[#2E7D32]/20 rounded-full px-2 py-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.variant_id, -1)}
                            aria-label="Kurangi kuantitas"
                            className="w-6 h-6 flex items-center justify-center rounded-full text-[#2E7D32] hover:bg-white transition-colors cursor-pointer"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-6 text-center text-xs font-bold text-[#1c1917]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.variant_id, 1)}
                            aria-label="Tambah kuantitas"
                            className="w-6 h-6 flex items-center justify-center rounded-full text-[#2E7D32] hover:bg-white transition-colors cursor-pointer"
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        <span className="font-extrabold text-sm text-[#2E7D32]">
                          Rp {(item.display_price * item.quantity).toLocaleString("id-ID")}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Footer with Checkout CTA */}
            {items.length > 0 && (
              <div className="p-4 sm:p-5 bg-white border-t border-[#E5E2DA] space-y-3">
                <div className="flex justify-between items-baseline">
                  <div>
                    <span className="text-xs font-medium text-black/60 block">Estimasi Subtotal</span>
                    <span className="text-[10px] text-[#2E7D32] font-semibold">Penanganan Dairy Sesuai SOP</span>
                  </div>
                  <span className="text-xl font-black text-[#2E7D32] tracking-tight whitespace-nowrap shrink-0">
                    Rp {total.toLocaleString("id-ID")}
                  </span>
                </div>

                <Link
                  href="/checkout"
                  onClick={closeCart}
                  className="w-full py-3.5 bg-[#2E7D32] hover:bg-[#256628] active:bg-[#1B5E20] active:scale-[0.98] text-white rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <span>Lanjut ke Checkout</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

