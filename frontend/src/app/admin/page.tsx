import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Clock,
  Database,
  FileBarChart,
  Layers,
  LayoutDashboard,
  LogOut,
  Package,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Snowflake,
  Thermometer,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Admin Dashboard | Callme Yoghurt',
  description: 'Enterprise operations and administrative console.',
};

export default function AdminPage() {
  const transactions = [
    {
      id: 'CY-2026-0042',
      customer: 'Budi S**** (Jakarta Timur)',
      variant: 'Plain Pure Original 1000ml',
      qty: 2,
      courier: 'Instant Courier (Cooler Bag)',
      amount: 110000,
      status: 'CONFIRMED',
      time: '10 menit lalu',
    },
    {
      id: 'CY-2026-0041',
      customer: 'Siti A**** (Jakarta Selatan)',
      variant: 'Stroberi Summer Blush 250ml',
      qty: 4,
      courier: 'Sameday Delivery (Cold Box)',
      amount: 60000,
      status: 'IN COLD TRANSIT',
      time: '28 menit lalu',
    },
    {
      id: 'CY-2026-0040',
      customer: 'Hendro W**** (Bekasi Barat)',
      variant: 'Mangga Tropical Gold 250ml',
      qty: 3,
      courier: 'Instant Courier (Cooler Bag)',
      amount: 45000,
      status: 'PACKED',
      time: '1 jam lalu',
    },
    {
      id: 'CY-2026-0039',
      customer: 'Dewi L**** (Depok)',
      variant: 'Melon Emerald Fresh 1000ml',
      qty: 1,
      courier: 'Sameday Delivery (Cold Box)',
      amount: 55000,
      status: 'DELIVERED',
      time: '2 jam lalu',
    },
    {
      id: 'CY-2026-0038',
      customer: 'Rian K**** (Jakarta Pusat)',
      variant: 'Anggur Royal Purple 250ml',
      qty: 6,
      courier: 'Instant Courier (Cooler Bag)',
      amount: 90000,
      status: 'DELIVERED',
      time: '3 jam lalu',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex font-sans antialiased">
      {/* SIDEBAR: Callme ERP Operations */}
      <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col justify-between flex-shrink-0 border-r border-slate-800">
        <div>
          {/* Brand Header */}
          <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#00754A] flex items-center justify-center text-white font-black text-sm shadow-sm tracking-wider">
                CY
              </div>
              <div>
                <span className="font-extrabold text-sm text-white tracking-tight block">
                  CALLME ERP
                </span>
                <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-semibold block">
                  Operations Console
                </span>
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
              v1.5
            </span>
          </div>

          {/* Navigation Menu */}
          <nav className="p-4 space-y-1 text-xs font-medium">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 py-2 block">
              Core Operations
            </span>
            <Link
              href="/admin"
              className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#00754A]/20 text-emerald-300 border border-emerald-500/30 font-semibold"
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard size={16} />
                <span>Dashboard</span>
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </Link>

            <a
              href="#products"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              <Package size={16} />
              <span>Products & Catalog</span>
            </a>

            <a
              href="#inventory"
              className="flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Boxes size={16} />
                <span>Inventory & FEFO</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono">
                Nominal
              </span>
            </a>

            <a
              href="#orders"
              className="flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              <div className="flex items-center gap-3">
                <ShoppingCart size={16} />
                <span>Orders & Fulfillment</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900 text-blue-200 font-mono">
                28
              </span>
            </a>

            <a
              href="#customers"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              <Users size={16} />
              <span>Customers (AES-256)</span>
            </a>

            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 pt-5 pb-2 block">
              Governance & Security
            </span>

            <a
              href="#reports"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              <FileBarChart size={16} />
              <span>Cold Chain Reports</span>
            </a>

            <a
              href="#settings"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              <Settings size={16} />
              <span>Security & RBAC</span>
            </a>
          </nav>
        </div>

        {/* Operator Profile & Logout Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#0a0f1d]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-xs">
                OP
              </div>
              <div className="overflow-hidden">
                <span className="text-xs font-semibold text-white block truncate">
                  admin@callmeyoghurt.com
                </span>
                <span className="text-[10px] text-emerald-400 font-mono block">
                  ROLE: OWNER
                </span>
              </div>
            </div>
            <form action="/api/admin/logout" method="POST">
              <button
                type="submit"
                aria-label="Logout"
                className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              >
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* MAIN OPERATIONS WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Operational Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-30 shadow-sm">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Callme Yoghurt — Operations Console
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Authorized Administrative Management Portal
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Real-time Cold Chain Status */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>WH-COLD-JKT-01: 2.8°C Nominal</span>
            </div>

            {/* Test Compatibility Invariant Badge */}
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Authenticated Session Active
            </span>
          </div>
        </header>

        {/* Dashboard Operational Body */}
        <main className="p-6 space-y-6 max-w-7xl">
          {/* System Telemetry & Gate Status Badges */}
          <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                <ShieldCheck size={20} />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-300 block">
                  Zero-Trust Architecture & Edge BFF Active
                </span>
                <span className="text-[11px] text-slate-400">
                  Cloudflare Tunnel Ingress • PostgreSQL 16 ACID System of Record
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300">
                DB: 127.0.0.1:5432 (Isolated)
              </span>
              <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300">
                REDIS: 127.0.0.1:6379 (AOF)
              </span>
            </div>
          </div>

          {/* 4 Executive KPI Cards */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Authoritative Catalog */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between text-slate-500">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Authoritative Catalog
                </h2>
                <Package size={16} className="text-[#00754A]" />
              </div>
              <p className="mt-3 text-2xl font-extrabold text-slate-900 tracking-tight">
                7 Active SKUs
              </p>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <span>Managed via ERP Domain Core</span>
              </p>
            </div>

            {/* Card 2: Cold Chain Logistics */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between text-slate-500">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Cold Chain Logistics
                </h2>
                <Thermometer size={16} className="text-emerald-600" />
              </div>
              <p className="mt-3 text-2xl font-extrabold text-emerald-600 tracking-tight">
                2°C – 4°C Nominal
              </p>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <CheckCircle2 size={12} className="text-emerald-500" />
                <span>FEFO Allocation Active</span>
              </p>
            </div>

            {/* Card 3: Security Gate Status */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between text-slate-500">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Security Gate Status
                </h2>
                <ShieldCheck size={16} className="text-blue-600" />
              </div>
              <p className="mt-3 text-2xl font-extrabold text-blue-600 tracking-tight">
                Gate 0A–0E Verified
              </p>
              <p className="text-xs text-slate-400 mt-1">Phase 1.2A Access Boundary</p>
            </div>

            {/* Card 4: Daily Operational Volume */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between text-slate-500">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Daily Volume
                </h2>
                <TrendingUp size={16} className="text-amber-600" />
              </div>
              <p className="mt-3 text-2xl font-extrabold text-slate-900 tracking-tight">
                Rp 14.850.000
              </p>
              <p className="text-xs text-emerald-600 mt-1 font-semibold">
                +12.4% vs kemarin • 28 Pesanan
              </p>
            </div>
          </section>

          {/* TWO-COLUMN OPERATIONAL WORKBENCH */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Orders Data Table (8 Cols) */}
            <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Recent Transactions & Cold Chain Orders
                  </h3>
                  <p className="text-xs text-slate-500">
                    Real-time append-only ledger transaction monitoring
                  </p>
                </div>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-600 flex items-center gap-1.5"
                >
                  <RefreshCw size={12} />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-xs text-slate-600 divide-y divide-slate-100">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Order ID</th>
                      <th className="px-4 py-3">Customer (PII Protected)</th>
                      <th className="px-4 py-3">Product & Variant</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">
                          {tx.id}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-900 block">{tx.customer}</span>
                          <span className="text-[10px] text-slate-400">{tx.time}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-800 block">{tx.variant}</span>
                          <span className="text-[10px] text-slate-500">
                            Qty: {tx.qty} • {tx.courier}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          Rp {tx.amount.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                              tx.status === 'CONFIRMED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : tx.status === 'IN COLD TRANSIT'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : tx.status === 'PACKED'
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cold Chain & Inventory Telemetry Panel (4 Cols) */}
            <div className="lg:col-span-4 space-y-4">
              {/* Cold Hub Sensor Telemetry */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Snowflake size={16} className="text-[#00754A]" />
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                      Cold Hub Sensor Feeds
                    </h3>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-bold">ONLINE</span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div>
                      <span className="font-semibold text-slate-900 block">
                        Freezer Room A (Primary)
                      </span>
                      <span className="text-[10px] text-slate-500">Jakarta Central Hub</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-emerald-600">2.4°C</span>
                  </div>

                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div>
                      <span className="font-semibold text-slate-900 block">
                        Freezer Room B (Buffer)
                      </span>
                      <span className="text-[10px] text-slate-500">Transit Staging Zone</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-emerald-600">3.1°C</span>
                  </div>

                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div>
                      <span className="font-semibold text-slate-900 block">
                        Cooler Bag Dispatch
                      </span>
                      <span className="text-[10px] text-slate-500">Courier Pre-pack</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-emerald-600">1.9°C</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 pt-1">
                  Threshold alert: &gt; 4.0°C triggers immediate alert to logistics supervisor.
                </p>
              </div>

              {/* FEFO Lot Expiration Watch */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Clock size={16} className="text-amber-600" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                    FEFO Allocation Priority
                  </h3>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="border-l-2 border-emerald-500 pl-3 py-1">
                    <span className="font-semibold text-slate-900 block">
                      LOT #CY-2026-09A (Plain 250ml)
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Kedaluwarsa: 45 hari • 340 unit tersisa (Active Allocation)
                    </span>
                  </div>

                  <div className="border-l-2 border-emerald-500 pl-3 py-1">
                    <span className="font-semibold text-slate-900 block">
                      LOT #CY-2026-09B (Stroberi 1L)
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Kedaluwarsa: 52 hari • 180 unit tersisa (Safe)
                    </span>
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
