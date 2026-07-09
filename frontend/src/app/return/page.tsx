'use client';

import { ArrowRight, CheckCircle2, Package } from "lucide-react";
import Link from "next/link";

export default function ReturnPage() {
  return (
    <div className="min-h-screen bg-[#f2f0eb] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-8 md:p-10 rounded-[24px] shadow-[0_0_0.5px_rgba(0,0,0,0.14),_0_1px_1px_rgba(0,0,0,0.24)] text-center relative overflow-hidden">

        <div className="absolute top-0 left-0 w-full h-2 bg-[#00754A]"></div>

        <div className="w-20 h-20 bg-[#00754A]/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={40} className="text-[#00754A]" />
        </div>

        <h1 className="text-2xl md:text-3xl font-extrabold text-black/87 tracking-tight mb-3">
          Pesanan Berhasil!
        </h1>

        <p className="text-black/58 text-sm md:text-base leading-relaxed mb-8">
          Terima kasih telah berbelanja di Callme Yoghurt. Tim kami sedang memproses pesananmu dan akan segera menghubungi nomor WhatsApp yang terdaftar untuk konfirmasi pengiriman.
        </p>

        <div className="bg-gray-50 rounded-[12px] p-5 flex items-start gap-4 mb-8 text-left border border-gray-100">
          <Package className="text-[#00754A] flex-shrink-0 mt-0.5" />
          <div>
            <span className="block font-bold text-sm text-black/87 mb-1">Status Pengiriman</span>
            <span className="block text-xs text-black/58 leading-relaxed">Menunggu konfirmasi admin. Suhu yoghurt dipastikan <span className="font-bold">di bawah 5°C</span> saat tiba.</span>
          </div>
        </div>

        <Link
          href="/"
          className="w-full flex items-center justify-center gap-2 bg-[#1E3932] text-white py-4 rounded-[50px] font-bold transition-transform active:scale-95 hover:bg-black"
        >
          Kembali ke Beranda
          <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}