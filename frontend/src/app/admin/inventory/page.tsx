"use client";

import React, { useEffect, useState, useTransition } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Clock,
  Edit2,
  EyeOff,
  Filter,
  History,
  Layers,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sliders,
  X,
} from "lucide-react";

interface StockQuantity {
  on_hand: number;
  reserved: number;
  available: number;
}

interface InventoryItemData {
  id: string;
  code: string;
  name: string;
  type: "RAW_MATERIAL" | "PACKAGING" | "FINISHED_GOOD";
  base_uom_id: string;
  base_uom: {
    id: string;
    code: string;
    name: string;
    category: string;
  } | null;
  lot_tracked: boolean;
  active: boolean;
  stock: StockQuantity;
  created_at: string;
}

interface InventoryLotData {
  id: string;
  inventory_item_id: string;
  item_code: string;
  item_name: string;
  lot_number: string;
  warehouse_code: string;
  production_date: string | null;
  expiration_date: string | null;
  received_at: string | null;
  days_remaining: number | null;
  fefo_status: "Available" | "Near Expiry" | "Critical" | "Expired" | "No Expiry";
  on_hand: number;
  reserved: number;
  available: number;
}

interface StockLedgerEntryData {
  id: string;
  inventory_item_id: string;
  item_code: string;
  item_name: string;
  warehouse_code: string;
  lot_number: string | null;
  quantity_delta: number;
  event_type: string;
  reference_type: string | null;
  reference_id: string | null;
  occurred_at: string;
}

interface MetaOption {
  id: string;
  code: string;
  name: string;
}

export default function AdminInventoryPage() {
  const [activeTab, setActiveTab] = useState<"ITEMS" | "LOTS" | "LEDGER">("ITEMS");
  const [items, setItems] = useState<InventoryItemData[]>([]);
  const [lots, setLots] = useState<InventoryLotData[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<StockLedgerEntryData[]>([]);
  const [uoms, setUoms] = useState<MetaOption[]>([]);
  const [warehouses, setWarehouses] = useState<MetaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "RAW_MATERIAL" | "PACKAGING" | "FINISHED_GOOD">("ALL");
  const [fefoFilter, setFefoFilter] = useState<"ALL" | "Available" | "Near Expiry" | "Critical" | "Expired">("ALL");

  // Modals
  const [itemModalMode, setItemModalMode] = useState<"CREATE" | "EDIT" | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItemData | null>(null);
  const [itemForm, setItemForm] = useState({
    code: "",
    name: "",
    type: "FINISHED_GOOD",
    base_uom_id: "",
    lot_tracked: true,
    active: true,
  });

  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptForm, setReceiptForm] = useState({
    inventory_item_id: "",
    warehouse_id: "",
    quantity: "",
    lot_number: "",
    production_date: "",
    expiration_date: "",
    reference: "PO-MANUAL",
  });

  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    inventory_item_id: "",
    warehouse_id: "",
    inventory_lot_id: "",
    quantity_delta: "",
    reference: "ADJ-MANUAL",
    reason: "",
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => Promise<void>;
  }>({ isOpen: false, title: "", description: "", onConfirm: async () => {} });

  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [itemsRes, lotsRes, ledgerRes, metaRes] = await Promise.all([
        fetch("/api/admin/inventory/items", { cache: "no-store" }),
        fetch("/api/admin/inventory/lots", { cache: "no-store" }),
        fetch("/api/admin/inventory/ledger?limit=100", { cache: "no-store" }),
        fetch("/api/admin/inventory/meta", { cache: "no-store" }),
      ]);

      if (!itemsRes.ok) throw new Error("Gagal mengambil data item inventaris dari ERP Core");
      const itemsData = await itemsRes.json();
      setItems(itemsData.items || []);

      if (lotsRes.ok) {
        const lotsData = await lotsRes.json();
        setLots(lotsData.lots || []);
      }

      if (ledgerRes.ok) {
        const ledgerData = await ledgerRes.json();
        setLedgerEntries(ledgerData.entries || []);
      }

      if (metaRes.ok) {
        const metaData = await metaRes.json();
        setUoms(metaData.uoms || []);
        setWarehouses(metaData.warehouses || []);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal memuat inventaris");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Item Actions
  const handleOpenCreateItem = () => {
    setItemForm({
      code: "",
      name: "",
      type: "FINISHED_GOOD",
      base_uom_id: uoms[0]?.id || "",
      lot_tracked: true,
      active: true,
    });
    setSelectedItem(null);
    setItemModalMode("CREATE");
  };

  const handleOpenEditItem = (item: InventoryItemData) => {
    setItemForm({
      code: item.code,
      name: item.name,
      type: item.type,
      base_uom_id: item.base_uom_id,
      lot_tracked: item.lot_tracked,
      active: item.active,
    });
    setSelectedItem(item);
    setItemModalMode("EDIT");
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const isEdit = itemModalMode === "EDIT" && selectedItem;
        const url = isEdit
          ? `/api/admin/inventory/items/${selectedItem.id}`
          : "/api/admin/inventory/items";
        const method = isEdit ? "PUT" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(itemForm),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal menyimpan item");

        setItemModalMode(null);
        showSuccess(isEdit ? "Item inventaris berhasil diperbarui" : "Item inventaris baru berhasil ditambahkan");
        loadData();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Gagal memproses item");
      }
    });
  };

  const handleDeactivateItem = (item: InventoryItemData) => {
    setConfirmDialog({
      isOpen: true,
      title: `Nonaktifkan Item "${item.code}"?`,
      description:
        "Item ini tidak akan dapat digunakan untuk varian baru atau penerimaan stok berikutnya. Seluruh riwayat mutasi buku besar dan lot historis tetap dipertahankan permanen.",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/inventory/items/${item.id}`, { method: "DELETE" });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Gagal menonaktifkan item");
          }
          showSuccess(`Item "${item.code}" berhasil dinonaktifkan`);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          loadData();
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : "Gagal menonaktifkan item");
        }
      },
    });
  };

  // Stock Receipt
  const handleOpenReceipt = (item?: InventoryItemData) => {
    setReceiptForm({
      inventory_item_id: item ? item.id : items[0]?.id || "",
      warehouse_id: warehouses[0]?.id || "",
      quantity: "50",
      lot_number: item && item.lot_tracked ? `LOT-${item.code}-001` : "",
      production_date: "",
      expiration_date: "",
      reference: "PO-MANUAL",
    });
    setReceiptModalOpen(true);
  };

  const handleSaveReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const qty = parseFloat(receiptForm.quantity);
    if (isNaN(qty) || qty <= 0) {
      setErrorMsg("Kuantitas penerimaan harus berupa angka lebih besar dari 0");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/inventory/receipts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inventory_item_id: receiptForm.inventory_item_id,
            warehouse_id: receiptForm.warehouse_id,
            quantity: qty,
            lot_number: receiptForm.lot_number || undefined,
            production_date: receiptForm.production_date || undefined,
            expiration_date: receiptForm.expiration_date || undefined,
            reference: receiptForm.reference,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal mencatat penerimaan stok");

        setReceiptModalOpen(false);
        showSuccess(`Penerimaan stok ${qty} unit berhasil dicatat ke buku besar`);
        loadData();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Gagal mencatat penerimaan stok");
      }
    });
  };

  // Stock Adjustment
  const handleOpenAdjust = (item?: InventoryItemData) => {
    const targetItemId = item ? item.id : items[0]?.id || "";
    setAdjustForm({
      inventory_item_id: targetItemId,
      warehouse_id: warehouses[0]?.id || "",
      inventory_lot_id: "",
      quantity_delta: "-1",
      reference: "ADJ-COUNT",
      reason: "Penyesuaian stok opname / kerusakan kemasan",
    });
    setAdjustModalOpen(true);
  };

  const handleSaveAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const delta = parseFloat(adjustForm.quantity_delta);
    if (isNaN(delta) || delta === 0) {
      setErrorMsg("Delta penyesuaian stok tidak boleh nol");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/inventory/adjustments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inventory_item_id: adjustForm.inventory_item_id,
            warehouse_id: adjustForm.warehouse_id,
            inventory_lot_id: adjustForm.inventory_lot_id || undefined,
            quantity_delta: delta,
            reference: adjustForm.reference,
            reason: adjustForm.reason,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal melakukan penyesuaian stok");

        setAdjustModalOpen(false);
        showSuccess(`Penyesuaian stok (${delta > 0 ? "+" : ""}${delta}) berhasil dicatat`);
        loadData();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Gagal melakukan penyesuaian stok");
      }
    });
  };

  // Filtered Items
  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (typeFilter !== "ALL" && item.type !== typeFilter) return false;
    return true;
  });

  // Filtered Lots
  const filteredLots = lots.filter((lot) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      lot.lot_number.toLowerCase().includes(q) ||
      lot.item_code.toLowerCase().includes(q) ||
      lot.item_name.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (fefoFilter !== "ALL" && lot.fefo_status !== fefoFilter) return false;
    return true;
  });

  const totalOnHand = items.reduce((acc, i) => acc + (i.stock.on_hand || 0), 0);
  const totalReserved = items.reduce((acc, i) => acc + (i.stock.reserved || 0), 0);
  const totalAvailable = items.reduce((acc, i) => acc + (i.stock.available || 0), 0);

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-[#E8F5E9] border border-[#C8E6C9] text-[#1E3932] text-xs font-semibold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-[#00754A]" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-[#5C6F68] hover:text-[#1E3932]">
            <X size={14} />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-[#FFEBEE] border border-[#FFCDD2] text-[#B71C1C] text-xs font-semibold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-[#D32F2F]" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-[#B71C1C] hover:opacity-80">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header Info Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#1E3932]">
            Authoritative Inventory & Cold Chain Stock
          </h2>
          <p className="text-xs text-[#5C6F68] mt-0.5">
            Buku besar mutasi stok append-only, alokasi FEFO terotorisasi, dan kontrol suhu rantai dingin.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF9F7] text-[#5C6F68] hover:text-[#1E3932] border border-[#E5E2DA] text-xs font-medium transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF9F7] hover:bg-[#EFECE6] border border-[#D5D1C7] text-xs font-semibold text-[#1E3932] cursor-pointer"
          >
            <Plus size={13} />
            <span>+ Tambah Item</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenReceipt()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E8F5E9] hover:bg-[#C8E6C9] border border-[#A5D6A7] text-xs font-bold text-[#00754A] cursor-pointer"
          >
            <ArrowDownLeft size={14} />
            <span>Terima Stok</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAdjust()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFF8E1] hover:bg-[#FFECB3] border border-[#FFE082] text-xs font-bold text-[#F57F17] cursor-pointer"
          >
            <Sliders size={13} />
            <span>Penyesuaian Stok</span>
          </button>
        </div>
      </div>

      {/* KPI Authoritative Current Stock Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#5C6F68] block">
            Authoritative On Hand
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-[#1E3932]">
              {totalOnHand.toLocaleString("id-ID")}
            </span>
            <span className="text-xs text-[#5C6F68]">unit di gudang</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#5C6F68] block">
            Stock Reserved (Checkout Active)
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-[#E65100]">
              {totalReserved.toLocaleString("id-ID")}
            </span>
            <span className="text-xs text-[#5C6F68]">terkunci pesanan</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#5C6F68] block">
            Authoritative Available
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-[#00754A]">
              {totalAvailable.toLocaleString("id-ID")}
            </span>
            <span className="text-xs text-[#5C6F68]">siap dialokasikan</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-[#E5E2DA] flex items-center gap-4 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("ITEMS")}
          className={`pb-2.5 px-1 border-b-2 cursor-pointer transition-colors ${
            activeTab === "ITEMS"
              ? "border-[#00754A] text-[#00754A] font-bold"
              : "border-transparent text-[#5C6F68] hover:text-[#1E3932]"
          }`}
        >
          Ringkasan Item & Stok ({items.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("LOTS")}
          className={`pb-2.5 px-1 border-b-2 cursor-pointer transition-colors ${
            activeTab === "LOTS"
              ? "border-[#00754A] text-[#00754A] font-bold"
              : "border-transparent text-[#5C6F68] hover:text-[#1E3932]"
          }`}
        >
          Lot & Pelacakan FEFO ({lots.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("LEDGER")}
          className={`pb-2.5 px-1 border-b-2 cursor-pointer transition-colors ${
            activeTab === "LEDGER"
              ? "border-[#00754A] text-[#00754A] font-bold"
              : "border-transparent text-[#5C6F68] hover:text-[#1E3932]"
          }`}
        >
          Riwayat Buku Besar (Stock Ledger)
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A9590]" />
          <input
            type="text"
            placeholder={
              activeTab === "ITEMS"
                ? "Cari kode atau nama item..."
                : activeTab === "LOTS"
                ? "Cari nomor lot atau produk..."
                : "Cari nomor referensi mutasi..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs text-[#1E3932] placeholder-[#8A9590] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
          />
        </div>

        {activeTab === "ITEMS" && (
          <div className="flex items-center gap-2 self-start sm:self-auto w-full sm:w-auto">
            <span className="text-xs font-semibold text-[#5C6F68]">Tipe:</span>
            <div className="inline-flex rounded-xl border border-[#D5D1C7] p-0.5 bg-[#FAF9F7] text-xs">
              <button
                type="button"
                onClick={() => setTypeFilter("ALL")}
                className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer ${
                  typeFilter === "ALL" ? "bg-white text-[#1E3932] shadow-sm font-bold" : "text-[#5C6F68]"
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("FINISHED_GOOD")}
                className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer ${
                  typeFilter === "FINISHED_GOOD" ? "bg-white text-[#1E3932] shadow-sm font-bold" : "text-[#5C6F68]"
                }`}
              >
                Produk Jadi
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("RAW_MATERIAL")}
                className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer ${
                  typeFilter === "RAW_MATERIAL" ? "bg-white text-[#1E3932] shadow-sm font-bold" : "text-[#5C6F68]"
                }`}
              >
                Bahan Baku
              </button>
            </div>
          </div>
        )}

        {activeTab === "LOTS" && (
          <div className="flex items-center gap-2 self-start sm:self-auto w-full sm:w-auto">
            <span className="text-xs font-semibold text-[#5C6F68]">Status FEFO:</span>
            <div className="inline-flex rounded-xl border border-[#D5D1C7] p-0.5 bg-[#FAF9F7] text-xs">
              <button
                type="button"
                onClick={() => setFefoFilter("ALL")}
                className={`px-2 py-1 rounded-lg font-medium cursor-pointer ${
                  fefoFilter === "ALL" ? "bg-white text-[#1E3932] shadow-sm font-bold" : "text-[#5C6F68]"
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setFefoFilter("Available")}
                className={`px-2 py-1 rounded-lg font-medium cursor-pointer ${
                  fefoFilter === "Available" ? "bg-white text-[#1E3932] shadow-sm font-bold" : "text-[#5C6F68]"
                }`}
              >
                Available
              </button>
              <button
                type="button"
                onClick={() => setFefoFilter("Critical")}
                className={`px-2 py-1 rounded-lg font-medium cursor-pointer ${
                  fefoFilter === "Critical" ? "bg-white text-[#D32F2F] shadow-sm font-bold" : "text-[#5C6F68]"
                }`}
              >
                Critical (&le;7d)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#5C6F68] flex flex-col items-center justify-center gap-2">
            <Loader2 className="animate-spin text-[#00754A]" size={24} />
            <span>Memuat data inventaris terotorisasi dari ERP...</span>
          </div>
        ) : activeTab === "ITEMS" ? (
          /* TAB 1: ITEMS TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1E3932]">
              <thead className="bg-[#FAF9F7] text-[#5C6F68] font-bold uppercase text-[10px] tracking-wider border-b border-[#E5E2DA]">
                <tr>
                  <th className="px-4 py-3">Kode Item</th>
                  <th className="px-4 py-3">Nama Item</th>
                  <th className="px-4 py-3">Tipe</th>
                  <th className="px-4 py-3">Satuan</th>
                  <th className="px-4 py-3 text-right">On Hand</th>
                  <th className="px-4 py-3 text-right">Reserved</th>
                  <th className="px-4 py-3 text-right">Available</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DA]">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-[#5C6F68]">
                      Belum ada data item inventaris yang cocok.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-[#FDFCFB] transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-[#1E3932]">{item.code}</td>
                      <td className="px-4 py-3 font-medium text-[#1E3932]">{item.name}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF9F7] border border-[#E5E2DA] text-[#5C6F68]">
                          {item.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[#5C6F68]">{item.base_uom?.code || "—"}</td>
                      <td className="px-4 py-3 font-mono text-right font-bold text-[#1E3932]">
                        {item.stock.on_hand.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3 font-mono text-right text-[#E65100]">
                        {item.stock.reserved > 0 ? item.stock.reserved.toLocaleString("id-ID") : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-right font-bold text-[#00754A]">
                        {item.stock.available.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            item.active
                              ? "bg-[#E8F5E9] text-[#1E3932] border-[#C8E6C9]"
                              : "bg-[#FFEBEE] text-[#C62828] border-[#FFCDD2]"
                          }`}
                        >
                          {item.active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenReceipt(item)}
                            className="px-2 py-1 rounded bg-[#E8F5E9] hover:bg-[#C8E6C9] border border-[#A5D6A7] text-[11px] font-bold text-[#00754A] cursor-pointer"
                            title="Terima Stok Masuk"
                          >
                            + Terima
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenAdjust(item)}
                            className="px-2 py-1 rounded bg-[#FFF8E1] hover:bg-[#FFECB3] border border-[#FFE082] text-[11px] font-semibold text-[#F57F17] cursor-pointer"
                            title="Sesuaikan Stok"
                          >
                            Koreksi
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditItem(item)}
                            className="p-1 rounded hover:bg-[#EFECE6] text-[#5C6F68] cursor-pointer"
                            title="Edit Item"
                          >
                            <Edit2 size={13} />
                          </button>
                          {item.active && (
                            <button
                              type="button"
                              onClick={() => handleDeactivateItem(item)}
                              className="p-1 rounded hover:bg-[#FFEBEE] text-[#D32F2F] cursor-pointer"
                              title="Nonaktifkan Item"
                            >
                              <EyeOff size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : activeTab === "LOTS" ? (
          /* TAB 2: LOTS TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1E3932]">
              <thead className="bg-[#FAF9F7] text-[#5C6F68] font-bold uppercase text-[10px] tracking-wider border-b border-[#E5E2DA]">
                <tr>
                  <th className="px-4 py-3">Nomor Lot</th>
                  <th className="px-4 py-3">Item Inventaris</th>
                  <th className="px-4 py-3">Gudang</th>
                  <th className="px-4 py-3 text-right">On Hand</th>
                  <th className="px-4 py-3 text-right">Available</th>
                  <th className="px-4 py-3">Tgl Kedaluwarsa</th>
                  <th className="px-4 py-3">Sisa Hari</th>
                  <th className="px-4 py-3">Prioritas FEFO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DA]">
                {filteredLots.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-[#5C6F68]">
                      Belum ada data lot terdaftar.
                    </td>
                  </tr>
                ) : (
                  filteredLots.map((lot) => (
                    <tr key={lot.id} className="hover:bg-[#FDFCFB] transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-[#1E3932]">{lot.lot_number}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-[#1E3932] block">{lot.item_code}</span>
                        <span className="text-[10px] text-[#5C6F68]">{lot.item_name}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[#5C6F68]">{lot.warehouse_code}</td>
                      <td className="px-4 py-3 font-mono text-right font-bold text-[#1E3932]">
                        {lot.on_hand.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3 font-mono text-right font-bold text-[#00754A]">
                        {lot.available.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3 font-mono text-[#1E3932]">
                        {lot.expiration_date || "—"}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold">
                        {lot.days_remaining !== null ? `${lot.days_remaining} hari` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            lot.fefo_status === "Available"
                              ? "bg-[#E8F5E9] text-[#1E3932] border-[#C8E6C9]"
                              : lot.fefo_status === "Near Expiry"
                              ? "bg-[#FFF8E1] text-[#F57F17] border-[#FFE082]"
                              : lot.fefo_status === "Critical"
                              ? "bg-[#FFEBEE] text-[#D32F2F] border-[#FFCDD2]"
                              : "bg-[#FAF9F7] text-[#5C6F68] border-[#E5E2DA]"
                          }`}
                        >
                          {lot.fefo_status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* TAB 3: IMMUTABLE LEDGER ENTRIES */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1E3932]">
              <thead className="bg-[#FAF9F7] text-[#5C6F68] font-bold uppercase text-[10px] tracking-wider border-b border-[#E5E2DA]">
                <tr>
                  <th className="px-4 py-3">Waktu Transaksi</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Gudang</th>
                  <th className="px-4 py-3">Lot</th>
                  <th className="px-4 py-3">Event Type</th>
                  <th className="px-4 py-3 text-right">Delta Mutasi</th>
                  <th className="px-4 py-3">Referensi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DA]">
                {ledgerEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[#5C6F68]">
                      Belum ada riwayat mutasi buku besar tercatat.
                    </td>
                  </tr>
                ) : (
                  ledgerEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-[#FDFCFB] transition-colors">
                      <td className="px-4 py-3 font-mono text-[11px] text-[#5C6F68]">
                        {new Date(entry.occurred_at).toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-[#1E3932] block">{entry.item_code}</span>
                        <span className="text-[10px] text-[#5C6F68]">{entry.item_name}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[#5C6F68]">{entry.warehouse_code}</td>
                      <td className="px-4 py-3 font-mono text-[#5C6F68]">{entry.lot_number || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#FAF9F7] border border-[#E5E2DA] text-[#5C6F68]">
                          {entry.event_type}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-3 font-mono text-right font-bold ${
                          entry.quantity_delta > 0 ? "text-[#00754A]" : "text-[#D32F2F]"
                        }`}
                      >
                        {entry.quantity_delta > 0 ? `+${entry.quantity_delta}` : entry.quantity_delta}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-[#5C6F68]">
                        {entry.reference_id || entry.reference_type || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Tambah / Edit Item */}
      {itemModalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E5E2DA] shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-[#E5E2DA] flex items-center justify-between bg-[#FAF9F7]">
              <div>
                <h3 className="text-sm font-bold text-[#1E3932]">
                  {itemModalMode === "CREATE" ? "Tambah Item Inventaris Baru" : "Edit Item Inventaris"}
                </h3>
                <p className="text-[11px] text-[#5C6F68]">
                  Entitas inventaris resmi ERP untuk manajemen mutasi buku besar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setItemModalMode(null)}
                className="p-1 rounded-lg text-[#5C6F68] hover:text-[#1E3932] hover:bg-[#EFECE6] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1E3932] mb-1">Kode Item (Unik) *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: FG-MELON-250"
                  value={itemForm.code}
                  onChange={(e) => setItemForm({ ...itemForm, code: e.target.value.toUpperCase().trim() })}
                  className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs font-mono text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E3932] mb-1">Nama Item *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Callme Yoghurt Melon 250ml"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1E3932] mb-1">Tipe Item *</label>
                  <select
                    value={itemForm.type}
                    onChange={(e) => setItemForm({ ...itemForm, type: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                  >
                    <option value="FINISHED_GOOD">FINISHED_GOOD</option>
                    <option value="RAW_MATERIAL">RAW_MATERIAL</option>
                    <option value="PACKAGING">PACKAGING</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E3932] mb-1">Satuan Dasar *</label>
                  <select
                    required
                    value={itemForm.base_uom_id}
                    onChange={(e) => setItemForm({ ...itemForm, base_uom_id: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                  >
                    <option value="" disabled>
                      Pilih UOM...
                    </option>
                    {uoms.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="item_lot_tracked"
                    checked={itemForm.lot_tracked}
                    onChange={(e) => setItemForm({ ...itemForm, lot_tracked: e.target.checked })}
                    className="rounded border-[#D5D1C7] text-[#00754A] focus:ring-[#00754A]"
                  />
                  <label htmlFor="item_lot_tracked" className="text-xs font-semibold text-[#1E3932] cursor-pointer">
                    Lot-Tracked (Memerlukan nomor lot saat mutasi)
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="item_active"
                    checked={itemForm.active}
                    onChange={(e) => setItemForm({ ...itemForm, active: e.target.checked })}
                    className="rounded border-[#D5D1C7] text-[#00754A] focus:ring-[#00754A]"
                  />
                  <label htmlFor="item_active" className="text-xs font-semibold text-[#1E3932] cursor-pointer">
                    Item Aktif
                  </label>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#E5E2DA]">
                <button
                  type="button"
                  onClick={() => setItemModalMode(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-[#D5D1C7] text-xs font-semibold text-[#5C6F68] hover:bg-[#FAF9F7] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#00754A] hover:bg-[#005a38] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
                >
                  {isPending && <Loader2 size={13} className="animate-spin" />}
                  <span>Simpan Item</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Terima Stok */}
      {receiptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E5E2DA] shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-[#E5E2DA] flex items-center justify-between bg-[#FAF9F7]">
              <div>
                <h3 className="text-sm font-bold text-[#1E3932]">Form Terima Stok Masuk (Stock Receipt)</h3>
                <p className="text-[11px] text-[#5C6F68]">
                  Mencatat mutasi masuk ke buku besar append-only (+ delta).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReceiptModalOpen(false)}
                className="p-1 rounded-lg text-[#5C6F68] hover:text-[#1E3932] hover:bg-[#EFECE6] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveReceipt} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1E3932] mb-1">Item Inventaris *</label>
                  <select
                    required
                    value={receiptForm.inventory_item_id}
                    onChange={(e) => {
                      const id = e.target.value;
                      const selected = items.find((i) => i.id === id);
                      setReceiptForm((prev) => ({
                        ...prev,
                        inventory_item_id: id,
                        lot_number: selected?.lot_tracked ? `LOT-${selected.code}-001` : "",
                      }));
                    }}
                    className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                  >
                    <option value="" disabled>
                      Pilih Item...
                    </option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.code} — {i.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E3932] mb-1">Gudang Penyimpanan *</label>
                  <select
                    required
                    value={receiptForm.warehouse_id}
                    onChange={(e) => setReceiptForm({ ...receiptForm, warehouse_id: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                  >
                    <option value="" disabled>
                      Pilih Gudang...
                    </option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} — {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1E3932] mb-1">Kuantitas Masuk *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    step="any"
                    placeholder="50"
                    value={receiptForm.quantity}
                    onChange={(e) => setReceiptForm({ ...receiptForm, quantity: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs font-mono font-bold text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E3932] mb-1">Nomor Lot (Wajib jika Lot-Tracked)</label>
                  <input
                    type="text"
                    placeholder="Contoh: LOT-2026-09-01"
                    value={receiptForm.lot_number}
                    onChange={(e) => setReceiptForm({ ...receiptForm, lot_number: e.target.value.toUpperCase().trim() })}
                    className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs font-mono text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1E3932] mb-1">Tgl Produksi (Opsional)</label>
                  <input
                    type="date"
                    value={receiptForm.production_date}
                    onChange={(e) => setReceiptForm({ ...receiptForm, production_date: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E3932] mb-1">Tgl Kedaluwarsa (Opsional)</label>
                  <input
                    type="date"
                    value={receiptForm.expiration_date}
                    onChange={(e) => setReceiptForm({ ...receiptForm, expiration_date: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E3932] mb-1">Nomor Referensi Penerimaan</label>
                <input
                  type="text"
                  placeholder="Contoh: PO-2026-001 / BAST-GUDANG"
                  value={receiptForm.reference}
                  onChange={(e) => setReceiptForm({ ...receiptForm, reference: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs font-mono text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#E5E2DA]">
                <button
                  type="button"
                  onClick={() => setReceiptModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-[#D5D1C7] text-xs font-semibold text-[#5C6F68] hover:bg-[#FAF9F7] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#00754A] hover:bg-[#005a38] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
                >
                  {isPending && <Loader2 size={13} className="animate-spin" />}
                  <span>Catat Penerimaan Stok</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Penyesuaian Stok */}
      {adjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E5E2DA] shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-[#E5E2DA] flex items-center justify-between bg-[#FAF9F7]">
              <div>
                <h3 className="text-sm font-bold text-[#1E3932]">Penyesuaian Stok (Stock Adjustment)</h3>
                <p className="text-[11px] text-[#5C6F68]">
                  Menambahkan baris penyesuaian ke buku besar (+/- delta). Tidak pernah mengedit baris historis.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustModalOpen(false)}
                className="p-1 rounded-lg text-[#5C6F68] hover:text-[#1E3932] hover:bg-[#EFECE6] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveAdjust} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1E3932] mb-1">Item Inventaris *</label>
                  <select
                    required
                    value={adjustForm.inventory_item_id}
                    onChange={(e) => setAdjustForm({ ...adjustForm, inventory_item_id: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                  >
                    <option value="" disabled>
                      Pilih Item...
                    </option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.code} — {i.name} (Tersedia: {i.stock.available})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E3932] mb-1">Gudang *</label>
                  <select
                    required
                    value={adjustForm.warehouse_id}
                    onChange={(e) => setAdjustForm({ ...adjustForm, warehouse_id: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                  >
                    <option value="" disabled>
                      Pilih Gudang...
                    </option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} — {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1E3932] mb-1">Delta Jumlah (+ atau -) *</label>
                  <input
                    type="number"
                    required
                    step="any"
                    placeholder="-5 atau +10"
                    value={adjustForm.quantity_delta}
                    onChange={(e) => setAdjustForm({ ...adjustForm, quantity_delta: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs font-mono font-bold text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                  />
                  <p className="text-[10px] text-[#8A9590] mt-1">
                    Gunakan tanda minus (-) untuk pengurangan stok rusak / susut.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E3932] mb-1">Lot Spesifik (Opsional)</label>
                  <select
                    value={adjustForm.inventory_lot_id}
                    onChange={(e) => setAdjustForm({ ...adjustForm, inventory_lot_id: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                  >
                    <option value="">Semua / Tanpa Lot Spesifik</option>
                    {lots
                      .filter((l) => l.inventory_item_id === adjustForm.inventory_item_id)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.lot_number} (Tersedia: {l.available})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E3932] mb-1">Nomor Dokumen / Referensi *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: OPNAME-2026-09 / RETUR-001"
                  value={adjustForm.reference}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reference: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs font-mono text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E3932] mb-1">Alasan Penyesuaian (Audit Log) *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Alasan detail penyesuaian untuk catatan audit resmi..."
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#E5E2DA]">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-[#D5D1C7] text-xs font-semibold text-[#5C6F68] hover:bg-[#FAF9F7] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#00754A] hover:bg-[#005a38] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
                >
                  {isPending && <Loader2 size={13} className="animate-spin" />}
                  <span>Eksekusi Penyesuaian</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog (Nonaktifkan Item) */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E5E2DA] shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 space-y-3">
              <div className="w-10 h-10 rounded-full bg-[#FFEBEE] text-[#D32F2F] flex items-center justify-center">
                <AlertCircle size={20} />
              </div>
              <h3 className="text-sm font-bold text-[#1E3932]">{confirmDialog.title}</h3>
              <p className="text-xs text-[#5C6F68] leading-relaxed">{confirmDialog.description}</p>
            </div>

            <div className="p-4 bg-[#FAF9F7] border-t border-[#E5E2DA] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="px-3 py-1.5 rounded-xl border border-[#D5D1C7] text-xs font-semibold text-[#5C6F68] hover:bg-white cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="px-3.5 py-1.5 rounded-xl bg-[#C62828] hover:bg-[#B71C1C] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                Konfirmasi Nonaktifkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
