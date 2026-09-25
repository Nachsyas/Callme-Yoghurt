"use client";

import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  Package,
  ShoppingCart,
  Snowflake,
  TrendingUp,
} from "lucide-react";

interface RecentOrderPreview {
  id: string;
  customer: string;
  variant: string;
  qty: number;
  courier: string;
  amount: number;
  status: "CONFIRMED" | "PACKED" | "IN DELIVERY" | "DELIVERED";
  time: string;
}

interface InventoryAttentionItem {
  product: string;
  variant: string;
  lot: string;
  stock: number;
  expiry: string;
  daysRemaining: number;
  fefoStatus: "Near Expiry" | "Critical";
}

const RECENT_ORDERS_PREVIEW: RecentOrderPreview[] = [
  {
    id: "CY-2026-0042",
    customer: "Budi S**** (Jakarta Timur)",
    variant: "Plain Pure Original 1000ml",
    qty: 2,
    courier: "Instant Courier (Cooler Bag)",
    amount: 110000,
    status: "CONFIRMED",
    time: "10 menit lalu",
  },
  {
    id: "CY-2026-0041",
    customer: "Siti A**** (Jakarta Selatan)",
    variant: "Stroberi Summer Blush 250ml",
    qty: 4,
    courier: "Sameday Delivery (Cold Box)",
    amount: 60000,
    status: "IN DELIVERY",
    time: "28 menit lalu",
  },
  {
    id: "CY-2026-0040",
    customer: "Hendro W**** (Bekasi Barat)",
    variant: "Mangga Tropical Gold 250ml",
    qty: 3,
    courier: "Instant Courier (Cooler Bag)",
    amount: 45000,
    status: "PACKED",
    time: "1 jam lalu",
  },
  {
    id: "CY-2026-0039",
    customer: "Dewi L**** (Depok)",
    variant: "Melon Emerald Fresh 1000ml",
    qty: 1,
    courier: "Sameday Delivery (Cold Box)",
    amount: 55000,
    status: "DELIVERED",
    time: "2 jam lalu",
  },
  {
    id: "CY-2026-0038",
    customer: "Rian K**** (Jakarta Pusat)",
    variant: "Anggur Royal Purple 250ml",
    qty: 6,
    courier: "Instant Courier (Cooler Bag)",
    amount: 90000,
    status: "DELIVERED",
    time: "3 jam lalu",
  },
];

const INVENTORY_ATTENTION_PREVIEW: InventoryAttentionItem[] = [
  {
    product: "Melon Emerald Fresh",
    variant: "1 Liter",
    lot: "LOT #CY-2026-08D",
    stock: 45,
    expiry: "28 Sep 2026",
    daysRemaining: 6,
    fefoStatus: "Critical",
  },
  {
    product: "Plain Pure Original",
    variant: "250 ml",
    lot: "LOT #CY-2026-09A",
    stock: 340,
    expiry: "15 Okt 2026",
    daysRemaining: 23,
    fefoStatus: "Near Expiry",
  },
];

export function DashboardOverview() {
  return (
    <div className="space-y-6">
      {/* SECTION 1: 4 KPI SUMMARY CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="KPI Overview">
        {/* Card 1: Total Orders */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between text-[#5C6F68]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5C6F68]">
              Total Orders
            </span>
            <ShoppingCart size={17} className="text-[#00754A]" />
          </div>
          <p className="mt-2.5 sm:mt-3 text-2xl font-black text-[#1E3932] tracking-tight">
            28 Pesanan
          </p>
          <div className="flex items-center justify-between text-xs mt-1.5 flex-wrap gap-1">
            <span className="text-[#00754A] font-semibold">+12% vs kemarin</span>
            <span className="text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[11px]">
              4 Perlu Packing
            </span>
          </div>
        </div>

        {/* Card 2: Authoritative Catalog */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between text-[#5C6F68]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5C6F68]">
              Authoritative Catalog
            </span>
            <Package size={17} className="text-[#00754A]" />
          </div>
          <p className="mt-2.5 sm:mt-3 text-2xl font-black text-[#1E3932] tracking-tight">
            7 SKUs Aktif
          </p>
          <p className="text-xs text-[#5C6F68] mt-1.5 flex items-center justify-between">
            <span>7 Varian Resmi</span>
            <span className="text-[#00754A] font-bold">100% Terverifikasi</span>
          </p>
        </div>

        {/* Card 3: Inventory FEFO Policy */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between text-[#5C6F68]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5C6F68]">
              Kebijakan Stok
            </span>
            <Boxes size={17} className="text-[#00754A]" />
          </div>
          <p className="mt-2.5 sm:mt-3 text-2xl font-black text-[#1E3932] tracking-tight">
            FEFO Aktif
          </p>
          <p className="text-xs text-[#5C6F68] mt-1.5 flex items-center justify-between">
            <span>Gudang WH-MAIN</span>
            <span className="text-[#00754A] font-bold">Rotasi Kedaluwarsa</span>
          </p>
        </div>

        {/* Card 4: Cold Chain Policy Standard */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between text-[#5C6F68]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5C6F68]">
              Standar Cold Chain
            </span>
            <Snowflake size={17} className="text-[#00754A]" />
          </div>
          <p className="mt-2.5 sm:mt-3 text-2xl font-black text-[#00754A] tracking-tight">
            &lt; 5.0°C Nominal
          </p>
          <p className="text-xs text-[#5C6F68] mt-1.5 flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-[#00754A]" />
            <span>SOP-01 Terverifikasi</span>
          </p>
        </div>
      </section>

      {/* SECTION 2: TODAY'S ATTENTION OPERATIONAL ACTION PANEL */}
      <section className="bg-white rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden" aria-label="Today's Attention">
        <div className="p-4 sm:p-5 border-b border-[#E5E2DA] bg-[#FAF9F7] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 flex-shrink-0">
              <AlertTriangle size={17} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1E3932]">
                Today&apos;s Attention — Tindakan Operasional Hari Ini
              </h2>
              <p className="text-xs text-[#5C6F68]">
                Prioritas operasional langsung untuk pemilik bisnis sebelum cut-off kurir 17:00 WIB
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 self-start sm:self-auto">
            <span>Perhatian Operasional</span>
          </span>
        </div>

        <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Item 1: Pending Orders */}
          <div className="p-4 rounded-xl border border-amber-200 bg-[#FFFDF7] flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">
                  Pesanan Masuk
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                  Cutoff 17:00
                </span>
              </div>
              <h3 className="font-bold text-sm text-[#1E3932]">
                4 Pesanan Perlu Packing
              </h3>
              <p className="text-xs text-[#5C6F68] leading-relaxed">
                Pesanan instant & sameday area Jakarta harus selesai dipack ke cooler bag sebelum batas kurir.
              </p>
            </div>
            <div className="pt-2 border-t border-amber-100 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-amber-900">
                17:00 WIB
              </span>
              <Link
                href="/admin/orders"
                className="text-xs font-bold text-[#00754A] hover:underline flex items-center gap-1"
              >
                <span>Lihat Pesanan</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Item 2: Inventory Nearing Expiry */}
          <div className="p-4 rounded-xl border border-rose-200 bg-[#FFF9F9] flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#C62828] uppercase tracking-wide">
                  Rotasi FEFO
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]">
                  6 Hari Lagi
                </span>
              </div>
              <h3 className="font-bold text-sm text-[#1E3932]">
                Melon 1L (LOT #CY-2026-08D)
              </h3>
              <p className="text-xs text-[#5C6F68] leading-relaxed">
                Tersisa 45 botol kedaluwarsa 28 Sep 2026. Alokasi pengiriman otomatis prioritaskan lot ini.
              </p>
            </div>
            <div className="pt-2 border-t border-rose-100 flex items-center justify-between">
              <span className="text-xs font-bold text-[#C62828]">
                Prioritas Keluar
              </span>
              <Link
                href="/admin/inventory"
                className="text-xs font-bold text-[#00754A] hover:underline flex items-center gap-1"
              >
                <span>Cek Stok</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Item 3: Cold Chain Sensor Status (Truthful - No Fake Temp) */}
          <div className="p-4 rounded-xl border border-[#E5E2DA] bg-[#FAF9F7] flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#5C6F68] uppercase tracking-wide">
                  Sensor Cold Chain
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#5C6F68] border border-[#E5E2DA]">
                  Siap Terhubung
                </span>
              </div>
              <h3 className="font-bold text-sm text-[#1E3932]">
                Sensor Belum Terpasang
              </h3>
              <p className="text-xs text-[#5C6F68] leading-relaxed">
                Belum ada sumber data sensor terhubung. Protokol cold-chain manual tetap dipatuhi.
              </p>
            </div>
            <div className="pt-2 border-t border-[#E5E2DA] flex items-center justify-between">
              <span className="text-xs text-[#5C6F68]">
                Modul IoT Ready
              </span>
              <Link
                href="/admin/cold-chain"
                className="text-xs font-bold text-[#00754A] hover:underline flex items-center gap-1"
              >
                <span>Detail Sensor</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Item 4: Dispatch Instruction */}
          <div className="p-4 rounded-xl border border-[#E5E2DA] bg-[#FAF9F7] flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#5C6F68] uppercase tracking-wide">
                  Instruksi Kirim
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#5C6F68] border border-[#E5E2DA]">
                  Standard Operasi
                </span>
              </div>
              <h3 className="font-bold text-sm text-[#1E3932]">
                Inspeksi Kemasan Dingin
              </h3>
              <p className="text-xs text-[#5C6F68] leading-relaxed">
                Pastikan setiap paket menggunakan ice gel beku dan tersegel rapat sebelum serah terima kurir.
              </p>
            </div>
            <div className="pt-2 border-t border-[#E5E2DA] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1E3932]">
                Gunakan Ice Gel
              </span>
              <span className="text-xs font-bold text-[#00754A]">
                SOP-01 Sesuai
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: RECENT ORDERS PREVIEW & INVENTORY ATTENTION PREVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 Cols): Recent Orders Preview (max 5) */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-[#E5E2DA] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#1E3932]">
                  Recent Orders Preview
                </h3>
                <p className="text-xs text-[#5C6F68]">
                  5 transaksi terbaru tersinkronisasi dengan ERP Core
                </p>
              </div>
              <Link
                href="/admin/orders"
                className="px-3 py-1.5 rounded-xl border border-[#D5D1C7] hover:bg-[#FAF9F7] text-xs font-bold text-[#00754A] flex items-center gap-1.5 transition-colors"
              >
                <span>View all orders</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-[#1E3932]">
                <thead className="bg-[#FAF9F7] text-[#5C6F68] font-bold uppercase text-[10px] tracking-wider border-b border-[#E5E2DA]">
                  <tr>
                    <th className="px-4 py-3">Order ID</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Product & Variant</th>
                    <th className="px-4 py-3 text-center">Qty</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Waktu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E2DA]">
                  {RECENT_ORDERS_PREVIEW.map((tx) => (
                    <tr key={tx.id} className="hover:bg-[#FDFCFB] transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-[#1E3932]">
                        {tx.id}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-[#1E3932] block">
                          {tx.customer}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-[#1E3932] block">
                          {tx.variant}
                        </span>
                        <span className="text-[10px] text-[#5C6F68]">
                          {tx.courier}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold">
                        {tx.qty}
                      </td>
                      <td className="px-4 py-3 font-bold text-[#1E3932]">
                        Rp {tx.amount.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                            tx.status === "CONFIRMED"
                              ? "bg-[#E8F5E9] text-[#1E3932] border border-[#C8E6C9]"
                              : tx.status === "IN DELIVERY"
                                ? "bg-blue-50 text-blue-800 border border-blue-200"
                                : tx.status === "PACKED"
                                  ? "bg-amber-50 text-amber-900 border border-amber-200"
                                  : "bg-[#FAF9F7] text-[#5C6F68] border border-[#E5E2DA]"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#5C6F68] text-[11px] whitespace-nowrap">
                        {tx.time}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card-based View */}
            <div className="md:hidden divide-y divide-[#E5E2DA]">
              {RECENT_ORDERS_PREVIEW.map((tx) => (
                <div key={tx.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-[#1E3932]">
                      {tx.id}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                        tx.status === "CONFIRMED"
                          ? "bg-[#E8F5E9] text-[#1E3932] border border-[#C8E6C9]"
                          : tx.status === "IN DELIVERY"
                            ? "bg-blue-50 text-blue-800 border border-blue-200"
                            : tx.status === "PACKED"
                              ? "bg-amber-50 text-amber-900 border border-amber-200"
                              : "bg-[#FAF9F7] text-[#5C6F68] border border-[#E5E2DA]"
                      }`}
                    >
                      {tx.status}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-xs text-[#1E3932] block">
                      {tx.customer}
                    </span>
                    <span className="text-[11px] text-[#5C6F68] block">
                      {tx.variant} (Qty: {tx.qty})
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-[#E5E2DA]/60 text-xs">
                    <span className="text-[11px] text-[#5C6F68]">{tx.time}</span>
                    <span className="font-bold text-sm text-[#1E3932]">
                      Rp {tx.amount.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (4 Cols): Inventory Attention Preview & Cold Chain Card */}
        <div className="lg:col-span-4 space-y-6">
          {/* Inventory Attention Preview Card */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E2DA] pb-3">
              <div className="flex items-center gap-2">
                <Boxes size={16} className="text-[#00754A]" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#1E3932]">
                  Inventory Attention
                </h3>
              </div>
              <Link
                href="/admin/inventory"
                className="text-xs font-bold text-[#00754A] hover:underline"
              >
                Semua Stok &rarr;
              </Link>
            </div>

            <div className="space-y-3">
              {INVENTORY_ATTENTION_PREVIEW.map((item, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-[#E5E2DA] bg-[#FAF9F7] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#1E3932] truncate">
                      {item.product}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.fefoStatus === "Critical"
                          ? "bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]"
                          : "bg-amber-50 text-amber-900 border border-amber-200"
                      }`}
                    >
                      {item.fefoStatus}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#5C6F68]">
                    <span>{item.variant} • {item.lot}</span>
                    <span className="font-bold text-[#1E3932]">{item.stock} botol</span>
                  </div>
                  <p className="text-[10px] text-[#5C6F68]">
                    Kedaluwarsa: {item.expiry} ({item.daysRemaining} hari lagi)
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Cold Chain Status Summary Card */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E2DA] pb-3">
              <div className="flex items-center gap-2">
                <Snowflake size={16} className="text-[#00754A]" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#1E3932]">
                  Cold Chain Status
                </h3>
              </div>
              <Link
                href="/admin/cold-chain"
                className="text-xs font-bold text-[#00754A] hover:underline"
              >
                Detail &rarr;
              </Link>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E5E2DA] space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-xs font-bold text-[#1E3932]">
                  Status Sensor: Belum Terhubung
                </span>
              </div>
              <p className="text-xs text-[#5C6F68] leading-relaxed">
                Belum ada sumber data sensor terhubung. Monitoring suhu saat ini menggunakan formulir inspeksi manual sesuai SOP-01 dan SOP-07.
              </p>
            </div>

            <div className="text-[11px] text-[#5C6F68] flex items-center justify-between pt-1 border-t border-[#E5E2DA]">
              <span>Standar Penyimpanan:</span>
              <span className="font-bold text-[#00754A]">0.0°C – 5.0°C</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
