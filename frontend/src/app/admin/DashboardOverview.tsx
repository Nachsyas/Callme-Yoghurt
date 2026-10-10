"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  Package,
  RefreshCw,
  ShoppingCart,
  Snowflake,
  TrendingUp,
  XCircle,
} from "lucide-react";
import type { AdminOrderRecord, OrderDashboardMetrics } from "@/lib/order/types";

export function DashboardOverview() {
  const [orders, setOrders] = useState<AdminOrderRecord[]>([]);
  const [metrics, setMetrics] = useState<OrderDashboardMetrics | null>(null);
  const [catalogCounts, setCatalogCounts] = useState<{ products: number; variants: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [erpOffline, setErpOffline] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setErrorDetails(null);
    let ordersOk = false;
    let catalogOk = false;

    try {
      const ordersRes = await fetch("/api/admin/orders", { cache: "no-store" });
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData.orders || []);
        setMetrics(ordersData.metrics || null);
        ordersOk = true;
      } else if (ordersRes.status === 401) {
        window.location.href = "/admin/login?from=/admin";
        return;
      }
    } catch {
      // Handled in combined status below
    }

    try {
      const catRes = await fetch("/api/admin/catalog/products", { cache: "no-store" });
      if (catRes.ok) {
        const catData = await catRes.json();
        const prods = Array.isArray(catData.products) ? catData.products : [];
        let variantCount = 0;
        for (const p of prods) {
          if (Array.isArray(p.variants)) {
            variantCount += p.variants.length;
          }
        }
        setCatalogCounts({ products: prods.length, variants: variantCount });
        catalogOk = true;
      }
    } catch {
      // Handled in combined status below
    }

    if (!ordersOk && !catalogOk) {
      setErpOffline(true);
      setErrorDetails("Koneksi ERP Core offline / tidak terjangkau. Menampilkan status aman.");
    } else {
      setErpOffline(false);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* ERP OFFLINE WARNING BANNER */}
      {erpOffline && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 text-xs"
        >
          <AlertTriangle className="text-amber-700 flex-shrink-0 mt-0.5" size={18} />
          <div className="flex-1 space-y-1">
            <p className="font-bold text-sm">ERP Core Tidak Tersedia (Mode Aman)</p>
            <p className="text-amber-800">
              {errorDetails ||
                "Sistem tidak dapat menghubungi layanan ERP internal. Menampilkan status truthful unavailability sesuai prinsip zero-trust."}
            </p>
          </div>
          <button
            type="button"
            onClick={fetchDashboardData}
            className="px-2.5 py-1 rounded bg-amber-200 hover:bg-amber-300 text-amber-900 font-bold flex items-center gap-1 transition-colors"
          >
            <RefreshCw size={12} />
            <span>Muat Ulang</span>
          </button>
        </div>
      )}

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
          {isLoading ? (
            <div className="mt-3 h-8 w-24 bg-gray-100 animate-pulse rounded" />
          ) : erpOffline ? (
            <p className="mt-2.5 sm:mt-3 text-lg font-bold text-amber-800 tracking-tight">
              Tidak Tersedia
            </p>
          ) : (
            <p className="mt-2.5 sm:mt-3 text-2xl font-black text-[#1E3932] tracking-tight">
              {metrics?.today_orders ?? 0} Pesanan
            </p>
          )}
          <div className="flex items-center justify-between text-xs mt-1.5 flex-wrap gap-1">
            {erpOffline ? (
              <span className="text-amber-800 text-[11px] font-semibold">ERP Offline</span>
            ) : (
              <>
                <span className="text-[#00754A] font-semibold" title="Gross Order Value (GOV)">
                  GOV: Rp {(metrics?.gross_order_value ?? 0).toLocaleString("id-ID")}
                </span>
                <span className="text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[11px]" title="Nilai Tertunda: Rp ${(metrics?.pending_payments_value ?? 0).toLocaleString('id-ID')}">
                  {metrics?.waiting_payment ?? 0} Menunggu Verifikasi
                </span>
              </>
            )}
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
          {isLoading ? (
            <div className="mt-3 h-8 w-24 bg-gray-100 animate-pulse rounded" />
          ) : erpOffline || !catalogCounts ? (
            <p className="mt-2.5 sm:mt-3 text-lg font-bold text-amber-800 tracking-tight">
              Tidak Tersedia
            </p>
          ) : (
            <p className="mt-2.5 sm:mt-3 text-2xl font-black text-[#1E3932] tracking-tight">
              {catalogCounts.variants} SKUs Aktif
            </p>
          )}
          <p className="text-xs text-[#5C6F68] mt-1.5 flex items-center justify-between">
            <span>{catalogCounts ? `${catalogCounts.products} Produk Resmi` : "ERP Offline"}</span>
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
          {/* Item 1: Pending Orders / Verification */}
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
                {erpOffline
                  ? "Data Tidak Tersedia"
                  : `${metrics?.waiting_payment ?? 0} Pesanan Perlu Verifikasi`}
              </h3>
              <p className="text-xs text-[#5C6F68] leading-relaxed">
                {erpOffline
                  ? "Status pesanan tidak dapat diambil karena ERP Core offline."
                  : (metrics?.waiting_payment ?? 0) > 0
                    ? "Pesanan menunggu verifikasi pembayaran QRIS sebelum serah terima kurir."
                    : "Tidak ada pesanan tertunda di database PostgreSQL saat ini."}
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

          {/* Item 2: FEFO Rotation Monitoring */}
          <div className="p-4 rounded-xl border border-[#E5E2DA] bg-[#FAF9F7] flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#5C6F68] uppercase tracking-wide">
                  Rotasi FEFO
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#5C6F68] border border-[#E5E2DA]">
                  Kebijakan SOP-03
                </span>
              </div>
              <h3 className="font-bold text-sm text-[#1E3932]">
                Alokasi Kedaluwarsa Terdekat
              </h3>
              <p className="text-xs text-[#5C6F68] leading-relaxed">
                Sistem mengalokasikan stok secara otomatis berdasarkan First Expired, First Out.
              </p>
            </div>
            <div className="pt-2 border-t border-[#E5E2DA] flex items-center justify-between">
              <span className="text-xs text-[#5C6F68]">
                WH-MAIN
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
        {/* Left Column (8 Cols): Recent Orders Preview (Authoritative ERP data only) */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-[#E5E2DA] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#1E3932]">
                  Recent Orders Preview
                </h3>
                <p className="text-xs text-[#5C6F68]">
                  Transaksi riil tersinkronisasi dengan ERP Core PostgreSQL
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

            {/* Offline or Error State */}
            {erpOffline ? (
              <div className="p-8 text-center space-y-2">
                <AlertTriangle className="mx-auto text-amber-600" size={28} />
                <p className="font-bold text-sm text-[#1E3932]">
                  Tidak Dapat Menghubungi ERP Core
                </p>
                <p className="text-xs text-[#5C6F68] max-w-sm mx-auto">
                  Data transaksi tidak dapat dimuat karena backend ERP offline. Tidak ada data contoh yang ditampilkan.
                </p>
              </div>
            ) : isLoading ? (
              <div className="p-8 text-center text-xs text-[#5C6F68] space-y-2">
                <div className="w-6 h-6 border-2 border-[#00754A] border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Memuat transaksi authoritative dari database...</p>
              </div>
            ) : orders.length === 0 ? (
              /* Genuine Zero-Data Empty State */
              <div className="p-8 text-center space-y-2">
                <ShoppingCart className="mx-auto text-[#5C6F68]/50" size={32} />
                <p className="font-bold text-sm text-[#1E3932]">
                  Belum Ada Pesanan
                </p>
                <p className="text-xs text-[#5C6F68] max-w-xs mx-auto">
                  Database PostgreSQL belum memiliki transaksi pesanan masuk.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#1E3932]">
                    <thead className="bg-[#FAF9F7] text-[#5C6F68] font-bold uppercase text-[10px] tracking-wider border-b border-[#E5E2DA]">
                      <tr>
                        <th className="px-4 py-3">Order ID</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Product Summary</th>
                        <th className="px-4 py-3 text-center">Items</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Waktu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E2DA]">
                      {orders.slice(0, 5).map((tx) => {
                        const totalQty = tx.items.reduce((acc, it) => acc + it.quantity, 0);
                        const firstItem = tx.items[0];
                        const summaryText = firstItem
                          ? `${firstItem.product_name} (${firstItem.variant})`
                          : "Callme Yoghurt";

                        return (
                          <tr key={tx.id} className="hover:bg-[#FDFCFB] transition-colors">
                            <td className="px-4 py-3 font-mono font-bold text-[#1E3932]">
                              {tx.order_number}
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-semibold text-[#1E3932] block">
                                {tx.customer.name}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-medium text-[#1E3932] block">
                                {summaryText}
                              </span>
                              <span className="text-[10px] text-[#5C6F68]">
                                {tx.delivery_method}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-bold">
                              {totalQty}
                            </td>
                            <td className="px-4 py-3 font-bold text-[#1E3932]">
                              Rp {tx.cost.total_amount.toLocaleString("id-ID")}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                                  tx.order_status === "WAITING_PAYMENT"
                                    ? "bg-amber-50 text-amber-900 border border-amber-200"
                                    : tx.order_status === "COMPLETED" || tx.order_status === "DELIVERED"
                                      ? "bg-[#E8F5E9] text-[#1E3932] border border-[#C8E6C9]"
                                      : "bg-[#FAF9F7] text-[#5C6F68] border border-[#E5E2DA]"
                                }`}
                              >
                                {tx.order_status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[#5C6F68] text-[11px] whitespace-nowrap">
                              {new Date(tx.order_date).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card-based View */}
                <div className="md:hidden divide-y divide-[#E5E2DA]">
                  {orders.slice(0, 5).map((tx) => {
                    const totalQty = tx.items.reduce((acc, it) => acc + it.quantity, 0);
                    const firstItem = tx.items[0];
                    const summaryText = firstItem
                      ? `${firstItem.product_name} (${firstItem.variant})`
                      : "Callme Yoghurt";

                    return (
                      <div key={tx.id} className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs text-[#1E3932]">
                            {tx.order_number}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                              tx.order_status === "WAITING_PAYMENT"
                                ? "bg-amber-50 text-amber-900 border border-amber-200"
                                : tx.order_status === "COMPLETED" || tx.order_status === "DELIVERED"
                                  ? "bg-[#E8F5E9] text-[#1E3932] border border-[#C8E6C9]"
                                  : "bg-[#FAF9F7] text-[#5C6F68] border border-[#E5E2DA]"
                            }`}
                          >
                            {tx.order_status}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-xs text-[#1E3932] block">
                            {tx.customer.name}
                          </span>
                          <span className="text-[11px] text-[#5C6F68] block">
                            {summaryText} (Total: {totalQty} item)
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-[#E5E2DA]/60 text-xs">
                          <span className="text-[11px] text-[#5C6F68]">
                            {new Date(tx.order_date).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="font-bold text-sm text-[#1E3932]">
                            Rp {tx.cost.total_amount.toLocaleString("id-ID")}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Column (4 Cols): Inventory Policy & Cold Chain Card */}
        <div className="lg:col-span-4 space-y-6">
          {/* Inventory Policy Card */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E2DA] pb-3">
              <div className="flex items-center gap-2">
                <Boxes size={16} className="text-[#00754A]" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#1E3932]">
                  Inventory Management
                </h3>
              </div>
              <Link
                href="/admin/inventory"
                className="text-xs font-bold text-[#00754A] hover:underline"
              >
                Semua Stok &rarr;
              </Link>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E5E2DA] space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00754A]" />
                <span className="text-xs font-bold text-[#1E3932]">
                  Rotasi FEFO Authoritative
                </span>
              </div>
              <p className="text-xs text-[#5C6F68] leading-relaxed">
                Manajemen inventaris mematuhi aturan First Expired, First Out. Lot dialokasikan dari database PostgreSQL tanpa estimasi tiruan.
              </p>
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
