"use client";

import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  Radio,
  ShieldAlert,
  Snowflake,
  Thermometer,
} from "lucide-react";

export default function AdminColdChainPage() {
  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#1E3932]">
            Monitoring Kepatuhan Cold Chain
          </h2>
          <p className="text-xs text-[#5C6F68] mt-0.5">
            Standar integritas temperatur produk (&lt; 5.0°C) dan manajemen kualitas stirred yogurt
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold">
            <Radio size={13} className="text-amber-600 animate-pulse" />
            <span>Mode Inspeksi: Manual</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FAF9F7] text-[#5C6F68] border border-[#E5E2DA] text-xs font-mono">
            SOP-01 &amp; SOP-07
          </span>
        </div>
      </div>

      {/* TRUTHFUL SENSOR STATUS BANNER (Mandatory Rule) */}
      <div className="bg-white p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 flex-shrink-0 mt-0.5">
            <AlertTriangle size={18} />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-[#1E3932]">
              Belum ada sumber data sensor cold-chain yang terhubung.
            </h3>
            <p className="text-xs text-[#5C6F68] leading-relaxed">
              Integrasi probe IoT / sensor suhu nirkabel sedang dalam tahap persiapan modul gateway. Untuk mencegah kesalahan operasional, sistem <strong>tidak menampilkan simulasi suhu palsu</strong>. Seluruh verifikasi suhu saat ini mengacu pada formulir pencatatan fisik manual di cold-hub sesuai SOP-01 dan SOP-07.
            </p>
          </div>
        </div>
      </div>

      {/* PLANNED SENSOR ZONES (Explicitly marked as unavailable / offline) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Hub WH-COLD-JKT-01 */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-3">
          <div className="flex items-center justify-between border-b border-[#E5E2DA] pb-2.5">
            <span className="font-bold text-xs text-[#1E3932]">WH-COLD-JKT-01</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FAF9F7] text-[#5C6F68] border border-[#E5E2DA]">
              Sensor Offline
            </span>
          </div>
          <div>
            <span className="text-[11px] text-[#5C6F68] block">Cold Room Utama Jakarta</span>
            <span className="text-xl font-mono font-bold text-[#8A9590] mt-1 block">
              --.- °C
            </span>
          </div>
          <div className="pt-2 border-t border-[#E5E2DA] text-[10px] text-[#5C6F68]">
            Status: Menunggu pemasangan probe hardware
          </div>
        </div>

        {/* Buffer Cold Room */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-3">
          <div className="flex items-center justify-between border-b border-[#E5E2DA] pb-2.5">
            <span className="font-bold text-xs text-[#1E3932]">Freezer Room B</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FAF9F7] text-[#5C6F68] border border-[#E5E2DA]">
              Sensor Offline
            </span>
          </div>
          <div>
            <span className="text-[11px] text-[#5C6F68] block">Transit Staging Area</span>
            <span className="text-xl font-mono font-bold text-[#8A9590] mt-1 block">
              --.- °C
            </span>
          </div>
          <div className="pt-2 border-t border-[#E5E2DA] text-[10px] text-[#5C6F68]">
            Status: Menunggu pemasangan probe hardware
          </div>
        </div>

        {/* Dispatch Pre-pack Station */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-3">
          <div className="flex items-center justify-between border-b border-[#E5E2DA] pb-2.5">
            <span className="font-bold text-xs text-[#1E3932]">Dispatch Packaging</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FAF9F7] text-[#5C6F68] border border-[#E5E2DA]">
              Sensor Offline
            </span>
          </div>
          <div>
            <span className="text-[11px] text-[#5C6F68] block">Meja Kemas Cooler Bag</span>
            <span className="text-xl font-mono font-bold text-[#8A9590] mt-1 block">
              --.- °C
            </span>
          </div>
          <div className="pt-2 border-t border-[#E5E2DA] text-[10px] text-[#5C6F68]">
            Status: Menunggu pemasangan probe hardware
          </div>
        </div>
      </div>

      {/* OPERATIONAL PROTOCOLS & THRESHOLDS (SOP-01 & SOP-07) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Temperature Threshold Boundaries */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
          <div className="flex items-center gap-2 border-b border-[#E5E2DA] pb-3">
            <Thermometer size={18} className="text-[#00754A]" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#1E3932]">
              Standar Batas Temperatur (Cold Chain SOP)
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-[#F7FBF8] border border-[#C8E6C9] flex items-center justify-between">
              <div>
                <span className="font-bold text-[#1E3932] block">Rentang Optimal (Nominal)</span>
                <span className="text-[11px] text-[#5C6F68]">Kondisi ideal penyimpanan susu stirred</span>
              </div>
              <span className="font-mono font-bold text-[#00754A] text-sm">0.0°C – 4.0°C</span>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-amber-900 block">Ambang Peringatan (Warning)</span>
                <span className="text-[11px] text-amber-800">Wajib periksa chiller dan kompresor</span>
              </div>
              <span className="font-mono font-bold text-amber-900 text-sm">4.1°C – 5.0°C</span>
            </div>

            <div className="p-3 rounded-lg bg-[#FFEBEE] border border-[#FFCDD2] flex items-center justify-between">
              <div>
                <span className="font-bold text-[#C62828] block">Pelanggaran Kritis (Breach)</span>
                <span className="text-[11px] text-[#C62828]">Karantina lot &amp; larangan pengiriman</span>
              </div>
              <span className="font-mono font-bold text-[#C62828] text-sm">&gt; 5.0°C</span>
            </div>
          </div>
        </div>

        {/* Right: Courier Delivery Packaging Rules */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
          <div className="flex items-center gap-2 border-b border-[#E5E2DA] pb-3">
            <Snowflake size={18} className="text-[#00754A]" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#1E3932]">
              Protokol Pengemasan Dingin Kurir
            </h3>
          </div>

          <div className="space-y-3 text-xs leading-relaxed text-[#1E3932]">
            <div className="p-3 rounded-lg bg-[#FAF9F7] border border-[#E5E2DA]">
              <span className="font-bold block mb-1">1. Kurir Instant (&lt; 10 km):</span>
              <p className="text-[11px] text-[#5C6F68]">
                Wajib menggunakan <em>Insulated Cooler Bag</em> tertutup rapat dengan minimal 1 buah <em>Ice Gel Pack</em> beku suhu &le; -10°C.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-[#FAF9F7] border border-[#E5E2DA]">
              <span className="font-bold block mb-1">2. Kurir Sameday / Luar Jakarta (&gt; 10 km):</span>
              <p className="text-[11px] text-[#5C6F68]">
                Wajib menggunakan <em>Styrofoam Cold Box</em> berketebalan minimal 2 cm dengan minimal 2 buah <em>Ice Gel Pack</em> beku ganda.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-[#FAF9F7] border border-[#E5E2DA]">
              <span className="font-bold block mb-1">3. Verifikasi Suhu Saat Serah Terima:</span>
              <p className="text-[11px] text-[#5C6F68]">
                Petugas wajib menolak serah terima paket apabila suhu permukaan botol teraba hangat saat dikeluarkan dari lemari pendingin.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
