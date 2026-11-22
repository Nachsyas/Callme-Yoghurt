"use client";

import React, { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { modalBackdropVariants, modalDialogVariants, MOTION_TOKENS } from "@/lib/motion";
import {
  AlertCircle,
  CheckCircle2,
  Edit2,
  EyeOff,
  Layers,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Tag,
  X,
} from "lucide-react";

interface CatalogPrice {
  id: string;
  currency: string;
  amount: number;
}

interface CatalogPriceHistory {
  id: string;
  currency: string;
  amount: number;
  active: boolean;
  created_at: string;
}

interface CatalogVariant {
  id: string;
  product_id: string;
  inventory_item_id: string;
  inventory_item: {
    id: string;
    code: string;
    name: string;
    type: string;
    active: boolean;
  } | null;
  sku: string;
  variant_name: string;
  net_content_quantity: number | null;
  net_content_uom_id: string | null;
  net_content_uom: {
    id: string;
    code: string;
    name: string;
  } | null;
  active: boolean;
  price: CatalogPrice | null;
  price_history: CatalogPriceHistory[];
}

interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  variants: CatalogVariant[];
}

interface InventoryItemOption {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface UomOption {
  id: string;
  code: string;
  name: string;
}

// Map for authoritative 7 official flavors images; other products use neutral placeholder icon
const OFFICIAL_IMAGE_MAP: Record<string, string> = {
  plain: "/images/plain.png",
  stroberi: "/images/stroberi.png",
  mangga: "/images/mangga.png",
  melon: "/images/melon.png",
  anggur: "/images/anggur.png",
  leci: "/images/leci.png",
  vanila: "/images/vanila.png",
};

export default function AdminCatalogPage() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemOption[]>([]);
  const [uoms, setUoms] = useState<UomOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Modal States
  const [productModalMode, setProductModalMode] = useState<"CREATE" | "EDIT" | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [productForm, setProductForm] = useState({ name: "", slug: "", description: "", active: true });

  const [variantModalMode, setVariantModalMode] = useState<"CREATE" | "EDIT" | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<CatalogVariant | null>(null);
  const [targetProductForVariant, setTargetProductForVariant] = useState<CatalogProduct | null>(null);
  const [variantForm, setVariantForm] = useState({
    sku: "",
    variant_name: "",
    inventory_item_id: "",
    net_content_quantity: "",
    net_content_uom_id: "",
    price: "",
    active: true,
  });

  const [priceModalVariant, setPriceModalVariant] = useState<CatalogVariant | null>(null);
  const [priceInput, setPriceInput] = useState("");

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => Promise<void>;
  }>({ isOpen: false, title: "", description: "", onConfirm: async () => {} });

  const [isPending, startTransition] = useTransition();
  const shouldReduceMotion = useReducedMotion();

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [prodRes, invRes, metaRes] = await Promise.all([
        fetch("/api/admin/catalog/products", { cache: "no-store" }),
        fetch("/api/admin/inventory/items", { cache: "no-store" }),
        fetch("/api/admin/inventory/meta", { cache: "no-store" }),
      ]);

      if (!prodRes.ok) {
        throw new Error("Gagal mengambil data katalog dari ERP Core");
      }

      const prodData = await prodRes.json();
      setProducts(prodData.products || []);

      if (invRes.ok) {
        const invData = await invRes.json();
        setInventoryItems(invData.items || []);
      }

      if (metaRes.ok) {
        const metaData = await metaRes.json();
        setUoms(metaData.uoms || []);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Terjadi kesalahan saat memuat katalog");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Keyboard accessibility: Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmDialog.isOpen) setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        else if (priceModalVariant) setPriceModalVariant(null);
        else if (variantModalMode) setVariantModalMode(null);
        else if (productModalMode) setProductModalMode(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmDialog.isOpen, priceModalVariant, variantModalMode, productModalMode]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Product Actions
  const handleOpenCreateProduct = () => {
    setProductForm({ name: "", slug: "", description: "", active: true });
    setSelectedProduct(null);
    setProductModalMode("CREATE");
  };

  const handleOpenEditProduct = (prod: CatalogProduct) => {
    setProductForm({
      name: prod.name,
      slug: prod.slug,
      description: prod.description || "",
      active: prod.active,
    });
    setSelectedProduct(prod);
    setProductModalMode("EDIT");
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const isEdit = productModalMode === "EDIT" && selectedProduct;
        const url = isEdit
          ? `/api/admin/catalog/products/${selectedProduct.id}`
          : "/api/admin/catalog/products";
        const method = isEdit ? "PUT" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(productForm),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Gagal menyimpan produk");
        }

        setProductModalMode(null);
        showSuccess(isEdit ? "Produk berhasil diperbarui" : "Produk baru berhasil ditambahkan");
        loadData();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Gagal memproses produk");
      }
    });
  };

  const handleDeactivateProduct = (prod: CatalogProduct) => {
    setConfirmDialog({
      isOpen: true,
      title: `Nonaktifkan Produk "${prod.name}"?`,
      description:
        "Produk dan seluruh variannya tidak akan muncul di katalog storefront. Riwayat pesanan dan data keuangan historis tetap tersimpan secara permanen di ERP.",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/catalog/products/${prod.id}`, { method: "DELETE" });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Gagal menonaktifkan produk");
          }
          showSuccess(`Produk "${prod.name}" berhasil dinonaktifkan`);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          loadData();
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : "Gagal menonaktifkan produk");
        }
      },
    });
  };

  // Variant Actions
  const handleOpenAddVariant = (prod: CatalogProduct) => {
    setTargetProductForVariant(prod);
    setVariantForm({
      sku: `CY-${prod.slug.toUpperCase()}-`,
      variant_name: `${prod.name} `,
      inventory_item_id: "",
      net_content_quantity: "",
      net_content_uom_id: "",
      price: "",
      active: true,
    });
    setSelectedVariant(null);
    setVariantModalMode("CREATE");
  };

  const handleOpenEditVariant = (prod: CatalogProduct, variant: CatalogVariant) => {
    setTargetProductForVariant(prod);
    setSelectedVariant(variant);
    setVariantForm({
      sku: variant.sku,
      variant_name: variant.variant_name,
      inventory_item_id: variant.inventory_item_id,
      net_content_quantity: variant.net_content_quantity ? String(variant.net_content_quantity) : "",
      net_content_uom_id: variant.net_content_uom_id || "",
      price: variant.price ? String(variant.price.amount) : "",
      active: variant.active,
    });
    setVariantModalMode("EDIT");
  };

  const handleSaveVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProductForVariant) return;
    setErrorMsg(null);

    if (variantModalMode === "CREATE") {
      if (!variantForm.inventory_item_id || variantForm.inventory_item_id.trim() === "") {
        setErrorMsg("Item inventaris wajib dipilih untuk varian baru");
        return;
      }
      if (!variantForm.net_content_uom_id || variantForm.net_content_uom_id.trim() === "") {
        setErrorMsg("Satuan (UOM) wajib dipilih untuk varian baru");
        return;
      }
      if (!variantForm.price || variantForm.price.trim() === "") {
        setErrorMsg("Harga awal wajib diisi untuk varian baru");
        return;
      }
      const priceNum = parseInt(variantForm.price, 10);
      if (isNaN(priceNum) || priceNum <= 0 || !Number.isInteger(Number(variantForm.price)) || variantForm.price.includes(".")) {
        setErrorMsg("Harga awal harus berupa angka bulat positif lebih dari 0");
        return;
      }
      if (!variantForm.net_content_quantity || variantForm.net_content_quantity.trim() === "") {
        setErrorMsg("Volume / berat bersih varian wajib diisi");
        return;
      }
      const qtyNum = Number(variantForm.net_content_quantity);
      if (isNaN(qtyNum) || qtyNum <= 0) {
        setErrorMsg("Volume / berat bersih varian harus berupa angka positif");
        return;
      }
    }

    startTransition(async () => {
      try {
        const isEdit = variantModalMode === "EDIT" && selectedVariant;
        const url = isEdit
          ? `/api/admin/catalog/variants/${selectedVariant.id}`
          : "/api/admin/catalog/variants";
        const method = isEdit ? "PUT" : "POST";

        const payload = isEdit
          ? {
              variant_name: variantForm.variant_name,
              sku: variantForm.sku,
              inventory_item_id: variantForm.inventory_item_id,
              net_content_quantity: variantForm.net_content_quantity ? Number(variantForm.net_content_quantity) : null,
              net_content_uom_id: variantForm.net_content_uom_id || null,
              active: variantForm.active,
            }
          : {
              product_id: targetProductForVariant.id,
              sku: variantForm.sku,
              variant_name: variantForm.variant_name,
              inventory_item_id: variantForm.inventory_item_id,
              net_content_quantity: variantForm.net_content_quantity ? Number(variantForm.net_content_quantity) : null,
              net_content_uom_id: variantForm.net_content_uom_id || null,
              price: variantForm.price ? parseInt(variantForm.price, 10) : undefined,
              active: variantForm.active,
            };

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Gagal menyimpan varian");
        }

        setVariantModalMode(null);
        showSuccess(isEdit ? "Varian berhasil diperbarui" : "Varian baru berhasil ditambahkan");
        loadData();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Gagal memproses varian");
      }
    });
  };

  const handleDeactivateVariant = (variant: CatalogVariant) => {
    setConfirmDialog({
      isOpen: true,
      title: `Nonaktifkan Varian "${variant.variant_name}"?`,
      description:
        "Varian ini tidak lagi dapat dipesan di storefront atau diproses dalam checkout baru. Riwayat pesanan terdahulu tetap dipertahankan.",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/catalog/variants/${variant.id}`, { method: "DELETE" });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Gagal menonaktifkan varian");
          }
          showSuccess(`Varian "${variant.sku}" berhasil dinonaktifkan`);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          loadData();
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : "Gagal menonaktifkan varian");
        }
      },
    });
  };

  // Price Actions
  const handleOpenPriceModal = (variant: CatalogVariant) => {
    setPriceModalVariant(variant);
    setPriceInput(variant.price ? String(variant.price.amount) : "");
  };

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceModalVariant) return;
    setErrorMsg(null);

    const intPrice = parseInt(priceInput, 10);
    if (isNaN(intPrice) || intPrice <= 0 || !Number.isInteger(Number(priceInput)) || priceInput.includes(".")) {
      setErrorMsg("Harga harus berupa nominal angka bulat positif lebih dari 0");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/catalog/variants/${priceModalVariant.id}/price`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: intPrice }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Gagal memperbarui harga");
        }

        setPriceModalVariant(null);
        showSuccess(`Harga varian ${priceModalVariant.sku} berhasil diubah ke Rp ${intPrice.toLocaleString("id-ID")}`);
        loadData();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Gagal mengubah harga");
      }
    });
  };

  // Filtered Products
  const filteredProducts = products.filter((prod) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      prod.name.toLowerCase().includes(q) ||
      prod.slug.toLowerCase().includes(q) ||
      prod.variants.some((v) => v.sku.toLowerCase().includes(q) || v.variant_name.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (statusFilter === "ACTIVE" && !prod.active) return false;
    if (statusFilter === "INACTIVE" && prod.active) return false;

    return true;
  });

  const totalVariants = products.reduce((acc, p) => acc + p.variants.length, 0);

  return (
    <div className="space-y-6">
      {/* Notifications */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: MOTION_TOKENS.duration.fast }}
            className="p-4 rounded-xl bg-[#E8F5E9] border border-[#C8E6C9] text-[#1E3932] text-xs font-semibold flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[#00754A]" />
              <span>{successMsg}</span>
            </div>
            <button type="button" onClick={() => setSuccessMsg(null)} className="text-[#5C6F68] hover:text-[#1E3932] cursor-pointer">
              <X size={14} />
            </button>
          </motion.div>
        )}

        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: MOTION_TOKENS.duration.fast }}
            className="p-4 rounded-xl bg-[#FFEBEE] border border-[#FFCDD2] text-[#B71C1C] text-xs font-semibold flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-[#D32F2F]" />
              <span>{errorMsg}</span>
            </div>
            <button type="button" onClick={() => setErrorMsg(null)} className="text-[#B71C1C] hover:opacity-80 cursor-pointer">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Info Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#1E3932]">
            Katalog Produk & Varian Master
          </h2>
          <p className="text-xs text-[#5C6F68] mt-0.5">
            Manajemen master data katalog resmi Callme Yoghurt — 7 Varian Resmi Terotorisasi (7 Varian Resmi: Plain, Anggur, Stroberi, Leci, Mangga, Vanila, Melon) dan ekspansi produk baru terotorisasi.
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

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#E8F5E9] text-[#1E3932] border border-[#C8E6C9] text-xs font-semibold">
            <CheckCircle2 size={13} className="text-[#00754A]" />
            <span>{products.filter((p) => p.active).length} Produk Aktif</span>
          </span>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FAF9F7] text-[#5C6F68] border border-[#E5E2DA] text-xs font-mono">
            {totalVariants} Total Varian
          </span>

          <button
            type="button"
            onClick={handleOpenCreateProduct}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#00754A] hover:bg-[#005a38] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Plus size={14} />
            <span>+ Tambah Produk</span>
          </button>
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
          <span className="text-xs font-semibold text-[#5C6F68]">Status:</span>
          <div className="inline-flex rounded-xl border border-[#D5D1C7] p-0.5 bg-[#FAF9F7] text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                statusFilter === "ALL" ? "bg-white text-[#1E3932] shadow-sm font-bold" : "text-[#5C6F68]"
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("ACTIVE")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                statusFilter === "ACTIVE" ? "bg-white text-[#1E3932] shadow-sm font-bold" : "text-[#5C6F68]"
              }`}
            >
              Aktif
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("INACTIVE")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                statusFilter === "INACTIVE" ? "bg-white text-[#1E3932] shadow-sm font-bold" : "text-[#5C6F68]"
              }`}
            >
              Nonaktif
            </button>
          </div>
        </div>
      </div>

      {/* Catalog Table (Desktop & Tablet) */}
      <div className="bg-white rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#5C6F68] flex flex-col items-center justify-center gap-2">
            <Loader2 className="animate-spin text-[#00754A]" size={24} />
            <span>Memuat data katalog terotorisasi dari ERP...</span>
          </div>
        ) : (
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1E3932]">
              <thead className="bg-[#FAF9F7] text-[#5C6F68] font-bold uppercase text-[10px] tracking-wider border-b border-[#E5E2DA]">
                <tr>
                  <th className="px-4 py-3">Produk</th>
                  <th className="px-4 py-3">Varian & SKU</th>
                  <th className="px-4 py-3">Isi Bersih</th>
                  <th className="px-4 py-3">Harga Satuan (IDR)</th>
                  <th className="px-4 py-3">Item Inventaris</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi Varian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DA]">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[#5C6F68]">
                      Belum ada data produk yang cocok dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const rowSpan = Math.max(1, product.variants.length);
                    const imageSrc = OFFICIAL_IMAGE_MAP[product.slug.toLowerCase()];

                    return product.variants.length === 0 ? (
                      <tr key={product.id} className="hover:bg-[#FDFCFB] transition-colors">
                        <td className="px-4 py-3 font-semibold align-top border-r border-[#E5E2DA]/40">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-[#FAF9F7] border border-[#E5E2DA] flex-shrink-0 flex items-center justify-center">
                                {imageSrc ? (
                                  <Image src={imageSrc} alt={product.name} fill sizes="40px" className="object-contain p-1" />
                                ) : (
                                  <Package size={20} className="text-[#8A9590]" />
                                )}
                              </div>
                              <div>
                                <span className="font-bold text-sm text-[#1E3932] block">{product.name}</span>
                                <span className="text-[10px] text-[#5C6F68] font-mono">{product.slug}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditProduct(product)}
                                title="Edit Produk"
                                className="p-1 rounded hover:bg-[#EFECE6] text-[#5C6F68] cursor-pointer"
                              >
                                <Edit2 size={13} />
                              </button>
                              {product.active && (
                                <button
                                  type="button"
                                  onClick={() => handleDeactivateProduct(product)}
                                  title="Nonaktifkan Produk"
                                  className="p-1 rounded hover:bg-[#FFEBEE] text-[#D32F2F] cursor-pointer"
                                >
                                  <EyeOff size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                        <td colSpan={5} className="px-4 py-3 text-[#5C6F68] italic">
                          Belum ada varian untuk produk ini.
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenAddVariant(product)}
                            className="px-2.5 py-1 rounded-lg bg-[#FAF9F7] hover:bg-[#EFECE6] border border-[#D5D1C7] text-xs font-semibold text-[#1E3932] cursor-pointer"
                          >
                            + Tambah Varian
                          </button>
                        </td>
                      </tr>
                    ) : (
                      product.variants.map((variant, vIdx) => (
                        <tr key={`${product.id}-${variant.id}`} className="hover:bg-[#FDFCFB] transition-colors">
                          {vIdx === 0 && (
                            <td
                              rowSpan={rowSpan}
                              className="px-4 py-3 font-semibold align-top border-r border-[#E5E2DA]/40 bg-white"
                            >
                              <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                  <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-[#FAF9F7] border border-[#E5E2DA] flex-shrink-0 flex items-center justify-center">
                                    {imageSrc ? (
                                      <Image src={imageSrc} alt={product.name} fill sizes="40px" className="object-contain p-1" />
                                    ) : (
                                      <Package size={20} className="text-[#8A9590]" />
                                    )}
                                  </div>
                                  <div>
                                    <span className="font-bold text-sm text-[#1E3932] block">{product.name}</span>
                                    <span className="text-[10px] text-[#5C6F68] font-mono">{product.slug}</span>
                                    {!product.active && (
                                      <span className="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]">
                                        NONAKTIF
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 pt-1 border-t border-[#E5E2DA]/50">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditProduct(product)}
                                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#FAF9F7] hover:bg-[#EFECE6] border border-[#D5D1C7] text-[#1E3932] cursor-pointer"
                                  >
                                    Edit Produk
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAddVariant(product)}
                                    className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#E8F5E9] hover:bg-[#C8E6C9] border border-[#A5D6A7] text-[#00754A] cursor-pointer"
                                  >
                                    + Varian
                                  </button>
                                  {product.active && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeactivateProduct(product)}
                                      className="px-2 py-0.5 rounded text-[11px] font-medium text-[#C62828] hover:bg-[#FFEBEE] cursor-pointer"
                                    >
                                      Nonaktifkan
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                          )}

                          <td className="px-4 py-3">
                            <span className="font-semibold text-[#1E3932] block">{variant.variant_name}</span>
                            <span className="text-[10px] text-[#5C6F68] font-mono">{variant.sku}</span>
                          </td>

                          <td className="px-4 py-3 font-mono text-[#5C6F68]">
                            {variant.net_content_quantity !== null
                              ? `${variant.net_content_quantity} ${variant.net_content_uom?.code || ""}`
                              : "—"}
                          </td>

                          <td className="px-4 py-3">
                            {variant.price ? (
                              <span className="font-bold text-[#1E3932] block">
                                Rp {variant.price.amount.toLocaleString("id-ID")}
                              </span>
                            ) : (
                              <span className="text-[10px] italic text-[#C62828] font-semibold">Belum diset</span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {variant.inventory_item ? (
                              <div>
                                <span className="font-medium text-[#1E3932] block">{variant.inventory_item.code}</span>
                                <span className="text-[10px] text-[#5C6F68]">{variant.inventory_item.name}</span>
                              </div>
                            ) : (
                              <span className="text-[#8A9590]">—</span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                variant.active
                                  ? "bg-[#E8F5E9] text-[#1E3932] border-[#C8E6C9]"
                                  : "bg-[#FFEBEE] text-[#C62828] border-[#FFCDD2]"
                              }`}
                            >
                              {variant.active ? "ACTIVE" : "INACTIVE"}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenPriceModal(variant)}
                                className="px-2 py-1 rounded bg-[#FAF9F7] hover:bg-[#EFECE6] border border-[#D5D1C7] text-[11px] font-medium text-[#1E3932] cursor-pointer"
                              >
                                Ubah Harga
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditVariant(product, variant)}
                                className="p-1 rounded hover:bg-[#EFECE6] text-[#5C6F68] cursor-pointer"
                                title="Edit Varian"
                              >
                                <Edit2 size={13} />
                              </button>
                              {variant.active && (
                                <button
                                  type="button"
                                  onClick={() => handleDeactivateVariant(variant)}
                                  className="p-1 rounded hover:bg-[#FFEBEE] text-[#D32F2F] cursor-pointer"
                                  title="Nonaktifkan Varian"
                                >
                                  <EyeOff size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile View (Card-based) */}
        {!loading && (
          <div className="md:hidden divide-y divide-[#E5E2DA]">
            {filteredProducts.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#5C6F68]">
                Belum ada data produk yang cocok dengan pencarian.
              </div>
            ) : (
              filteredProducts.map((product) => {
                const imageSrc = OFFICIAL_IMAGE_MAP[product.slug.toLowerCase()];

                return (
                  <div key={product.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[#FAF9F7] border border-[#E5E2DA] flex-shrink-0 flex items-center justify-center">
                          {imageSrc ? (
                            <Image src={imageSrc} alt={product.name} fill sizes="48px" className="object-contain p-1" />
                          ) : (
                            <Package size={24} className="text-[#8A9590]" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-[#1E3932]">{product.name}</h3>
                          <p className="text-[10px] text-[#5C6F68] font-mono">{product.slug}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditProduct(product)}
                          className="px-2 py-1 rounded bg-[#FAF9F7] border border-[#D5D1C7] text-[11px] font-semibold text-[#1E3932]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenAddVariant(product)}
                          className="px-2 py-1 rounded bg-[#E8F5E9] border border-[#A5D6A7] text-[11px] font-bold text-[#00754A]"
                        >
                          + Varian
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-[#E5E2DA]/60">
                      {product.variants.map((v) => (
                        <div
                          key={v.id}
                          className="p-2.5 rounded-lg bg-[#FAF9F7] border border-[#E5E2DA] text-xs space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-bold text-[#1E3932] block">{v.variant_name}</span>
                              <span className="text-[10px] text-[#5C6F68] font-mono">{v.sku}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-[#1E3932] block">
                                {v.price ? `Rp ${v.price.amount.toLocaleString("id-ID")}` : "Belum diset"}
                              </span>
                              <span className="text-[10px] text-[#5C6F68]">
                                {v.net_content_quantity ? `${v.net_content_quantity} ml` : ""}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-[#E5E2DA]/50">
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                v.active ? "bg-[#E8F5E9] text-[#1E3932]" : "bg-[#FFEBEE] text-[#C62828]"
                              }`}
                            >
                              {v.active ? "AKTIF" : "NONAKTIF"}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenPriceModal(v)}
                                className="px-2 py-0.5 rounded bg-white border border-[#D5D1C7] text-[10px] font-medium text-[#1E3932]"
                              >
                                Ubah Harga
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditVariant(product, v)}
                                className="px-2 py-0.5 rounded bg-white border border-[#D5D1C7] text-[10px] font-medium text-[#1E3932]"
                              >
                                Edit
                              </button>
                              {v.active && (
                                <button
                                  type="button"
                                  onClick={() => handleDeactivateVariant(v)}
                                  className="px-2 py-0.5 rounded text-[10px] font-medium text-[#C62828] hover:bg-[#FFEBEE]"
                                >
                                  Nonaktifkan
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Modal: Tambah / Edit Produk */}
      <AnimatePresence>
        {productModalMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <motion.div
              variants={modalBackdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setProductModalMode(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
              aria-hidden="true"
            />
            <motion.div
              variants={modalDialogVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="relative z-10 bg-white rounded-2xl border border-[#E5E2DA] shadow-xl w-full max-w-md overflow-hidden font-sans"
            >
              <div className="p-5 border-b border-[#E5E2DA] flex items-center justify-between bg-[#FAF9F7]">
                <div>
                  <h3 className="text-sm font-bold text-[#1E3932]">
                    {productModalMode === "CREATE" ? "Tambah Produk Master Baru" : "Edit Metadata Produk"}
                  </h3>
                  <p className="text-[11px] text-[#5C6F68]">
                    Otoritas master katalog tersimpan langsung di ERP Core.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setProductModalMode(null)}
                  className="p-1 rounded-lg text-[#5C6F68] hover:text-[#1E3932] hover:bg-[#EFECE6] cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#1E3932] mb-1">Nama Produk *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Yoghurt Rasa Melon"
                    value={productForm.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setProductForm((prev) => ({
                        ...prev,
                        name,
                        slug:
                          productModalMode === "CREATE" && !prev.slug
                            ? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
                            : prev.slug,
                      }));
                    }}
                    className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E3932] mb-1">Slug URL (Unik) *</label>
                  <input
                    type="text"
                    required
                    placeholder="contoh: melon"
                    value={productForm.slug}
                    onChange={(e) => setProductForm({ ...productForm, slug: e.target.value.toLowerCase().trim() })}
                    className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs font-mono text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                  />
                  <p className="text-[10px] text-[#8A9590] mt-1">
                    Digunakan untuk routing URL storefront (/product/[slug]).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E3932] mb-1">Deskripsi Produk</label>
                  <textarea
                    rows={3}
                    placeholder="Deskripsi produk resmi..."
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="prod_active"
                    checked={productForm.active}
                    onChange={(e) => setProductForm({ ...productForm, active: e.target.checked })}
                    className="rounded border-[#D5D1C7] text-[#00754A] focus:ring-[#00754A]"
                  />
                  <label htmlFor="prod_active" className="text-xs font-semibold text-[#1E3932] cursor-pointer">
                    Produk Aktif (Tersedia untuk dijual)
                  </label>
                </div>

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#E5E2DA]">
                  <button
                    type="button"
                    onClick={() => setProductModalMode(null)}
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
                    <span>Simpan Produk</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Tambah / Edit Varian */}
      <AnimatePresence>
        {variantModalMode && targetProductForVariant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <motion.div
              variants={modalBackdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setVariantModalMode(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
              aria-hidden="true"
            />
            <motion.div
              variants={modalDialogVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="relative z-10 bg-white rounded-2xl border border-[#E5E2DA] shadow-xl w-full max-w-lg overflow-hidden font-sans"
            >
              <div className="p-5 border-b border-[#E5E2DA] flex items-center justify-between bg-[#FAF9F7]">
                <div>
                  <h3 className="text-sm font-bold text-[#1E3932]">
                    {variantModalMode === "CREATE"
                      ? `Tambah Varian untuk ${targetProductForVariant.name}`
                      : `Edit Varian ${selectedVariant?.sku}`}
                  </h3>
                  <p className="text-[11px] text-[#5C6F68]">
                    Setiap varian harus ditautkan ke item inventaris riil untuk alokasi FEFO.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setVariantModalMode(null)}
                  className="p-1 rounded-lg text-[#5C6F68] hover:text-[#1E3932] hover:bg-[#EFECE6] cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveVariant} className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#1E3932] mb-1">SKU Varian *</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: CY-MANGGA-250"
                      value={variantForm.sku}
                      onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value.toUpperCase().trim() })}
                      className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs font-mono text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1E3932] mb-1">Nama Varian *</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: 250 ml Botol"
                      value={variantForm.variant_name}
                      onChange={(e) => setVariantForm({ ...variantForm, variant_name: e.target.value })}
                      className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E3932] mb-1">
                    Item Inventaris Terkait (Authoritative ERP Item) *
                  </label>
                  <select
                    required
                    value={variantForm.inventory_item_id}
                    onChange={(e) => setVariantForm({ ...variantForm, inventory_item_id: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                  >
                    <option value="" disabled>
                      Pilih Item Inventaris ERP...
                    </option>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} — {item.name} ({item.type})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-[#8A9590] mt-1">
                    Reservasi stok FEFO saat checkout terikat ke item inventaris ini.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#1E3932] mb-1">Isi Bersih</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="250"
                      value={variantForm.net_content_quantity}
                      onChange={(e) => setVariantForm({ ...variantForm, net_content_quantity: e.target.value })}
                      className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs font-mono text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1E3932] mb-1">Satuan (UOM)</label>
                    <select
                      value={variantForm.net_content_uom_id}
                      onChange={(e) => setVariantForm({ ...variantForm, net_content_uom_id: e.target.value })}
                      className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                    >
                      <option value="">Pilih UOM...</option>
                      {uoms.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {variantModalMode === "CREATE" && (
                  <div>
                    <label className="block text-xs font-bold text-[#1E3932] mb-1">Harga Awal (IDR Rupiah) *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#5C6F68]">
                        Rp
                      </span>
                      <input
                        type="number"
                        required
                        min={1}
                        step={1}
                        placeholder="Masukkan nominal harga"
                        value={variantForm.price}
                        onChange={(e) => setVariantForm({ ...variantForm, price: e.target.value })}
                        className="w-full pl-9 pr-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs font-mono text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="var_active"
                    checked={variantForm.active}
                    onChange={(e) => setVariantForm({ ...variantForm, active: e.target.checked })}
                    className="rounded border-[#D5D1C7] text-[#00754A] focus:ring-[#00754A]"
                  />
                  <label htmlFor="var_active" className="text-xs font-semibold text-[#1E3932] cursor-pointer">
                    Varian Aktif (Dapat dipesan di storefront)
                  </label>
                </div>

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#E5E2DA]">
                  <button
                    type="button"
                    onClick={() => setVariantModalMode(null)}
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
                    <span>Simpan Varian</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Ubah Harga */}
      <AnimatePresence>
        {priceModalVariant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <motion.div
              variants={modalBackdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setPriceModalVariant(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
              aria-hidden="true"
            />
            <motion.div
              variants={modalDialogVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="relative z-10 bg-white rounded-2xl border border-[#E5E2DA] shadow-xl w-full max-w-sm overflow-hidden font-sans"
            >
              <div className="p-5 border-b border-[#E5E2DA] flex items-center justify-between bg-[#FAF9F7]">
                <div>
                  <h3 className="text-sm font-bold text-[#1E3932]">Ubah Harga Varian</h3>
                  <p className="text-[11px] text-[#5C6F68] font-mono">{priceModalVariant.sku}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPriceModalVariant(null)}
                  className="p-1 rounded-lg text-[#5C6F68] hover:text-[#1E3932] hover:bg-[#EFECE6] cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSavePrice} className="p-5 space-y-4">
                <div className="p-3 rounded-xl bg-[#FAF9F7] border border-[#E5E2DA] space-y-1">
                  <span className="text-[10px] text-[#5C6F68] uppercase font-bold tracking-wider block">
                    Harga Aktif Saat Ini
                  </span>
                  <span className="text-sm font-bold text-[#1E3932]">
                    {priceModalVariant.price
                      ? `Rp ${priceModalVariant.price.amount.toLocaleString("id-ID")}`
                      : "Belum diset"}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E3932] mb-1">
                    Harga Baru (Integer Rupiah) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#5C6F68]">
                      Rp
                    </span>
                    <input
                      type="number"
                      required
                      min={1}
                      step={1}
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs font-mono font-bold text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
                    />
                  </div>
                  <p className="text-[10px] text-[#8A9590] mt-1.5">
                    Harga baru akan menggantikan harga aktif sebelumnya. Seluruh riwayat harga tetap tersimpan untuk audit
                    finansial.
                  </p>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#E5E2DA]">
                  <button
                    type="button"
                    onClick={() => setPriceModalVariant(null)}
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
                    <span>Perbarui Harga</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog (Nonaktifkan Produk / Varian) */}
      <AnimatePresence>
        {confirmDialog.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <motion.div
              variants={modalBackdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
              aria-hidden="true"
            />
            <motion.div
              variants={modalDialogVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="relative z-10 bg-white rounded-2xl border border-[#E5E2DA] shadow-xl w-full max-w-sm overflow-hidden font-sans"
            >
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
