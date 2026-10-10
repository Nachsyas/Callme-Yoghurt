import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#F2F0EB] flex items-center justify-center p-6 text-center font-sans">
      <div className="max-w-md w-full bg-white p-8 sm:p-10 rounded-2xl shadow-sm border border-[#E5E2DA]">
        <div className="w-16 h-16 bg-[#1E3932]/10 text-[#1E3932] rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl font-bold text-[#1E3932]">404</span>
        </div>
        <span className="inline-block px-3 py-1 bg-[#1E3932]/10 text-[#1E3932] text-xs font-bold rounded-full mb-3 tracking-wider uppercase">
          404 — Not Found
        </span>
        <h1 className="text-2xl font-black text-[#1E3932] mb-2">
          Produk tidak ditemukan
        </h1>
        <p className="text-sm text-[#5C6F68] mb-6 leading-relaxed">
          Varian yoghurt yang Anda cari tidak tersedia dalam katalog resmi Callme Yoghurt atau telah dinonaktifkan.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center w-full px-6 py-3 bg-[#1E3932] text-white font-bold rounded-xl hover:bg-[#152722] transition-colors shadow-sm"
        >
          Kembali ke Katalog
        </Link>
      </div>
    </main>
  );
}
