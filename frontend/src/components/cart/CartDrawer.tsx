"use client";

import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCartStore } from "@/store/cartStore";
import { drawerVariants, modalBackdropVariants, MOTION_TOKENS } from "@/lib/motion";

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
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Keranjang Belanja">
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
            className="relative w-full max-w-md bg-[#F2F0EB] text-[#1E3932] shadow-2xl flex flex-col h-full z-10 overflow-hidden font-sans border-l border-[#E5E2DA]"
          >
            {/* Header */}
            <div className="p-5 bg-white border-b border-[#E5E2DA] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#00754A]/10 text-[#00754A] flex items-center justify-center font-bold">
                  <ShoppingBag size={18} />
                </div>
                <div>
                  <h2 className="font-extrabold text-base tracking-tight">Keranjang Belanja</h2>
                  <p className="text-[11px] text-[#5C6F68] font-medium">
                    {totalItemCount} item pilihan yoghurt
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCart}
                aria-label="Tutup Keranjang"
                className="p-2 rounded-xl text-[#5C6F68] hover:text-[#1E3932] hover:bg-[#F2F0EB] transition-colors cursor-pointer"
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
                  <h3 className="font-bold text-base text-[#1E3932]">Keranjang Masih Kosong</h3>
                  <p className="text-xs text-[#5C6F68] max-w-xs leading-relaxed">
                    Pilih varian rasa favorit Anda dari katalog untuk merasakan kesegaran stirred yoghurt kualitas homemade.
                  </p>
                  <button
                    type="button"
                    onClick={closeCart}
                    className="mt-2 px-6 py-2.5 bg-[#00754A] text-white rounded-full text-xs font-bold hover:bg-[#006241] active:scale-95 transition-all shadow-sm cursor-pointer"
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
                      className="bg-white p-4 rounded-xl border border-[#E5E2DA] shadow-sm flex flex-col gap-2.5 overflow-hidden"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-[#1E3932] truncate">{item.name}</h4>
                          <span className="text-[11px] font-mono text-[#5C6F68] block mt-0.5">
                            {item.sku} {item.volume_ml ? `• ${item.volume_ml} ml` : ""}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.variant_id)}
                          aria-label={`Hapus ${item.name}`}
                          className="p-1 rounded-lg text-red-500 hover:bg-red-50 transition-colors cursor-pointer flex-shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-[#F2F0EB]">
                        <div className="flex items-center gap-1.5 bg-[#FAF9F7] border border-[#E5E2DA] rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.variant_id, -1)}
                            aria-label="Kurangi kuantitas"
                            className="w-6 h-6 flex items-center justify-center rounded text-[#5C6F68] hover:text-[#1E3932] hover:bg-white transition-colors cursor-pointer"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-8 text-center text-xs font-bold text-[#1E3932]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.variant_id, 1)}
                            aria-label="Tambah kuantitas"
                            className="w-6 h-6 flex items-center justify-center rounded text-[#5C6F68] hover:text-[#1E3932] hover:bg-white transition-colors cursor-pointer"
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        <span className="font-extrabold text-sm text-[#00754A]">
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
              <div className="p-5 bg-white border-t border-[#E5E2DA] space-y-3">
                <div className="flex justify-between items-baseline">
                  <div>
                    <span className="text-xs font-medium text-[#5C6F68] block">Estimasi Subtotal</span>
                    <span className="text-[10px] text-[#8A9590]">Standar Cold Chain &lt; 5°C</span>
                  </div>
                  <span className="text-xl font-black text-[#00754A] tracking-tight">
                    Rp {total.toLocaleString("id-ID")}
                  </span>
                </div>

                <Link
                  href="/checkout"
                  onClick={closeCart}
                  className="w-full py-3.5 bg-[#00754A] hover:bg-[#006241] active:scale-[0.98] text-white rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
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
