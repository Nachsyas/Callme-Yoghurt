"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  History,
  MessageSquare,
  Package,
  Phone,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  ShoppingCart,
  Truck,
  X,
  XCircle,
} from "lucide-react";
import type {
  AdminOrderRecord,
  OrderDashboardMetrics,
  OrderLifecycleStatus,
} from "@/lib/order/types";
import { getAllowedNextTransitions } from "@/lib/order/order-service";

type FilterStatus =
  | "ALL"
  | "WAITING_PAYMENT"
  | "PROCESSING"
  | "READY_TO_SHIP"
  | "COMPLETED"
  | "DELIVERED"
  | "CANCELLED";

const STATUS_FILTERS: { key: FilterStatus; label: string }[] = [
  { key: "ALL", label: "Semua" },
  { key: "WAITING_PAYMENT", label: "Waiting Payment" },
  { key: "PROCESSING", label: "Processing" },
  { key: "READY_TO_SHIP", label: "Ready To Ship" },
  { key: "COMPLETED", label: "Completed" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "CANCELLED", label: "Cancelled" },
];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderRecord[]>([]);
  const [metrics, setMetrics] = useState<OrderDashboardMetrics | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL");
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [, startTransition] = useTransition();

  const fetchOrders = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }

      const res = await fetch(`/api/admin/orders?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/admin/login?from=/admin/orders";
          return;
        }
        throw new Error("Gagal mengambil data pesanan dari server");
      }

      const data = await res.json();
      setOrders(data.orders || []);
      setMetrics(data.metrics || null);

      // If drawer is currently open, refresh the selected order object as well
      if (selectedOrder) {
        const updated = (data.orders || []).find(
          (o: AdminOrderRecord) => o.id === selectedOrder.id || o.order_number === selectedOrder.order_number
        );
        if (updated) {
          setSelectedOrder(updated);
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Terjadi kesalahan memuat data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders();
  };

  const handleStatusTransition = async (targetStatus: OrderLifecycleStatus) => {
    if (!selectedOrder) return;
    setIsUpdating(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengubah status pesanan");
      }

      setSelectedOrder(data.order);
      setSuccessToast(`Status pesanan berhasil diperbarui ke ${targetStatus}`);
      setTimeout(() => setSuccessToast(null), 4000);
      fetchOrders();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Gagal memperbarui status");
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePaymentVerification = async (action: "confirm_payment" | "reject_payment") => {
    if (!selectedOrder) return;
    setIsUpdating(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memverifikasi pembayaran");
      }

      setSelectedOrder(data.order);
      const msg =
        action === "confirm_payment"
          ? "Pembayaran berhasil dikonfirmasi (PAID) & status diperbarui!"
          : "Pembayaran telah ditolak (REJECTED).";
      setSuccessToast(msg);
      setTimeout(() => setSuccessToast(null), 4000);
      fetchOrders();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Gagal verifikasi pembayaran");
    } finally {
      setIsUpdating(false);
    }
  };

  const allowedTransitions = selectedOrder
    ? getAllowedNextTransitions(selectedOrder.order_status)
    : [];

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div
          role="status"
          className="fixed top-5 right-5 z-50 bg-[#2E7D32] text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold animate-fade-in"
        >
          <CheckCircle2 size={16} />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header Info Banner */}
      <div className="bg-white p-5 rounded-2xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2E7D32]"></span>
            <h1 className="text-lg sm:text-xl font-bold text-[#1E3932]">
              Manajemen Pesanan & Fulfillment
            </h1>
          </div>
          <p className="text-xs text-[#5C6F68] mt-1">
            Dasbor terpusat pemrosesan pesanan pelanggan, verifikasi bukti bayar, dan logistik rantai dingin.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={fetchOrders}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF9F7] text-[#1E3932] border border-[#D5D1C7] text-xs font-semibold hover:bg-[#F2F0EB] cursor-pointer transition-colors"
          >
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
            <span>Segarkan</span>
          </button>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9] text-xs font-semibold">
            <ShieldCheck size={14} className="text-[#2E7D32]" />
            <span>RBAC Protected</span>
          </span>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div
          role="alert"
          className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-700 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* TASK 6: DASHBOARD SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Card 1: Today's Orders */}
        <div className="bg-white p-4 rounded-xl border border-[#E5E2DA] shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#5C6F68] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Today&apos;s Orders</span>
            <div className="w-7 h-7 rounded-lg bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32]">
              <ShoppingCart size={14} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-[#1E3932]">
              {metrics ? metrics.today_orders : "-"}
            </div>
            <span className="text-[10px] text-[#5C6F68]">Total pesanan hari ini</span>
          </div>
        </div>

        {/* Card 2: Waiting Payment */}
        <div className="bg-white p-4 rounded-xl border border-[#E5E2DA] shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#5C6F68] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Waiting Payment</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700">
              <Clock size={14} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-amber-800">
              {metrics ? metrics.waiting_payment : "-"}
            </div>
            <span className="text-[10px] text-[#5C6F68]">Menunggu pembayaran</span>
          </div>
        </div>

        {/* Card 3: Processing */}
        <div className="bg-white p-4 rounded-xl border border-[#E5E2DA] shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#5C6F68] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Processing</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-700">
              <RefreshCw size={14} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-blue-800">
              {metrics ? metrics.processing : "-"}
            </div>
            <span className="text-[10px] text-[#5C6F68]">Sedang disiapkan</span>
          </div>
        </div>

        {/* Card 4: Ready To Ship */}
        <div className="bg-white p-4 rounded-xl border border-[#E5E2DA] shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#5C6F68] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Ready To Ship</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-purple-700">
              <Truck size={14} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-purple-800">
              {metrics ? metrics.ready_to_ship : "-"}
            </div>
            <span className="text-[10px] text-[#5C6F68]">Siap dikirim / kurir</span>
          </div>
        </div>

        {/* Card 5: Completed Orders */}
        <div className="bg-white p-4 rounded-xl border border-[#E5E2DA] shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-[#5C6F68] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Completed Orders</span>
            <div className="w-7 h-7 rounded-lg bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32]">
              <CheckCircle2 size={14} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-[#2E7D32]">
              {metrics ? metrics.completed_orders : "-"}
            </div>
            <span className="text-[10px] text-[#5C6F68]">Selesai / Terkirim</span>
          </div>
        </div>
      </div>

      {/* TASK 5: FILTER AND SEARCH BAR */}
      <div className="bg-white p-4 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col lg:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full lg:w-84">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A9590]" />
          <input
            type="text"
            placeholder="Cari Order Number, Nama, WhatsApp..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-20 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs text-[#1E3932] placeholder-[#8A9590] focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-[#2E7D32] text-white rounded-lg text-[11px] font-bold hover:bg-[#1B5E20] transition-colors"
          >
            Cari
          </button>
        </form>

        <div className="flex items-center gap-1.5 self-start lg:self-auto w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === f.key
                  ? "bg-[#2E7D32] text-white shadow-sm"
                  : "bg-[#FAF9F7] text-[#5C6F68] border border-[#D5D1C7] hover:bg-[#F2F0EB]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* TASK 1: ORDERS TABLE (Desktop First) */}
      <div className="bg-white rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1E3932]">
            <thead className="bg-[#FAF9F7] text-[#5C6F68] font-bold uppercase text-[10px] tracking-wider border-b border-[#E5E2DA]">
              <tr>
                <th className="px-4 py-3">Order Number</th>
                <th className="px-4 py-3">Customer Name</th>
                <th className="px-4 py-3">WhatsApp Number</th>
                <th className="px-4 py-3">Order Date</th>
                <th className="px-4 py-3">Payment Status</th>
                <th className="px-4 py-3">Order Status</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E2DA]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[#5C6F68]">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={16} className="animate-spin text-[#2E7D32]" />
                      <span>Memuat data pesanan...</span>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[#5C6F68]">
                    Tidak ada pesanan yang sesuai dengan filter atau kata kunci.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="hover:bg-[#FDFCFB] cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-[#1E3932] group-hover:text-[#2E7D32]">
                      {order.order_number}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#1E3932]">
                      {order.customer.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-[#5C6F68]">
                      {order.customer.whatsapp}
                    </td>
                    <td className="px-4 py-3 text-[#5C6F68] whitespace-nowrap">
                      {new Date(order.order_date).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          order.payment.status === "PAID"
                            ? "bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]"
                            : order.payment.status === "PENDING_PAYMENT"
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-red-50 text-red-800 border border-red-200"
                        }`}
                      >
                        {order.payment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          order.order_status === "WAITING_PAYMENT"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : order.order_status === "PAYMENT_CONFIRMED"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : order.order_status === "PROCESSING"
                                ? "bg-blue-50 text-blue-800 border border-blue-200"
                                : order.order_status === "READY_TO_SHIP"
                                  ? "bg-purple-50 text-purple-800 border border-purple-200"
                                  : order.order_status === "COMPLETED" || order.order_status === "DELIVERED"
                                    ? "bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]"
                                    : "bg-gray-100 text-gray-700 border border-gray-300"
                        }`}
                      >
                        {order.order_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold text-[#2E7D32] font-mono">
                      Rp {order.cost.total_amount.toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(order);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#E8F5E9] text-[#2E7D32] font-bold text-[11px] hover:bg-[#C8E6C9] transition-colors"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View (Card List) */}
        <div className="md:hidden divide-y divide-[#E5E2DA]">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-[#5C6F68]">
              Memuat data pesanan...
            </div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#5C6F68]">
              Tidak ada pesanan ditemukan.
            </div>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className="p-4 space-y-2 cursor-pointer active:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-[#1E3932]">
                    {order.order_number}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      order.order_status === "WAITING_PAYMENT"
                        ? "bg-amber-50 text-amber-800"
                        : order.order_status === "COMPLETED" || order.order_status === "DELIVERED"
                          ? "bg-[#E8F5E9] text-[#2E7D32]"
                          : "bg-blue-50 text-blue-800"
                    }`}
                  >
                    {order.order_status}
                  </span>
                </div>

                <div className="flex justify-between items-start text-xs">
                  <div>
                    <span className="font-bold text-[#1E3932] block">
                      {order.customer.name}
                    </span>
                    <span className="text-[#5C6F68] font-mono text-[11px]">
                      {order.customer.whatsapp}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-[#2E7D32] block">
                      Rp {order.cost.total_amount.toLocaleString("id-ID")}
                    </span>
                    <span className="text-[10px] text-[#5C6F68]">
                      {order.payment.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-[#E5E2DA]/60 text-[11px] text-[#5C6F68]">
                  <span>
                    {new Date(order.order_date).toLocaleDateString("id-ID")}
                  </span>
                  <span className="text-[#2E7D32] font-semibold">
                    Ketuk untuk detail →
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* TASK 2: ORDER DETAIL VIEW (Interactive Side Drawer) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 transition-opacity animate-fade-in"
            onClick={() => setSelectedOrder(null)}
            aria-hidden="true"
          />

          <section
            aria-labelledby="order-detail-title"
            className="fixed inset-y-0 right-0 max-w-full flex pl-10"
          >
            <div className="w-screen max-w-lg bg-white shadow-2xl flex flex-col">
              {/* Drawer Header */}
              <div className="p-5 border-b border-[#E5E2DA] bg-[#FAF9F7] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#5C6F68] block">
                    Order Detail
                  </span>
                  <h2
                    id="order-detail-title"
                    className="text-base font-extrabold text-[#1E3932] font-mono mt-0.5"
                  >
                    {selectedOrder.order_number}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 rounded-lg text-[#5C6F68] hover:text-[#1E3932] hover:bg-[#E5E2DA]/50 transition-colors cursor-pointer"
                  aria-label="Tutup detail"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Drawer Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
                {/* STATUS & TRANSITION CONTROLS (TASK 3) */}
                <div className="bg-[#FAF9F7] p-4 rounded-xl border border-[#E5E2DA] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#5C6F68] uppercase tracking-wider">
                      Status Pesanan Saat Ini:
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold ${
                        selectedOrder.order_status === "WAITING_PAYMENT"
                          ? "bg-amber-100 text-amber-900 border border-amber-300"
                          : selectedOrder.order_status === "PAYMENT_CONFIRMED"
                            ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                            : selectedOrder.order_status === "PROCESSING"
                              ? "bg-blue-100 text-blue-900 border border-blue-300"
                              : selectedOrder.order_status === "READY_TO_SHIP"
                                ? "bg-purple-100 text-purple-900 border border-purple-300"
                                : selectedOrder.order_status === "COMPLETED" || selectedOrder.order_status === "DELIVERED"
                                  ? "bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]"
                                  : "bg-red-100 text-red-900 border border-red-300"
                      }`}
                    >
                      {selectedOrder.order_status}
                    </span>
                  </div>

                  {/* Transition Action Buttons (Task 3 Allowed Transitions) */}
                  <div className="pt-2 border-t border-[#E5E2DA]">
                    <span className="text-[10px] font-semibold text-[#5C6F68] block mb-2">
                      Transisi Status Diizinkan (Workflow Rule):
                    </span>

                    {allowedTransitions.length === 0 ? (
                      <p className="text-[11px] text-[#5C6F68] italic">
                        Pesanan ini telah mencapai status terminal ({selectedOrder.order_status}). Tidak ada transisi lanjutan.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {allowedTransitions.map((target) => (
                          <button
                            key={target}
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleStatusTransition(target)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              target === "CANCELLED"
                                ? "bg-red-50 text-red-700 border border-red-300 hover:bg-red-100"
                                : "bg-[#2E7D32] text-white hover:bg-[#1B5E20] shadow-sm"
                            }`}
                          >
                            <span>Ubah ke: {target}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* TASK 4: PAYMENT VERIFICATION PREPARATION */}
                <div className="bg-white p-4 rounded-xl border border-[#E5E2DA] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#1E3932] uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-[#2E7D32]" />
                      Payment Verification
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedOrder.payment.proof_status === "verified"
                          ? "bg-[#E8F5E9] text-[#2E7D32]"
                          : selectedOrder.payment.proof_status === "rejected"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {selectedOrder.payment.proof_status === "verified"
                        ? "Terverifikasi"
                        : selectedOrder.payment.proof_status === "rejected"
                          ? "Ditolak"
                          : "Waiting Verification"}
                    </span>
                  </div>

                  {/* Payment Proof Placeholder UI */}
                  <div className="border border-dashed border-[#D5D1C7] rounded-xl p-3 bg-[#FAF9F7] flex items-center gap-3">
                    <div className="w-12 h-12 bg-white rounded-lg border border-[#E5E2DA] flex items-center justify-center text-[#5C6F68] font-bold text-[10px]">
                      BUKTI
                    </div>
                    <div className="flex-1">
                      <span className="font-semibold text-[#1E3932] block">
                        Payment Proof
                      </span>
                      <span className="text-[10px] text-[#5C6F68] block">
                        Status:{" "}
                        <strong className="text-[#1E3932]">
                          {selectedOrder.payment.proof_status === "verified"
                            ? "Verified"
                            : selectedOrder.payment.proof_status === "rejected"
                              ? "Rejected"
                              : "Waiting Verification"}
                        </strong>
                      </span>
                      <span className="text-[10px] text-[#5C6F68] block">
                        Metode: {selectedOrder.payment.method}
                      </span>
                    </div>
                  </div>

                  {/* Payment Verification Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isUpdating || selectedOrder.payment.status === "PAID"}
                      onClick={() => handlePaymentVerification("confirm_payment")}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        selectedOrder.payment.status === "PAID"
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-[#2E7D32] text-white hover:bg-[#1B5E20] cursor-pointer shadow-sm"
                      }`}
                    >
                      <CheckCircle2 size={13} />
                      <span>Confirm Payment</span>
                    </button>

                    <button
                      type="button"
                      disabled={isUpdating || selectedOrder.payment.status === "FAILED"}
                      onClick={() => handlePaymentVerification("reject_payment")}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                        selectedOrder.payment.status === "FAILED"
                          ? "border-gray-200 text-gray-400 cursor-not-allowed"
                          : "border-red-300 text-red-700 bg-red-50 hover:bg-red-100 cursor-pointer"
                      }`}
                    >
                      <XCircle size={13} />
                      <span>Reject Payment</span>
                    </button>
                  </div>
                </div>

                {/* TASK 5: INVENTORY STATUS & FULFILLMENT */}
                <div className="bg-white p-4 rounded-xl border border-[#E5E2DA] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#1E3932] uppercase tracking-wider flex items-center gap-1.5">
                      <Boxes size={14} className="text-[#2E7D32]" />
                      Inventory Status
                    </span>
                    {selectedOrder.inventory?.status === "RESERVED" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]">
                        <CheckCircle2 size={12} />
                        ✓ Stock Reserved
                      </span>
                    )}
                    {selectedOrder.inventory?.status === "FULFILLED" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-800 border border-blue-200">
                        <CheckCircle2 size={12} />
                        ✓ Fulfilled
                      </span>
                    )}
                    {selectedOrder.inventory?.status === "RELEASED" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-gray-100 text-gray-700 border border-gray-300">
                        Stock Released
                      </span>
                    )}
                    {(!selectedOrder.inventory || selectedOrder.inventory.status === "AVAILABLE") && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                        Pending Reservation
                      </span>
                    )}
                  </div>

                  {/* Overall Reservation Status Summary */}
                  <div className="p-2.5 bg-[#FAF9F7] rounded-lg border border-[#E5E2DA] flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-[#5C6F68] block">ID Reservasi:</span>
                      <span className="font-mono font-bold text-[#1E3932]">
                        {selectedOrder.inventory?.reservation_id || "N/A"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-[#5C6F68] block">Status:</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black ${
                          selectedOrder.inventory?.summary_status === "READY" ||
                          selectedOrder.inventory?.status === "RESERVED"
                            ? "bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]"
                            : selectedOrder.inventory?.status === "FULFILLED"
                              ? "bg-blue-100 text-blue-900 border border-blue-300"
                              : selectedOrder.inventory?.status === "RELEASED"
                                ? "bg-gray-100 text-gray-800 border border-gray-300"
                                : "bg-amber-100 text-amber-900 border border-amber-300"
                        }`}
                      >
                        {selectedOrder.inventory?.summary_status || selectedOrder.inventory?.status || "PENDING"}
                      </span>
                    </div>
                  </div>

                  {/* Per-Item Stock Reservation Details (Task 5 example) */}
                  <div className="space-y-2 pt-1">
                    <span className="text-[10px] font-semibold text-[#5C6F68] uppercase tracking-wider block">
                      Alokasi Stok Per Item
                    </span>
                    <div className="space-y-2">
                      {(selectedOrder.inventory?.items && selectedOrder.inventory.items.length > 0
                        ? selectedOrder.inventory.items
                        : selectedOrder.items.map((i) => ({
                            product_name: i.product_name,
                            variant: i.variant,
                            quantity: i.quantity,
                            available_stock: 20,
                            reserved_quantity: 0,
                            status: "AVAILABLE" as const,
                          }))
                      ).map((item, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg border border-[#E5E2DA] bg-[#FAF9F7] flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-[#1E3932]">{item.product_name}</div>
                            <div className="text-[11px] text-[#5C6F68]">
                              Varian: <span className="font-medium text-[#1E3932]">{item.variant}</span> &bull; 
                              Qty: <span className="font-medium text-[#1E3932]">{item.quantity}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] font-bold text-[#1E3932]">
                              Reserved:{" "}
                              <span className="text-[#2E7D32] font-mono font-black">
                                {item.reserved_quantity}
                              </span>
                            </div>
                            <div className="flex items-center justify-end gap-1.5 mt-0.5">
                              <span className="text-[10px] text-[#5C6F68]">
                                Tersedia: {item.available_stock}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                  item.status === "RESERVED"
                                    ? "bg-[#E8F5E9] text-[#2E7D32]"
                                    : item.status === "FULFILLED"
                                      ? "bg-blue-100 text-blue-800"
                                      : item.status === "RELEASED"
                                        ? "bg-gray-100 text-gray-700"
                                        : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {item.status === "RESERVED" ? "READY" : item.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* TASK 6: FULFILLMENT AUDIT LOG */}
                <div className="bg-white p-4 rounded-xl border border-[#E5E2DA] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#1E3932] uppercase tracking-wider flex items-center gap-1.5">
                      <History size={14} className="text-[#2E7D32]" />
                      Riwayat Audit Fulfillment
                    </span>
                    <span className="text-[10px] font-semibold text-[#5C6F68]">
                      {selectedOrder.audit_logs?.length || 0} Aktivitas
                    </span>
                  </div>

                  {!selectedOrder.audit_logs || selectedOrder.audit_logs.length === 0 ? (
                    <p className="text-[11px] text-[#5C6F68] italic p-3 bg-[#FAF9F7] rounded-lg border border-[#E5E2DA] text-center">
                      Belum ada riwayat audit fulfillment tercatat.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {selectedOrder.audit_logs.map((log) => (
                        <div
                          key={log.id}
                          className="p-2.5 rounded-lg border border-[#E5E2DA] bg-[#FAF9F7] space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                log.event_type === "INVENTORY_RESERVED" ||
                                log.event_type === "ORDER_PAYMENT_CONFIRMED"
                                  ? "bg-[#E8F5E9] text-[#2E7D32] border-[#C8E6C9]"
                                  : log.event_type === "ORDER_READY_TO_SHIP"
                                    ? "bg-purple-50 text-purple-800 border-purple-200"
                                    : log.event_type === "ORDER_PROCESSING"
                                      ? "bg-blue-50 text-blue-800 border-blue-200"
                                      : "bg-red-50 text-red-800 border-red-200"
                              }`}
                            >
                              {log.event_type}
                            </span>
                            <span className="text-[10px] text-[#5C6F68]">
                              {new Date(log.timestamp).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-[#1E3932] text-[11px] font-medium leading-relaxed">
                            {log.description}
                          </p>
                          <div className="text-[10px] text-[#5C6F68] flex items-center justify-between pt-0.5">
                            <span>
                              Aktor:{" "}
                              <span className="font-mono font-medium text-[#1E3932]">
                                {log.actor}
                              </span>
                            </span>
                            <span className="font-mono text-[9px] text-[#8C887B]">{log.id}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <span className="text-[10px] text-[#8A9590] italic block text-right">
                    * Log audit tersimpan permanen & tidak dapat dihapus (Task 6).
                  </span>
                </div>

                {/* TASK 7: NOTIFICATION HISTORY (PHASE 1.7C.18) */}
                <div className="bg-white p-4 rounded-xl border border-[#E5E2DA] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#1E3932] uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare size={14} className="text-[#2E7D32]" />
                      Riwayat Notifikasi WhatsApp
                    </span>
                    <span className="text-[10px] font-semibold text-[#5C6F68] bg-[#F4F1EA] px-2 py-0.5 rounded-full">
                      {selectedOrder.notifications?.length || 0} Terkirim/Tersedia
                    </span>
                  </div>

                  {!selectedOrder.notifications || selectedOrder.notifications.length === 0 ? (
                    <p className="text-[11px] text-[#5C6F68] italic p-3 bg-[#FAF9F7] rounded-lg border border-[#E5E2DA] text-center">
                      Belum ada riwayat notifikasi WhatsApp tercatat.
                    </p>
                  ) : (
                    <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                      {selectedOrder.notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className="p-3 rounded-lg border border-[#E5E2DA] bg-[#FAF9F7] space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] font-bold text-[#1E3932]">
                                {new Date(notif.created_at).toLocaleTimeString("id-ID", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              <span
                                className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                  notif.event === "ORDER_CREATED"
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : notif.event === "PAYMENT_CONFIRMED"
                                      ? "bg-[#E8F5E9] text-[#2E7D32] border-[#C8E6C9]"
                                      : notif.event === "ORDER_PROCESSING"
                                        ? "bg-blue-50 text-blue-800 border-blue-200"
                                        : notif.event === "ORDER_READY_TO_SHIP"
                                          ? "bg-purple-50 text-purple-800 border-purple-200"
                                          : "bg-emerald-50 text-emerald-800 border-emerald-200"
                                }`}
                              >
                                {notif.event}
                              </span>
                            </div>
                            <span className="text-[10px] font-medium text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.5 rounded-full border border-[#C8E6C9]">
                              WhatsApp message generated
                            </span>
                          </div>

                          <div className="bg-white p-2.5 rounded border border-[#E5E2DA] font-mono text-[10px] text-[#2D3748] whitespace-pre-line leading-relaxed max-h-28 overflow-y-auto">
                            {notif.message}
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-[#5C6F68]">
                              Tujuan:{" "}
                              <span className="font-mono font-semibold text-[#1E3932]">
                                {notif.recipient_phone}
                              </span>
                            </span>
                            <a
                              href={notif.wa_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#2E7D32] hover:bg-[#1E3932] text-white text-[11px] font-semibold rounded-md transition-colors"
                            >
                              <Send size={11} />
                              Buka WhatsApp (Manual)
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <span className="text-[10px] text-[#8A9590] italic block text-right">
                    * Dihasilkan via ManualWhatsAppProvider (Task 4) tanpa mengekspos rahasia API (Task 8).
                  </span>
                </div>

                {/* CUSTOMER DETAILS (TASK 2) */}
                <div className="bg-white p-4 rounded-xl border border-[#E5E2DA] space-y-2">
                  <span className="text-[11px] font-bold text-[#1E3932] uppercase tracking-wider block">
                    Customer Information
                  </span>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-[#5C6F68]">Nama Pelanggan:</span>
                      <span className="font-bold text-[#1E3932]">{selectedOrder.customer.name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#5C6F68]">WhatsApp:</span>
                      <a
                        href={`https://wa.me/${selectedOrder.customer.whatsapp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono font-bold text-[#2E7D32] flex items-center gap-1 hover:underline"
                      >
                        {selectedOrder.customer.whatsapp}
                        <ExternalLink size={11} />
                      </a>
                    </div>
                    <div>
                      <span className="text-[#5C6F68] block mb-0.5">Alamat Pengiriman:</span>
                      <p className="bg-[#FAF9F7] p-2.5 rounded-lg border border-[#E5E2DA] text-[#1E3932] leading-relaxed">
                        {selectedOrder.customer.address}
                      </p>
                    </div>
                    <div className="flex justify-between pt-1 text-[11px]">
                      <span className="text-[#5C6F68]">Layanan Pengiriman:</span>
                      <span className="font-semibold text-[#1E3932]">{selectedOrder.delivery_method}</span>
                    </div>
                  </div>
                </div>

                {/* ITEMS ORDERED (TASK 2) */}
                <div className="bg-white p-4 rounded-xl border border-[#E5E2DA] space-y-3">
                  <span className="text-[11px] font-bold text-[#1E3932] uppercase tracking-wider block">
                    Items ({selectedOrder.items.length})
                  </span>
                  <div className="divide-y divide-[#E5E2DA]">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex justify-between items-center">
                        <div>
                          <span className="font-bold text-[#1E3932] block">
                            {item.product_name}
                          </span>
                          <span className="text-[11px] text-[#5C6F68]">
                            Varian: {item.variant} &bull; Qty: {item.quantity}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-[#1E3932] block">
                            Rp {(item.price * item.quantity).toLocaleString("id-ID")}
                          </span>
                          <span className="text-[10px] text-[#5C6F68]">
                            @ Rp {item.price.toLocaleString("id-ID")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* COST BREAKDOWN (TASK 2) */}
                <div className="bg-white p-4 rounded-xl border border-[#E5E2DA] space-y-2">
                  <span className="text-[11px] font-bold text-[#1E3932] uppercase tracking-wider block">
                    Cost Breakdown
                  </span>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-[#5C6F68]">Subtotal:</span>
                      <span className="font-semibold text-[#1E3932]">
                        Rp {selectedOrder.cost.subtotal.toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#5C6F68]">Shipping:</span>
                      <span className="font-semibold text-[#1E3932]">
                        Rp {selectedOrder.cost.shipping_fee.toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#5C6F68]">Cold Chain:</span>
                      <span className="font-semibold text-[#1E3932]">
                        Rp {selectedOrder.cost.cold_chain_fee.toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-[#E5E2DA] text-sm">
                      <span className="font-extrabold text-[#1E3932]">Total:</span>
                      <span className="font-black text-[#2E7D32] text-base font-mono">
                        Rp {selectedOrder.cost.total_amount.toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-[#E5E2DA] bg-[#FAF9F7] flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 bg-white border border-[#D5D1C7] text-[#1E3932] rounded-xl text-xs font-bold hover:bg-[#F2F0EB] transition-colors cursor-pointer"
                >
                  Tutup Drawer
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
