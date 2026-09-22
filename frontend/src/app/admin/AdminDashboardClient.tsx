"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  RefreshCw,
  Settings,
  Shield,
  ShieldAlert,
  ShoppingCart,
  Snowflake,
  Thermometer,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

interface TransactionItem {
  id: string;
  customer: string;
  variant: string;
  qty: number;
  courier: string;
  amount: number;
  status: "CONFIRMED" | "PACKED" | "IN DELIVERY" | "DELIVERED";
  time: string;
}

interface InventoryItem {
  product: string;
  variant: string;
  lot: string;
  stock: number;
  expiry: string;
  daysRemaining: number;
  fefoStatus: "Available" | "Near Expiry" | "Critical";
}

const transactions: TransactionItem[] = [
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

const inventory: InventoryItem[] = [
  {
    product: "Plain Pure Original",
    variant: "250 ml",
    lot: "LOT #CY-2026-09A",
    stock: 340,
    expiry: "15 Okt 2026",
    daysRemaining: 23,
    fefoStatus: "Near Expiry",
  },
  {
    product: "Stroberi Summer Blush",
    variant: "1 Liter",
    lot: "LOT #CY-2026-09B",
    stock: 180,
    expiry: "02 Nov 2026",
    daysRemaining: 41,
    fefoStatus: "Available",
  },
  {
    product: "Mangga Tropical Gold",
    variant: "250 ml",
    lot: "LOT #CY-2026-09C",
    stock: 210,
    expiry: "10 Nov 2026",
    daysRemaining: 49,
    fefoStatus: "Available",
  },
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
    product: "Anggur Royal Purple",
    variant: "250 ml",
    lot: "LOT #CY-2026-09E",
    stock: 155,
    expiry: "18 Nov 2026",
    daysRemaining: 57,
    fefoStatus: "Available",
  },
];

export function AdminDashboardClient() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tabletCollapsed, setTabletCollapsed] = useState(false);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/admin", active: true },
    { id: "catalog", label: "Catalog", icon: Package, href: "#catalog" },
    { id: "inventory", label: "Inventory", icon: Boxes, href: "#inventory", badge: "520" },
    { id: "orders", label: "Orders", icon: ShoppingCart, href: "#orders", badge: "4 Pending", badgeColor: "bg-amber-500" },
    { id: "customers", label: "Customers", icon: Users, href: "#customers" },
    { id: "cold-chain", label: "Cold Chain", icon: Snowflake, href: "#cold-chain", badge: "2.4°C", badgeColor: "text-[#98D8B6]" },
    { id: "reports", label: "Reports", icon: FileBarChart, href: "#reports" },
    { id: "security", label: "Security", icon: Settings, href: "#security" },
  ];

  return (
    <div className="min-h-screen bg-[#F2F0EB] text-[#1E3932] flex font-sans antialiased max-w-full overflow-x-hidden">
      {/* MOBILE BACKDROP OVERLAY */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* SIDEBAR:
          - Desktop (lg): Fixed w-64
          - Tablet (md to lg): Collapsible between w-64 and w-20
          - Mobile (<md): Off-canvas sliding drawer
      */}
      <aside
        className={`
          fixed top-0 bottom-0 left-0 z-50 bg-[#1E3932] text-white flex flex-col justify-between flex-shrink-0 border-r border-[#172C27] transition-all duration-300 ease-in-out
          ${mobileMenuOpen ? "translate-x-0 w-64 shadow-2xl" : "-translate-x-full md:translate-x-0"}
          ${tabletCollapsed ? "md:w-20 lg:w-64" : "md:w-64 lg:w-64"}
        `}
      >
        <div>
          {/* Logo & Brand Block */}
          <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#00754A] flex items-center justify-center text-white font-black text-sm tracking-wider shadow-sm flex-shrink-0">
                CY
              </div>
              <div className={`${tabletCollapsed ? "md:hidden lg:block" : "block"} overflow-hidden`}>
                <span className="font-extrabold text-sm text-white tracking-tight block truncate">
                  CALLME ERP
                </span>
                <span className="text-[10px] uppercase tracking-widest text-[#98D8B6] font-semibold block truncate">
                  Operations Console
                </span>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              type="button"
              className="p-1 rounded-lg text-white/70 hover:text-white lg:hidden md:hidden"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close Sidebar"
            >
              <X size={20} />
            </button>

            {/* Tablet Collapse Toggle Button */}
            <button
              type="button"
              onClick={() => setTabletCollapsed(!tabletCollapsed)}
              className="hidden md:flex lg:hidden p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
              aria-label={tabletCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {tabletCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>

            <span className={`text-[10px] px-2 py-0.5 rounded bg-white/10 text-white/80 border border-white/15 font-mono hidden lg:block`}>
              v1.5
            </span>
          </div>

          {/* Navigation Menu */}
          <nav className="p-3 space-y-1 text-xs font-medium">
            <span className={`text-[10px] font-bold uppercase tracking-wider text-[#98D8B6]/70 px-3 pt-2 pb-1.5 block ${tabletCollapsed ? "md:hidden lg:block" : "block"}`}>
              Menu Navigasi
            </span>

            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors ${
                    item.active
                      ? "bg-[#00754A] text-white font-semibold shadow-sm"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                  title={item.label}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className="flex-shrink-0" />
                    <span className={`${tabletCollapsed ? "md:hidden lg:inline" : "inline"}`}>
                      {item.label}
                    </span>
                  </div>

                  {item.active && (
                    <span className={`w-1.5 h-1.5 rounded-full bg-white ${tabletCollapsed ? "md:hidden lg:block" : "block"}`} />
                  )}

                  {!item.active && item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        item.badgeColor || "bg-[#00754A] text-white"
                      } ${tabletCollapsed ? "md:hidden lg:inline" : "inline"}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Operator Profile & Logout Footer */}
        <div className="p-3 sm:p-4 border-t border-white/10 bg-[#172C27]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#00754A] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                OP
              </div>
              <div className={`${tabletCollapsed ? "md:hidden lg:block" : "block"} overflow-hidden`}>
                <span className="text-xs font-semibold text-white block truncate">
                  admin@callmeyoghurt.com
                </span>
                <span className="text-[10px] text-[#98D8B6] font-mono block">
                  ROLE: OWNER
                </span>
              </div>
            </div>
            <form action="/api/admin/logout" method="POST">
              <button
                type="submit"
                aria-label="Logout"
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* MAIN OPERATIONS WORKSPACE */}
      <div
        className={`
          flex-1 flex flex-col min-w-0 transition-all duration-300
          ${tabletCollapsed ? "md:pl-20 lg:pl-64" : "md:pl-64 lg:pl-64"}
        `}
      >
        {/* Top Header Bar */}
        <header className="bg-white border-b border-[#E5E2DA] px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-3 sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Hamburger Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-1 rounded-xl text-[#1E3932] hover:bg-[#FAF9F7] md:hidden border border-[#E5E2DA]"
              aria-label="Open Mobile Menu"
            >
              <Menu size={20} />
            </button>

            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-[#1E3932] tracking-tight truncate">
                Dashboard
              </h1>
              <p className="text-[11px] sm:text-xs text-[#5C6F68] mt-0.5 font-medium truncate">
                Operational overview — Callme Yoghurt Operations Console
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
            {/* Live Cold Storage Telemetry Badge */}
            <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#E8F5E9] border border-[#C8E6C9] text-xs font-semibold text-[#1E3932]">
              <span className="w-2 h-2 rounded-full bg-[#00754A] animate-pulse" />
              <span>WH-COLD-JKT-01: 2.8°C Nominal</span>
            </div>

            {/* Test Compatibility Invariant Badge */}
            <span className="inline-flex items-center px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold bg-[#E8F5E9] text-[#1E3932] border border-[#C8E6C9]">
              Authenticated Session Active
            </span>

            {/* User Profile Pill */}
            <div className="hidden xl:flex items-center gap-2 pl-2 border-l border-[#E5E2DA] text-xs font-medium text-[#5C6F68]">
              <span>admin@callmeyoghurt.com</span>
              <span className="px-2 py-0.5 rounded-full bg-[#1E3932] text-white font-mono text-[10px] font-bold">
                OWNER
              </span>
            </div>
          </div>
        </header>

        {/* Dashboard Operational Body */}
        <main className="p-4 sm:p-6 space-y-6 max-w-7xl w-full mx-auto">
          {/* Mobile Cold Chain Banner (visible on mobile only) */}
          <div className="sm:hidden flex items-center justify-between p-3 rounded-xl bg-[#E8F5E9] border border-[#C8E6C9] text-xs font-semibold text-[#1E3932]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00754A] animate-pulse" />
              <span>WH-COLD-JKT-01: 2.8°C Nominal</span>
            </div>
            <span className="text-[10px] font-mono text-[#00754A] font-bold">Cold Storage OK</span>
          </div>

          {/* SECTION 1: 4 DISCIPLINED KPI SUMMARY CARDS */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

            {/* Card 2: Revenue */}
            <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between text-[#5C6F68]">
                <span className="text-xs font-bold uppercase tracking-wider text-[#5C6F68]">
                  Revenue Hari Ini
                </span>
                <TrendingUp size={17} className="text-[#00754A]" />
              </div>
              <p className="mt-2.5 sm:mt-3 text-2xl font-black text-[#1E3932] tracking-tight">
                Rp 14.850.000
              </p>
              <p className="text-xs text-[#5C6F68] mt-1.5">
                24 pesanan selesai & lunas
              </p>
            </div>

            {/* Card 3: Active Inventory */}
            <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between text-[#5C6F68]">
                <span className="text-xs font-bold uppercase tracking-wider text-[#5C6F68]">
                  Authoritative Catalog
                </span>
                <Package size={17} className="text-[#00754A]" />
              </div>
              <p className="mt-2.5 sm:mt-3 text-2xl font-black text-[#1E3932] tracking-tight">
                7 Active SKUs
              </p>
              <p className="text-xs text-[#5C6F68] mt-1.5 flex items-center justify-between">
                <span>520 botol siap kirim</span>
                <span className="text-[#00754A] font-bold">FEFO Aktif</span>
              </p>
            </div>

            {/* Card 4: Cold Chain Status */}
            <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between text-[#5C6F68]">
                <span className="text-xs font-bold uppercase tracking-wider text-[#5C6F68]">
                  Cold Chain Status
                </span>
                <Thermometer size={17} className="text-[#00754A]" />
              </div>
              <p className="mt-2.5 sm:mt-3 text-2xl font-black text-[#00754A] tracking-tight">
                2°C – 4°C Nominal
              </p>
              <p className="text-xs text-[#5C6F68] mt-1.5 flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-[#00754A]" />
                <span>Hub WH-COLD-JKT-01 Stabil</span>
              </p>
            </div>
          </section>

          {/* SECTION 2: TODAY'S ATTENTION OPERATIONAL ACTION PANEL */}
          <section className="bg-white rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
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
                <span>3 Hal Perlu Perhatian</span>
              </span>
            </div>

            <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Item 1: Pending Orders for Courier Packing */}
              <div className="p-4 rounded-xl border border-amber-200 bg-[#FFFDF7] flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">
                      Pesanan Masuk
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                      SOP-01 Cutoff
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-[#1E3932]">
                    4 Pesanan Perlu Packing
                  </h3>
                  <p className="text-xs text-[#5C6F68] leading-relaxed">
                    Pesanan instant & sameday area Jakarta harus selesai dipack ke cooler bag sebelum 17:00 WIB.
                  </p>
                </div>
                <div className="pt-2 border-t border-amber-100 flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-amber-900">
                    Batas: 17:00 WIB
                  </span>
                  <a
                    href="#orders"
                    className="text-xs font-bold text-[#00754A] hover:underline flex items-center gap-1"
                  >
                    <span>Proses Sekarang</span>
                    <ArrowRight size={13} />
                  </a>
                </div>
              </div>

              {/* Item 2: Inventory Nearing Expiry Window */}
              <div className="p-4 rounded-xl border border-rose-200 bg-[#FFF9F9] flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#C62828] uppercase tracking-wide">
                      Rotasi FEFO
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]">
                      6 Hari Tersisa
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-[#1E3932]">
                    Melon 1L (LOT #CY-2026-08D)
                  </h3>
                  <p className="text-xs text-[#5C6F68] leading-relaxed">
                    Tersisa 45 botol dengan tanggal kedaluwarsa 28 Sep 2026. Alokasi pengiriman otomatis prioritaskan lot ini.
                  </p>
                </div>
                <div className="pt-2 border-t border-rose-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#C62828]">
                    Prioritas Keluar
                  </span>
                  <a
                    href="#inventory"
                    className="text-xs font-bold text-[#00754A] hover:underline flex items-center gap-1"
                  >
                    <span>Cek Inventori</span>
                    <ArrowRight size={13} />
                  </a>
                </div>
              </div>

              {/* Item 3: Cold Chain Storage Normalcy */}
              <div className="p-4 rounded-xl border border-[#C8E6C9] bg-[#F7FBF8] flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#1E3932] uppercase tracking-wide">
                      Cold Storage Hub
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#1E3932] border border-[#C8E6C9]">
                      Normal (2.4°C)
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-[#1E3932]">
                    WH-COLD-JKT-01 Stabil
                  </h3>
                  <p className="text-xs text-[#5C6F68] leading-relaxed">
                    Suhu freezer utama stabil di 2.4°C (batas aman &lt; 4.0°C). Tidak ada alarm kebocoran suhu dalam 24 jam.
                  </p>
                </div>
                <div className="pt-2 border-t border-[#E8F5E9] flex items-center justify-between">
                  <span className="text-xs text-[#5C6F68]">
                    Diperbarui 10 mnt lalu
                  </span>
                  <span className="text-xs font-bold text-[#00754A] flex items-center gap-1">
                    <CheckCircle2 size={13} />
                    <span>Terverifikasi</span>
                  </span>
                </div>
              </div>

              {/* Item 4: Dispatch Route & Packaging Inspection */}
              <div className="p-4 rounded-xl border border-[#E5E2DA] bg-[#FAF9F7] flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#5C6F68] uppercase tracking-wide">
                      Instruksi Kirim
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#5C6F68] border border-[#E5E2DA]">
                      Depok Route
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-[#1E3932]">
                    Inspeksi Cold Box Khusus
                  </h3>
                  <p className="text-xs text-[#5C6F68] leading-relaxed">
                    1 pesanan rute Depok (CY-2026-0039) membutuhkan ice gel pack ganda untuk menjaga suhu di perjalanan.
                  </p>
                </div>
                <div className="pt-2 border-t border-[#E5E2DA] flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#1E3932]">
                    Gunakan 2 Ice Gel
                  </span>
                  <span className="text-xs font-bold text-[#00754A]">
                    Siap Dikemas
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: TWO-COLUMN OPERATIONAL WORKBENCH */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (8 Cols): Recent Orders & Inventory Tables */}
            <div className="lg:col-span-8 space-y-6">
              {/* TABLE 1: RECENT ORDERS */}
              <div id="orders" className="bg-white rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-[#E5E2DA] flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-[#1E3932]">
                      Recent Orders
                    </h3>
                    <p className="text-xs text-[#5C6F68]">
                      Real-time append-only transaction ledger (BFF & ERP Synced)
                    </p>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl border border-[#D5D1C7] hover:bg-[#FAF9F7] text-xs font-bold text-[#1E3932] flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <RefreshCw size={12} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                </div>

                {/* DESKTOP & TABLET VIEW: Enterprise Table */}
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
                        <th className="px-4 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E2DA]">
                      {transactions.map((tx) => (
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

                {/* MOBILE VIEW: Card-based Operational Cards (No Overflowing Table) */}
                <div className="md:hidden divide-y divide-[#E5E2DA]">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="p-4 space-y-2.5">
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
                        <span className="text-[10px] text-[#5C6F68] block">
                          {tx.courier}
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

              {/* TABLE 2: INVENTORY & FEFO ALLOCATION */}
              <div id="inventory" className="bg-white rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-[#E5E2DA] flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-[#1E3932]">
                      Inventory & FEFO Allocation
                    </h3>
                    <p className="text-xs text-[#5C6F68]">
                      Rotasi stok otomatis: First-Expired, First-Out demi kualitas susu stirred
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-[#00754A] bg-[#E8F5E9] px-2.5 py-1 rounded-xl border border-[#C8E6C9]">
                    520 Unit Total
                  </span>
                </div>

                {/* DESKTOP & TABLET VIEW: Enterprise Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#1E3932]">
                    <thead className="bg-[#FAF9F7] text-[#5C6F68] font-bold uppercase text-[10px] tracking-wider border-b border-[#E5E2DA]">
                      <tr>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">Variant / Lot</th>
                        <th className="px-4 py-3 text-center">Stock</th>
                        <th className="px-4 py-3">Expiry</th>
                        <th className="px-4 py-3">FEFO Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E2DA]">
                      {inventory.map((item, idx) => (
                        <tr key={idx} className="hover:bg-[#FDFCFB] transition-colors">
                          <td className="px-4 py-3 font-semibold text-[#1E3932]">
                            {item.product}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-[#1E3932] block">
                              {item.variant}
                            </span>
                            <span className="text-[10px] text-[#5C6F68] font-mono">
                              {item.lot}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-bold font-mono">
                            {item.stock} botol
                          </td>
                          <td className="px-4 py-3">
                            <span className="block font-medium">{item.expiry}</span>
                            <span className="text-[10px] text-[#5C6F68]">
                              ({item.daysRemaining} hari lagi)
                            </span>
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
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* MOBILE VIEW: Card-based Operational Cards */}
                <div className="md:hidden divide-y divide-[#E5E2DA]">
                  {inventory.map((item, idx) => (
                    <div key={idx} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-[#1E3932]">
                          {item.product}
                        </span>
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
                        <span>{item.variant}</span>
                        <span className="font-mono">{item.lot}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-[#E5E2DA]/60 text-xs">
                        <span className="text-[11px] text-[#5C6F68]">
                          Exp: {item.expiry} ({item.daysRemaining}h lagi)
                        </span>
                        <span className="font-bold font-mono text-[#1E3932]">
                          {item.stock} botol
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column (4 Cols): Cold Storage & Quick Action Items */}
            <div className="lg:col-span-4 space-y-6">
              {/* Cold Storage Monitoring Card */}
              <div id="cold-chain" className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
                <div className="flex items-center justify-between border-b border-[#E5E2DA] pb-3">
                  <div className="flex items-center gap-2">
                    <Snowflake size={16} className="text-[#00754A]" />
                    <h3 className="font-bold text-xs uppercase tracking-wider text-[#1E3932]">
                      Cold Storage Monitoring
                    </h3>
                  </div>
                  <span className="text-[10px] text-[#00754A] font-bold px-2 py-0.5 rounded-full bg-[#E8F5E9] border border-[#C8E6C9]">
                    NORMAL
                  </span>
                </div>

                {/* Hub Main Metric */}
                <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E5E2DA]">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#1E3932] block">
                        Hub WH-COLD-JKT-01
                      </span>
                      <span className="text-[11px] text-[#5C6F68]">
                        Jakarta Central Cold Room
                      </span>
                    </div>
                    <span className="text-2xl font-black font-mono text-[#00754A]">
                      2.4°C
                    </span>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-[#E5E2DA] flex items-center justify-between text-[11px] text-[#5C6F68]">
                    <span>Status: NORMAL</span>
                    <span>10 minutes ago</span>
                  </div>
                </div>

                {/* Secondary Zones */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center p-2.5 rounded-lg border border-[#E5E2DA] bg-white">
                    <div>
                      <span className="font-semibold text-[#1E3932] block">
                        Freezer Room B (Buffer)
                      </span>
                      <span className="text-[10px] text-[#5C6F68]">Transit Staging</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-[#00754A]">3.1°C</span>
                  </div>

                  <div className="flex justify-between items-center p-2.5 rounded-lg border border-[#E5E2DA] bg-white">
                    <div>
                      <span className="font-semibold text-[#1E3932] block">
                        Cooler Bag Dispatch
                      </span>
                      <span className="text-[10px] text-[#5C6F68]">Courier Pre-pack</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-[#00754A]">1.9°C</span>
                  </div>
                </div>

                <p className="text-[11px] text-[#5C6F68] pt-1 leading-relaxed border-t border-[#E5E2DA]">
                  Ambang batas suhu: &gt; 4.0°C memicu sirine dan notifikasi darurat langsung ke supervisor logistik.
                </p>
              </div>

              {/* Owner Daily Action Checklist */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
                <div className="flex items-center gap-2 border-b border-[#E5E2DA] pb-3">
                  <CheckCircle2 size={16} className="text-[#00754A]" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#1E3932]">
                    Owner Daily Action Checklist
                  </h3>
                </div>

                <div className="space-y-2.5 text-xs text-[#1E3932]">
                  <div className="flex items-start gap-2.5 p-2 rounded-lg bg-[#FAF9F7] border border-[#E5E2DA]">
                    <CheckCircle2 size={15} className="text-[#00754A] flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block">Cek Log Suhu Pagi (2.4°C)</span>
                      <span className="text-[10px] text-[#5C6F68]">Selesai pukul 08:15 WIB</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2 rounded-lg bg-[#FAF9F7] border border-[#E5E2DA]">
                    <CheckCircle2 size={15} className="text-[#00754A] flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block">Verifikasi Batch FEFO Harian</span>
                      <span className="text-[10px] text-[#5C6F68]">Selesai pukul 09:30 WIB</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2 rounded-lg bg-amber-50 border border-amber-200">
                    <Clock size={15} className="text-amber-800 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-900 block">
                        Packing 4 Pesanan Masuk
                      </span>
                      <span className="text-[10px] text-amber-800">
                        Harus tuntas sebelum batas kurir 17:00 WIB
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2 rounded-lg bg-[#FAF9F7] border border-[#E5E2DA]">
                    <CheckCircle2 size={15} className="text-[#00754A] flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block">Rekonsiliasi Kas Harian</span>
                      <span className="text-[10px] text-[#5C6F68]">Rp 14.850.000 tercatat di ledger</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
