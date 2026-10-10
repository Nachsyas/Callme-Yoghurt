"use client";

import React, { useState } from "react";
import { CheckCircle2, Lock, Search, Shield, ShieldCheck, Users } from "lucide-react";

interface CustomerRecord {
  id: string;
  maskedName: string;
  maskedPhone: string;
  city: string;
  totalOrders: number;
  totalSpent: number;
  lastActive: string;
  status: "VERIFIED" | "ACTIVE";
}

const CUSTOMERS_DATA: CustomerRecord[] = [
  {
    id: "cust-01",
    maskedName: "Budi S****",
    maskedPhone: "62812****4321",
    city: "Jakarta Timur",
    totalOrders: 6,
    totalSpent: 420000,
    lastActive: "10 menit lalu",
    status: "VERIFIED",
  },
  {
    id: "cust-02",
    maskedName: "Siti A****",
    maskedPhone: "62813****8765",
    city: "Jakarta Selatan",
    totalOrders: 4,
    totalSpent: 240000,
    lastActive: "28 menit lalu",
    status: "VERIFIED",
  },
  {
    id: "cust-03",
    maskedName: "Hendro W****",
    maskedPhone: "62857****1122",
    city: "Bekasi Barat",
    totalOrders: 3,
    totalSpent: 135000,
    lastActive: "1 jam lalu",
    status: "VERIFIED",
  },
  {
    id: "cust-04",
    maskedName: "Dewi L****",
    maskedPhone: "62878****9988",
    city: "Depok",
    totalOrders: 5,
    totalSpent: 275000,
    lastActive: "2 jam lalu",
    status: "VERIFIED",
  },
  {
    id: "cust-05",
    maskedName: "Rian K****",
    maskedPhone: "62811****5544",
    city: "Jakarta Pusat",
    totalOrders: 2,
    totalSpent: 180000,
    lastActive: "3 jam lalu",
    status: "VERIFIED",
  },
];

export default function AdminCustomersPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCustomers = CUSTOMERS_DATA.filter((c) => {
    return (
      c.maskedName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.maskedPhone.includes(searchQuery)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#1E3932]">
            Data Pelanggan & Privasi (Zero-Trust)
          </h2>
          <p className="text-xs text-[#5C6F68] mt-0.5">
            Perlindungan data pribadi konsumen terenkripsi AES-256 dan terindeks blind index HMAC-SHA256
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#E8F5E9] text-[#1E3932] border border-[#C8E6C9] text-xs font-semibold">
            <ShieldCheck size={13} className="text-[#00754A]" />
            <span>Kepatuhan UU PDP Aktif</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FAF9F7] text-[#5C6F68] border border-[#E5E2DA] text-xs font-mono">
            Enkripsi: AES-256-GCM
          </span>
        </div>
      </div>

      {/* Zero-Trust PII Notice Banner */}
      <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E5E2DA] flex items-start gap-3">
        <Lock size={18} className="text-[#00754A] flex-shrink-0 mt-0.5" />
        <div className="text-xs text-[#5C6F68] leading-relaxed">
          <span className="font-bold text-[#1E3932] block mb-0.5">
            Arsitektur Privasi Tanpa Kompromi:
          </span>
          Nomor telepon dan identitas pribadi tidak disimpan dalam teks polos di database PostgreSQL ERP Core. Sistem menggunakan enkripsi simetris dengan blind index deterministik (HMAC-SHA256) untuk verifikasi tanpa membocorkan data asli.
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A9590]" />
          <input
            type="text"
            placeholder="Cari inisial nama atau kota..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-xs text-[#1E3932] placeholder-[#8A9590] focus:outline-none focus:ring-2 focus:ring-[#00754A]"
          />
        </div>

        <span className="text-xs font-semibold text-[#5C6F68]">
          Menampilkan {filteredCustomers.length} Pelanggan Terverifikasi
        </span>
      </div>

      {/* Customers Table (Desktop & Tablet) */}
      <div className="bg-white rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1E3932]">
            <thead className="bg-[#FAF9F7] text-[#5C6F68] font-bold uppercase text-[10px] tracking-wider border-b border-[#E5E2DA]">
              <tr>
                <th className="px-4 py-3">Nama (Masked)</th>
                <th className="px-4 py-3">Kontak Terproteksi</th>
                <th className="px-4 py-3">Wilayah Pengiriman</th>
                <th className="px-4 py-3 text-center">Total Pesanan</th>
                <th className="px-4 py-3">Akumulasi Belanja</th>
                <th className="px-4 py-3">Aktivitas Terakhir</th>
                <th className="px-4 py-3">Status Privasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E2DA]">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#5C6F68]">
                    Belum ada data pelanggan yang cocok dengan pencarian.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-[#FDFCFB] transition-colors">
                    <td className="px-4 py-3 font-semibold text-[#1E3932]">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#E8F5E9] border border-[#C8E6C9] flex items-center justify-center text-[#1E3932] font-bold text-xs">
                          {customer.maskedName.charAt(0)}
                        </div>
                        <span>{customer.maskedName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[#5C6F68]">
                      {customer.maskedPhone}
                    </td>
                    <td className="px-4 py-3 text-[#1E3932]">
                      {customer.city}
                    </td>
                    <td className="px-4 py-3 text-center font-bold font-mono">
                      {customer.totalOrders} order
                    </td>
                    <td className="px-4 py-3 font-bold text-[#1E3932]">
                      Rp {customer.totalSpent.toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3 text-[#5C6F68] text-[11px]">
                      {customer.lastActive}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F5E9] text-[#1E3932] border border-[#C8E6C9]">
                        <Shield size={10} className="text-[#00754A]" />
                        <span>{customer.status}</span>
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
          {filteredCustomers.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#5C6F68]">
              Belum ada data pelanggan yang cocok dengan pencarian.
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <div key={customer.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#1E3932]">
                    {customer.maskedName}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F5E9] text-[#1E3932] border border-[#C8E6C9]">
                    <Shield size={10} className="text-[#00754A]" />
                    <span>{customer.status}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#5C6F68]">
                  <span className="font-mono">{customer.maskedPhone}</span>
                  <span>{customer.city}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-[#E5E2DA]/60 text-xs">
                  <span className="text-[11px] text-[#5C6F68]">
                    {customer.totalOrders} pesanan • {customer.lastActive}
                  </span>
                  <span className="font-bold text-[#1E3932]">
                    Rp {customer.totalSpent.toLocaleString("id-ID")}
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
