"use client";

import React, { useState } from "react";
import { AlertCircle, Boxes, CheckCircle2, Clock, Filter, Search } from "lucide-react";

interface InventoryBatch {
  product: string;
  variant: string;
  sku: string;
  lot: string;
  warehouse: string;
  stock: number;
  expiry: string;
  daysRemaining: number;
  fefoStatus: "Available" | "Near Expiry" | "Critical";
}

const INVENTORY_DATA: InventoryBatch[] = [
  {
    product: "Plain Pure Original",
    variant: "250 ml",
    sku: "CY-PLAIN-250",
    lot: "LOT-PLAIN-250-001",
    warehouse: "WH-MAIN",
    stock: 100,
    expiry: "15 Okt 2026",
    daysRemaining: 21,
    fefoStatus: "Available",
  },
  {
    product: "Plain Pure Original",
    variant: "1000 ml",
    sku: "CY-PLAIN-1000",
    lot: "LOT-PLAIN-1000-001",
    warehouse: "WH-MAIN",
    stock: 50,
    expiry: "10 Okt 2026",
    daysRemaining: 16,
    fefoStatus: "Near Expiry",
  },
  {
    product: "Melon Emerald Fresh",
    variant: "1000 ml",
    sku: "CY-MELON-1000",
    lot: "LOT-MELON-1000-002",
    warehouse: "WH-MAIN",
    stock: 45,
    expiry: "28 Sep 2026",
    daysRemaining: 4,
    fefoStatus: "Critical",
  },
  {
    product: "Stroberi Summer Blush",
    variant: "250 ml",
    sku: "CY-STROBERI-250",
    lot: "LOT-STROBERI-250-001",
    warehouse: "WH-MAIN",
    stock: 80,
    expiry: "02 Nov 2026",
    daysRemaining: 39,
    fefoStatus: "Available",
  },
  {
    product: "Mangga Tropical Gold",
    variant: "250 ml",
    sku: "CY-MANGGA-250",
    lot: "LOT-MANGGA-250-001",
    warehouse: "WH-MAIN",
    stock: 75,
    expiry: "10 Nov 2026",
    daysRemaining: 47,
    fefoStatus: "Available",
  },
  {
    product: "Anggur Royal Purple",
    variant: "250 ml",
    sku: "CY-ANGGUR-250",
    lot: "LOT-ANGGUR-250-001",
    warehouse: "WH-MAIN",
    stock: 60,
    expiry: "18 Nov 2026",
    daysRemaining: 55,
    fefoStatus: "Available",
  },
];

export default function AdminInventoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "Available" | "Near Expiry" | "Critical">("ALL");

  const filteredItems = INVENTORY_DATA.filter((item) => {
    const matchesSearch =
      item.product.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.lot.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter !== "ALL" && item.fefoStatus !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#1E3932]">
            Manajemen Inventori & Rotasi FEFO
          </h2>
          <p className="text-xs text-[#5C6F68] mt-0.5">
            Pengawasan stok lot aktif dengan alokasi otomatis First-Expired, First-Out (FEFO)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#E8F5E9] text-[#1E3932] border border-[#C8E6C9] text-xs font-semibold">
            <CheckCircle2 size={13} className="text-[#00754A]" />
            <span>Gudang: WH-MAIN</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FAF9F7] text-[#5C6F68] border border-[#E5E2DA] text-xs font-mono">
            Aturan: FEFO Ketat
          </span>
        </div>
      </div>

      {/* FEFO Policy Operational Notice */}
      <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E5E2DA] flex items-start gap-3">
        <AlertCircle size={18} className="text-[#00754A] flex-shrink-0 mt-0.5" />
        <div className="text-xs text-[#5C6F68] leading-relaxed">
          <span className="font-bold text-[#1E3932] block mb-0.5">
            Prinsip Cold Chain & Garansi Kesegaran:
          </span>
          Setiap reservasi checkout dialokasikan ke lot dengan tanggal kedaluwarsa terdekat yang masih berlaku. Lot berstatus <strong className="text-[#C62828]">Critical</strong> (&lt; 7 hari) secara otomatis diprioritaskan keluar oleh algoritma ERP Core.
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A9590]" />
          <input
            type="text"
            placeholder="Cari produk, lot, atau SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs text-[#1E3932] placeholder-[#8A9590] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto w-full sm:w-auto">
          <span className="text-xs font-semibold text-[#5C6F68]">Status:</span>
          <div className="inline-flex rounded-xl border border-[#D5D1C7] p-0.5 bg-[#FAF9F7] text-xs">
            {(["ALL", "Available", "Near Expiry", "Critical"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  statusFilter === st ? "bg-white text-[#1E3932] shadow-sm font-bold" : "text-[#5C6F68]"
                }`}
              >
                {st === "ALL" ? "Semua" : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Inventory Table (Desktop & Tablet) */}
      <div className="bg-white rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1E3932]">
            <thead className="bg-[#FAF9F7] text-[#5C6F68] font-bold uppercase text-[10px] tracking-wider border-b border-[#E5E2DA]">
              <tr>
                <th className="px-4 py-3">Produk</th>
                <th className="px-4 py-3">Varian & SKU</th>
                <th className="px-4 py-3">Nomor Lot</th>
                <th className="px-4 py-3">Gudang</th>
                <th className="px-4 py-3 text-center">Stok Fisik</th>
                <th className="px-4 py-3">Kedaluwarsa</th>
                <th className="px-4 py-3">Status FEFO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E2DA]">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#5C6F68]">
                    Belum ada data inventori yang cocok dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[#FDFCFB] transition-colors">
                    <td className="px-4 py-3 font-semibold text-[#1E3932]">
                      {item.product}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-[#1E3932] block">{item.variant}</span>
                      <span className="text-[10px] text-[#5C6F68] font-mono">{item.sku}</span>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-[#1E3932]">
                      {item.lot}
                    </td>
                    <td className="px-4 py-3 text-[#5C6F68] font-mono">
                      {item.warehouse}
                    </td>
                    <td className="px-4 py-3 text-center font-bold font-mono">
                      {item.stock} unit
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-medium">{item.expiry}</span>
                      <span className="text-[10px] text-[#5C6F68]">({item.daysRemaining} hari lagi)</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                          item.fefoStatus === "Available"
                            ? "bg-[#E8F5E9] text-[#1E3932] border border-[#C8E6C9]"
                            : item.fefoStatus === "Near Expiry"
                              ? "bg-amber-50 text-amber-900 border border-amber-200"
                              : "bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]"
                        }`}
                      >
                        {item.fefoStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View (Card-based) */}
        <div className="md:hidden divide-y divide-[#E5E2DA]">
          {filteredItems.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#5C6F68]">
              Belum ada data inventori yang cocok dengan kriteria filter.
            </div>
          ) : (
            filteredItems.map((item, idx) => (
              <div key={idx} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#1E3932]">{item.product}</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                      item.fefoStatus === "Available"
                        ? "bg-[#E8F5E9] text-[#1E3932] border border-[#C8E6C9]"
                        : item.fefoStatus === "Near Expiry"
                          ? "bg-amber-50 text-amber-900 border border-amber-200"
                          : "bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]"
                    }`}
                  >
                    {item.fefoStatus}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#5C6F68]">
                  <span>{item.variant} • {item.warehouse}</span>
                  <span className="font-mono">{item.lot}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-[#E5E2DA]/60 text-xs">
                  <span className="text-[11px] text-[#5C6F68]">
                    Exp: {item.expiry} ({item.daysRemaining}h lagi)
                  </span>
                  <span className="font-bold font-mono text-[#1E3932]">
                    {item.stock} unit
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
