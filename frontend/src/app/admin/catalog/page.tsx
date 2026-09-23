"use client";

import React, { useState } from "react";
import Image from "next/image";
import { CheckCircle2, Package, Search, Sparkles } from "lucide-react";

interface CatalogProductItem {
  id: string;
  code: string;
  name: string;
  flavor: string;
  image: string;
  description: string;
  variants: {
    sku: string;
    size: string;
    netContent: number;
    price: number;
    status: "ACTIVE" | "INACTIVE";
  }[];
}

const OFFICIAL_CATALOG: CatalogProductItem[] = [
  {
    id: "prod-plain",
    code: "CY-PLAIN",
    name: "Plain Pure Original",
    flavor: "Plain",
    image: "/images/plain.png",
    description: "Yogurt stirred alami tanpa pemanis buatan dengan tekstur kental dan rasa asam segar seimbang.",
    variants: [
      { sku: "CY-PLAIN-250", size: "250 ml", netContent: 250, price: 15000, status: "ACTIVE" },
      { sku: "CY-PLAIN-1000", size: "1 Liter", netContent: 1000, price: 55000, status: "ACTIVE" },
    ],
  },
  {
    id: "prod-stroberi",
    code: "CY-STROBERI",
    name: "Stroberi Summer Blush",
    flavor: "Stroberi",
    image: "/images/stroberi.png",
    description: "Kombinasi stroberi segar pilihan dengan yogurt kental lembut yang memanjakan lidah.",
    variants: [
      { sku: "CY-STROBERI-250", size: "250 ml", netContent: 250, price: 15000, status: "ACTIVE" },
      { sku: "CY-STROBERI-1000", size: "1 Liter", netContent: 1000, price: 55000, status: "ACTIVE" },
    ],
  },
  {
    id: "prod-mangga",
    code: "CY-MANGGA",
    name: "Mangga Tropical Gold",
    flavor: "Mangga",
    image: "/images/mangga.png",
    description: "Keharuman mangga tropis matang berpadu sempurna dalam yogurt stirred premium kaya probiotik.",
    variants: [
      { sku: "CY-MANGGA-250", size: "250 ml", netContent: 250, price: 15000, status: "ACTIVE" },
      { sku: "CY-MANGGA-1000", size: "1 Liter", netContent: 1000, price: 55000, status: "ACTIVE" },
    ],
  },
  {
    id: "prod-melon",
    code: "CY-MELON",
    name: "Melon Emerald Fresh",
    flavor: "Melon",
    image: "/images/melon.png",
    description: "Sensasi kesegaran buah melon honeydew hijau dalam setiap tegukan yogurt dingin.",
    variants: [
      { sku: "CY-MELON-250", size: "250 ml", netContent: 250, price: 15000, status: "ACTIVE" },
      { sku: "CY-MELON-1000", size: "1 Liter", netContent: 1000, price: 55000, status: "ACTIVE" },
    ],
  },
  {
    id: "prod-anggur",
    code: "CY-ANGGUR",
    name: "Anggur Royal Purple",
    flavor: "Anggur",
    image: "/images/anggur.png",
    description: "Cita rasa anggur ungu elegan dengan rasa manis asam alami yang menyegarkan dahaga.",
    variants: [
      { sku: "CY-ANGGUR-250", size: "250 ml", netContent: 250, price: 15000, status: "ACTIVE" },
      { sku: "CY-ANGGUR-1000", size: "1 Liter", netContent: 1000, price: 55000, status: "ACTIVE" },
    ],
  },
  {
    id: "prod-leci",
    code: "CY-LECI",
    name: "Leci Sweet Breeze",
    flavor: "Leci",
    image: "/images/leci.png",
    description: "Kelembutan aroma leci manis alami dengan kesegaran yogurt stirred berkualitas tinggi.",
    variants: [
      { sku: "CY-LECI-250", size: "250 ml", netContent: 250, price: 15000, status: "ACTIVE" },
      { sku: "CY-LECI-1000", size: "1 Liter", netContent: 1000, price: 55000, status: "ACTIVE" },
    ],
  },
  {
    id: "prod-vanila",
    code: "CY-VANILA",
    name: "Vanila Creamy Dream",
    flavor: "Vanila",
    image: "/images/vanila.png",
    description: "Aroma vanila lembut klasik berpadu dengan kentalnya yogurt stirred premium.",
    variants: [
      { sku: "CY-VANILA-250", size: "250 ml", netContent: 250, price: 15000, status: "ACTIVE" },
      { sku: "CY-VANILA-1000", size: "1 Liter", netContent: 1000, price: 55000, status: "ACTIVE" },
    ],
  },
];

export default function AdminCatalogPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sizeFilter, setSizeFilter] = useState<"ALL" | "250" | "1000">("ALL");

  const filteredProducts = OFFICIAL_CATALOG.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.flavor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.code.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (sizeFilter === "250") {
      return product.variants.some((v) => v.netContent === 250);
    }
    if (sizeFilter === "1000") {
      return product.variants.some((v) => v.netContent === 1000);
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#1E3932]">
            Katalog Produk & Varian Master
          </h2>
          <p className="text-xs text-[#5C6F68] mt-0.5">
            Manajemen katalog resmi Callme Yoghurt — 7 Varian Resmi Terotorisasi (7 Varian Resmi)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#E8F5E9] text-[#1E3932] border border-[#C8E6C9] text-xs font-semibold">
            <CheckCircle2 size={13} className="text-[#00754A]" />
            <span>7 SKUs Resmi Aktif</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FAF9F7] text-[#5C6F68] border border-[#E5E2DA] text-xs font-mono">
            14 Varian Ukuran
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A9590]" />
          <input
            type="text"
            placeholder="Cari rasa, nama produk, atau SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs text-[#1E3932] placeholder-[#8A9590] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto w-full sm:w-auto">
          <span className="text-xs font-semibold text-[#5C6F68]">Ukuran:</span>
          <div className="inline-flex rounded-xl border border-[#D5D1C7] p-0.5 bg-[#FAF9F7] text-xs">
            <button
              type="button"
              onClick={() => setSizeFilter("ALL")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                sizeFilter === "ALL" ? "bg-white text-[#1E3932] shadow-sm font-bold" : "text-[#5C6F68]"
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setSizeFilter("250")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                sizeFilter === "250" ? "bg-white text-[#1E3932] shadow-sm font-bold" : "text-[#5C6F68]"
              }`}
            >
              250ml
            </button>
            <button
              type="button"
              onClick={() => setSizeFilter("1000")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                sizeFilter === "1000" ? "bg-white text-[#1E3932] shadow-sm font-bold" : "text-[#5C6F68]"
              }`}
            >
              1 Liter
            </button>
          </div>
        </div>
      </div>

      {/* Catalog Table (Desktop & Tablet) */}
      <div className="bg-white rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1E3932]">
            <thead className="bg-[#FAF9F7] text-[#5C6F68] font-bold uppercase text-[10px] tracking-wider border-b border-[#E5E2DA]">
              <tr>
                <th className="px-4 py-3">Produk</th>
                <th className="px-4 py-3">Varian & SKU</th>
                <th className="px-4 py-3">Isi Bersih</th>
                <th className="px-4 py-3">Harga Satuan</th>
                <th className="px-4 py-3">Standar Suhu</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E2DA]">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#5C6F68]">
                    Belum ada data produk yang cocok dengan pencarian.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) =>
                  product.variants.map((variant, vIdx) => (
                    <tr key={`${product.id}-${variant.sku}`} className="hover:bg-[#FDFCFB] transition-colors">
                      {vIdx === 0 && (
                        <td
                          rowSpan={product.variants.length}
                          className="px-4 py-3 font-semibold align-top border-r border-[#E5E2DA]/40"
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-[#FAF9F7] border border-[#E5E2DA] flex-shrink-0">
                              <Image
                                src={product.image}
                                alt={product.name}
                                fill
                                sizes="40px"
                                className="object-contain p-1"
                              />
                            </div>
                            <div>
                              <span className="font-bold text-sm text-[#1E3932] block">
                                {product.name}
                              </span>
                              <span className="text-[10px] text-[#5C6F68] font-mono">
                                {product.code}
                              </span>
                            </div>
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span className="font-semibold text-[#1E3932] block">{variant.size}</span>
                        <span className="text-[10px] text-[#5C6F68] font-mono">{variant.sku}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[#5C6F68]">
                        {variant.netContent} ml
                      </td>
                      <td className="px-4 py-3 font-bold text-[#1E3932]">
                        Rp {variant.price.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3 text-[#00754A] font-semibold">
                        0.0°C – 4.0°C (Dingin)
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F5E9] text-[#1E3932] border border-[#C8E6C9]">
                          {variant.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Catalog Mobile View (Card-based) */}
        <div className="md:hidden divide-y divide-[#E5E2DA]">
          {filteredProducts.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#5C6F68]">
              Belum ada data produk yang cocok dengan pencarian.
            </div>
          ) : (
            filteredProducts.map((product) => (
              <div key={product.id} className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[#FAF9F7] border border-[#E5E2DA] flex-shrink-0">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      sizes="48px"
                      className="object-contain p-1"
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#1E3932]">{product.name}</h3>
                    <p className="text-[10px] text-[#5C6F68] font-mono">{product.code}</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-[#E5E2DA]/60">
                  {product.variants.map((v) => (
                    <div
                      key={v.sku}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAF9F7] border border-[#E5E2DA] text-xs"
                    >
                      <div>
                        <span className="font-bold text-[#1E3932] block">{v.size}</span>
                        <span className="text-[10px] text-[#5C6F68] font-mono">{v.sku}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-[#1E3932] block">
                          Rp {v.price.toLocaleString("id-ID")}
                        </span>
                        <span className="text-[10px] font-bold text-[#00754A]">0°C – 4°C</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
