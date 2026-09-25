"use client";

import React, { useState } from "react";
import { CheckCircle2, Filter, RefreshCw, Search, ShoppingCart, Truck } from "lucide-react";

interface OrderRecord {
  id: string;
  orderNumber: string;
  customerName: string;
  customerAddress: string;
  variant: string;
  qty: number;
  courier: string;
  totalAmount: number;
  status: "CONFIRMED" | "PACKED" | "IN DELIVERY" | "DELIVERED";
  createdAt: string;
}

const ORDERS_DATA: OrderRecord[] = [
  {
    id: "ord-001",
    orderNumber: "CY-2026-0042",
    customerName: "Budi S****",
    customerAddress: "Jakarta Timur, DKI Jakarta",
    variant: "Plain Pure Original 1000ml",
    qty: 2,
    courier: "Instant Courier (Cooler Bag + Ice Gel)",
    totalAmount: 110000,
    status: "CONFIRMED",
    createdAt: "10 menit lalu",
  },
  {
    id: "ord-002",
    orderNumber: "CY-2026-0041",
    customerName: "Siti A****",
    customerAddress: "Jakarta Selatan, DKI Jakarta",
    variant: "Stroberi Summer Blush 250ml",
    qty: 4,
    courier: "Sameday Delivery (Cold Box)",
    totalAmount: 60000,
    status: "IN DELIVERY",
    createdAt: "28 menit lalu",
  },
  {
    id: "ord-003",
    orderNumber: "CY-2026-0040",
    customerName: "Hendro W****",
    customerAddress: "Bekasi Barat, Jawa Barat",
    variant: "Mangga Tropical Gold 250ml",
    qty: 3,
    courier: "Instant Courier (Cooler Bag + Ice Gel)",
    totalAmount: 45000,
    status: "PACKED",
    createdAt: "1 jam lalu",
  },
  {
    id: "ord-004",
    orderNumber: "CY-2026-0039",
    customerName: "Dewi L****",
    customerAddress: "Depok, Jawa Barat",
    variant: "Melon Emerald Fresh 1000ml",
    qty: 1,
    courier: "Sameday Delivery (Cold Box Ganda)",
    totalAmount: 55000,
    status: "DELIVERED",
    createdAt: "2 jam lalu",
  },
  {
    id: "ord-005",
    orderNumber: "CY-2026-0038",
    customerName: "Rian K****",
    customerAddress: "Jakarta Pusat, DKI Jakarta",
    variant: "Anggur Royal Purple 250ml",
    qty: 6,
    courier: "Instant Courier (Cooler Bag + Ice Gel)",
    totalAmount: 90000,
    status: "DELIVERED",
    createdAt: "3 jam lalu",
  },
  {
    id: "ord-006",
    orderNumber: "CY-2026-0037",
    customerName: "Ahmad M****",
    customerAddress: "Tangerang Selatan, Banten",
    variant: "Vanila Creamy Dream 1000ml",
    qty: 2,
    courier: "Sameday Delivery (Cold Box)",
    totalAmount: 110000,
    status: "DELIVERED",
    createdAt: "5 jam lalu",
  },
  {
    id: "ord-007",
    orderNumber: "CY-2026-0036",
    customerName: "Putri R****",
    customerAddress: "Jakarta Barat, DKI Jakarta",
    variant: "Leci Sweet Breeze 250ml",
    qty: 4,
    courier: "Instant Courier (Cooler Bag)",
    totalAmount: 60000,
    status: "DELIVERED",
    createdAt: "6 jam lalu",
  },
];

export default function AdminOrdersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "CONFIRMED" | "PACKED" | "IN DELIVERY" | "DELIVERED">("ALL");

  const filteredOrders = ORDERS_DATA.filter((order) => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.variant.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter !== "ALL" && order.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#1E3932]">
            Manajemen Pesanan
          </h2>
          <p className="text-xs text-[#5C6F68] mt-0.5">
            Buku besar transaksi append-only tersinkronisasi dengan ERP Core
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#E8F5E9] text-[#1E3932] border border-[#C8E6C9] text-xs font-semibold">
            <CheckCircle2 size={13} className="text-[#00754A]" />
            <span>Integrasi ERP Aktif</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FAF9F7] text-[#5C6F68] border border-[#E5E2DA] text-xs font-mono">
            Protokol Dingin Wajib
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A9590]" />
          <input
            type="text"
            placeholder="Cari order number, nama pelanggan, varian..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs text-[#1E3932] placeholder-[#8A9590] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(["ALL", "CONFIRMED", "PACKED", "IN DELIVERY", "DELIVERED"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === st
                  ? "bg-[#00754A] text-white font-bold shadow-sm"
                  : "bg-[#FAF9F7] text-[#5C6F68] border border-[#D5D1C7] hover:bg-[#F2F0EB]"
              }`}
            >
              {st === "ALL" ? "Semua" : st}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table (Desktop & Tablet) */}
      <div className="bg-white rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1E3932]">
            <thead className="bg-[#FAF9F7] text-[#5C6F68] font-bold uppercase text-[10px] tracking-wider border-b border-[#E5E2DA]">
              <tr>
                <th className="px-4 py-3">Order Number</th>
                <th className="px-4 py-3">Pelanggan</th>
                <th className="px-4 py-3">Produk & Varian</th>
                <th className="px-4 py-3 text-center">Qty</th>
                <th className="px-4 py-3">Metode Pengiriman</th>
                <th className="px-4 py-3">Total Nilai ERP</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Waktu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E2DA]">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#5C6F68]">
                    Belum ada data pesanan yang cocok dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-[#FDFCFB] transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#1E3932]">
                      {order.orderNumber}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-[#1E3932] block">
                        {order.customerName}
                      </span>
                      <span className="text-[10px] text-[#5C6F68]">
                        {order.customerAddress}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-[#1E3932]">
                      {order.variant}
                    </td>
                    <td className="px-4 py-3 text-center font-bold font-mono">
                      {order.qty}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[#1E3932] block">
                        {order.courier}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-[#1E3932]">
                      Rp {order.totalAmount.toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                          order.status === "CONFIRMED"
                            ? "bg-[#E8F5E9] text-[#1E3932] border border-[#C8E6C9]"
                            : order.status === "IN DELIVERY"
                              ? "bg-blue-50 text-blue-800 border border-blue-200"
                              : order.status === "PACKED"
                                ? "bg-amber-50 text-amber-900 border border-amber-200"
                                : "bg-[#FAF9F7] text-[#5C6F68] border border-[#E5E2DA]"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#5C6F68] text-[11px] whitespace-nowrap">
                      {order.createdAt}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View (Card-based) */}
        <div className="md:hidden divide-y divide-[#E5E2DA]">
          {filteredOrders.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#5C6F68]">
              Belum ada data pesanan yang cocok dengan kriteria filter.
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div key={order.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-[#1E3932]">
                    {order.orderNumber}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                      order.status === "CONFIRMED"
                        ? "bg-[#E8F5E9] text-[#1E3932] border border-[#C8E6C9]"
                        : order.status === "IN DELIVERY"
                          ? "bg-blue-50 text-blue-800 border border-blue-200"
                          : order.status === "PACKED"
                            ? "bg-amber-50 text-amber-900 border border-amber-200"
                            : "bg-[#FAF9F7] text-[#5C6F68] border border-[#E5E2DA]"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-xs text-[#1E3932] block">
                    {order.customerName}
                  </span>
                  <span className="text-[11px] text-[#5C6F68] block">
                    {order.variant} (Qty: {order.qty})
                  </span>
                  <span className="text-[10px] text-[#5C6F68] block">
                    {order.courier}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-[#E5E2DA]/60 text-xs">
                  <span className="text-[11px] text-[#5C6F68]">{order.createdAt}</span>
                  <span className="font-bold text-sm text-[#1E3932]">
                    Rp {order.totalAmount.toLocaleString("id-ID")}
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
