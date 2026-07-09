'use client';

import { useCartStore } from '@/store/cartStore';
import { CupSoda, Heart, Leaf, Milk, Minus, Plus, ShoppingBag, ShoppingCart, Snowflake, ThumbsUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';

interface FlavorData {
  name: string;
  brandColor: string;
  darkBg: string;
  tagline: string;
  description: string;
  prices: { 250: number; 1000: number; };
  ingredients: string[];
  nutrition: { calories: string; protein: string; fat: string; sugar: string; };
  svgGradient: React.ReactNode;
}

const FLAVORS: Record<string, FlavorData> = {
  plain: {
    name: 'Plain Pure Original',
    brandColor: '#cba258',
    darkBg: '#271900',
    tagline: 'Yogurt stirred murni tanpa tambahan gula.',
    description: 'Yogurt stirred murni tanpa tambahan gula dengan tekstur super kental, lembut, dan creamy kualitas homemade terbaik.',
    prices: { 250: 22000, 1000: 65000 },
    ingredients: ['Yogurt kental murni (99,5%)', 'Kultur Bakteri Probiotik Hidup (L. Bulgaricus, S. Thermophilus, L. Acidophilus)'],
    nutrition: { calories: '110kcal', protein: '8.5g', fat: '3.2g', sugar: '0g' },
    svgGradient: (<linearGradient id="detail-grad-plain" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f7ebd3" /><stop offset="50%" stopColor="#cba258" /><stop offset="100%" stopColor="#9a7127" /></linearGradient>)
  },
  stroberi: {
    name: 'Stroberi Summer Blush',
    brandColor: '#D81E5B',
    darkBg: '#3b1c21',
    tagline: 'Paduan rasa stroberi buah segar aromatik.',
    description: 'Paduan rasa stroberi buah segar aromatik dengan yogurt kental premium dan tambahan topping jelly / nata de coco yang kenyal.',
    prices: { 250: 25000, 1000: 75000 },
    ingredients: ['Yogurt kental (86,3%)', 'Gula pasir murni', 'Perisa stroberi buah alami', 'Topping Jelly / Nata de Coco'],
    nutrition: { calories: '120kcal', protein: '8g', fat: '3g', sugar: '12g' },
    svgGradient: (<linearGradient id="detail-grad-stroberi" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ffb3c1" /><stop offset="50%" stopColor="#E85D75" /><stop offset="100%" stopColor="#D81E5B" /></linearGradient>)
  },
  mangga: {
    name: 'Mangga Tropical Gold',
    brandColor: '#F9A03F',
    darkBg: '#3d230d',
    tagline: 'Kombinasi rasa asam manis segar eksotis.',
    description: 'Yogurt lembut stirred premium dengan mangga harum manis masak pohon pilihan. Kaya probiotik hidup.',
    prices: { 250: 28000, 1000: 80000 },
    ingredients: ['Yogurt kental (86,3%)', 'Gula pasir murni', 'Perisa mangga alami', 'Topping Jelly / Nata de Coco'],
    nutrition: { calories: '130kcal', protein: '7.5g', fat: '2.8g', sugar: '14g' },
    svgGradient: (<linearGradient id="detail-grad-mangga" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ffe3b3" /><stop offset="50%" stopColor="#F9A03F" /><stop offset="100%" stopColor="#e07a16" /></linearGradient>)
  },
  melon: {
    name: 'Melon Emerald Fresh',
    brandColor: '#A1C349',
    darkBg: '#232d0f',
    tagline: 'Sensasi kesegaran buah melon premium berair.',
    description: 'Kaya probiotik aktif untuk kesehatan pencernaan maksimal sehari-hari berpadu dengan kesegaran melon.',
    prices: { 250: 25000, 1000: 75000 },
    ingredients: ['Yogurt kental (86,3%)', 'Gula pasir murni', 'Perisa melon alami', 'Topping Jelly / Nata de Coco'],
    nutrition: { calories: '115kcal', protein: '8.2g', fat: '3g', sugar: '10g' },
    svgGradient: (<linearGradient id="detail-grad-melon" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#e2f0b6" /><stop offset="50%" stopColor="#A1C349" /><stop offset="100%" stopColor="#7da226" /></linearGradient>)
  },
  anggur: {
    name: 'Anggur Royal Purple',
    brandColor: '#7A3B69',
    darkBg: '#3B1C33',
    tagline: 'Sensasi rasa anggur merah premium manis eksklusif.',
    description: 'Dipadu dengan stirred yoghurt kental yang lembut, lengkap dengan sensasi mengunyah dari topping jelly.',
    prices: { 250: 28000, 1000: 80000 },
    ingredients: ['Yogurt kental (86,3%)', 'Gula pasir murni', 'Perisa anggur alami', 'Topping Jelly / Nata de Coco'],
    nutrition: { calories: '120kcal', protein: '8g', fat: '3g', sugar: '12g' },
    svgGradient: (<linearGradient id="detail-grad-anggur" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#dfb7d8" /><stop offset="50%" stopColor="#7A3B69" /><stop offset="100%" stopColor="#552246" /></linearGradient>)
  },
  leci: {
    name: 'Leci Sweet Bliss',
    brandColor: '#ff8da1',
    darkBg: '#4a1523',
    tagline: 'Rasa leci manis harum khas yang menyegarkan.',
    description: 'Berpadu dengan kelembutan stirred yoghurt alami. Memberi kesegaran instan bernutrisi.',
    prices: { 250: 25000, 1000: 75000 },
    ingredients: ['Yogurt kental (86,3%)', 'Gula pasir murni', 'Perisa leci alami', 'Topping Jelly / Nata de Coco'],
    nutrition: { calories: '118kcal', protein: '8g', fat: '3g', sugar: '13g' },
    svgGradient: (<linearGradient id="detail-grad-leci" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ffc2cf" /><stop offset="50%" stopColor="#ff8da1" /><stop offset="100%" stopColor="#c75066" /></linearGradient>)
  },
  vanila: {
    name: 'Vanila Velvet Orchid',
    brandColor: '#f3e5AB',
    darkBg: '#3d361c',
    tagline: 'Kehangatan rasa vanila klasik.',
    description: 'Berpadu kentalnya susu fermentasi dari peternakan lokal terbaik. Halus, manis pas, dan menenangkan.',
    prices: { 250: 25000, 1000: 75000 },
    ingredients: ['Yogurt kental (86,3%)', 'Gula pasir murni', 'Perisa vanila alami', 'Topping Jelly / Nata de Coco'],
    nutrition: { calories: '125kcal', protein: '8.2g', fat: '3.5g', sugar: '12g' },
    svgGradient: (<linearGradient id="detail-grad-vanila" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#fdf7db" /><stop offset="50%" stopColor="#f3e5AB" /><stop offset="100%" stopColor="#bba755" /></linearGradient>)
  },
  pisang: {
    name: 'Pisang Ambon Smooth',
    brandColor: '#E8D354',
    darkBg: '#332D10',
    tagline: 'Kentalnya nikmat dengan keharuman pisang ambon.',
    description: 'Yogurt lembut stirred premium dengan sensasi dan wangi pisang ambon alami. 100% gula asli tanpa pemanis buatan.',
    prices: { 250: 25000, 1000: 75000 },
    ingredients: ['Yogurt kental (86,3%)', 'Gula pasir murni', 'Perisa pisang ambon alami', 'Topping Jelly / Nata de Coco'],
    nutrition: { calories: '125kcal', protein: '8g', fat: '3.2g', sugar: '13g' },
    svgGradient: (<linearGradient id="detail-grad-pisang" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#fcf6ce" /><stop offset="50%" stopColor="#E8D354" /><stop offset="100%" stopColor="#a3922c" /></linearGradient>)
  }
};

type FlavorKey = keyof typeof FLAVORS;

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const flavorKey = (id in FLAVORS ? id : 'plain') as FlavorKey;
  const flavor = FLAVORS[flavorKey];

  const [selectedSize, setSelectedSize] = useState<250 | 1000>(250);
  const [quantity, setQuantity] = useState<number>(1);
  const addItem = useCartStore((state) => state.addItem);

  const activePrice = flavor.prices[selectedSize];

  const handleAddToCart = () => {
    addItem({
      id: `${flavorKey}-${selectedSize}`,
      name: `Callme Yoghurt ${flavor.name}`,
      volume_ml: selectedSize,
      quantity: quantity,
      price: activePrice
    });
    alert(`${flavor.name} (${selectedSize}ml) telah ditambahkan ke pesanan!`);
    router.push('/checkout');
  };

  const increaseQty = () => setQuantity(prev => prev + 1);
  const decreaseQty = () => setQuantity(prev => (prev > 1 ? prev - 1 : 1));

  return (
    <div className="bg-[#f2f0eb] text-black/87 tracking-[-0.01em] min-h-screen font-sans antialiased overflow-x-hidden">

      <nav className="fixed top-0 w-full z-50 bg-[#f2f0eb]/90 backdrop-blur-md shadow-sm h-20 flex items-center border-b border-black/5">
        <div className="flex justify-between items-center px-6 w-full max-w-7xl mx-auto">
          <Link href="/" className="font-extrabold text-xl text-[#00754A] tracking-tight">
            Callme Yoghurt
          </Link>
          <div className="hidden md:flex gap-8">
            <Link className="font-medium text-black/58 hover:text-[#00754A] transition-colors" href="/">Katalog</Link>
            <Link className="font-medium text-black/58 hover:text-[#00754A] transition-colors" href="/#kisah">Kisah Kami</Link>
          </div>
          <Link href="/checkout">
            <button className="px-6 py-2.5 bg-[#00754A] text-white rounded-[50px] font-semibold text-sm hover:scale-95 transition-transform duration-200">
              Keranjang
            </button>
          </Link>
        </div>
      </nav>

      <main className="pt-20">
        <header className="py-16 md:py-20 transition-colors duration-300" style={{ backgroundColor: flavor.darkBg }}>
          <div className="max-w-7xl mx-auto px-6">
            <nav className="mb-6">
              <ol className="flex list-none p-0 text-white/70 font-semibold text-xs gap-2 tracking-wider uppercase">
                <li><Link className="hover:text-white transition-colors" href="/">Menu</Link></li>
                <li>/</li>
                <li className="text-white font-bold">{flavorKey}</li>
              </ol>
            </nav>
            <span className="text-white/60 font-bold tracking-widest text-xs uppercase mb-2 block">Kentalnya Nikmat</span>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-[-0.02em]">{flavor.name}</h1>
            <p className="text-white/80 text-lg md:text-xl max-w-2xl leading-relaxed">{flavor.tagline}</p>
          </div>
        </header>

        <section className="max-w-7xl mx-auto px-6 -mt-10 pb-24 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            <div className="lg:col-span-5 bg-white rounded-[16px] shadow-[0_0_0.5px_rgba(0,0,0,0.14),_0_1px_1px_rgba(0,0,0,0.24)] overflow-hidden p-8 flex flex-col items-center justify-center border border-black/5 min-h-[500px] relative">
              <div className="absolute top-6 left-6 flex flex-col gap-2">
                <span className="text-white font-bold text-xs px-4 py-1.5 rounded-full shadow-sm tracking-wide" style={{ backgroundColor: flavor.brandColor }}>
                  Premium Varian
                </span>
                <span className="bg-[#1E3932] text-white font-bold text-[10px] px-3 py-1 rounded-full shadow-sm tracking-wider uppercase">
                  Homemade Quality
                </span>
              </div>
              <div className="relative w-full aspect-[4/5] bg-gray-50 rounded-2xl flex flex-col items-center justify-center p-8 transition-transform duration-500 hover:scale-[1.02]">
                <svg viewBox="0 0 100 120" className={`drop-shadow-2xl transition-all duration-500 ${selectedSize === 1000 ? 'w-64 h-64' : 'w-48 h-48'}`} fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    {flavor.svgGradient}
                    <linearGradient id="detail-bottle-glass" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#e4e2e0" stopOpacity="0.4" />
                    </linearGradient>
                  </defs>
                  <rect x="42" y="10" width="16" height="8" rx="3" fill="#1E3932" />
                  <path d="M44 18H56V28H44V18Z" fill="#e4e2e0" />
                  <path d="M30 36C30 31 34 28 40 28H60C66 28 70 31 70 36V102C70 107 66 110 60 110H40C34 110 30 107 30 102V36Z" fill="url(#detail-bottle-glass)" stroke={flavor.brandColor} strokeWidth="2" />
                  <path d="M32 44C32 44 38 41 50 41C62 41 68 44 68 44V100C68 104 65 107 58 107H42C35 107 32 104 32 100V44Z" fill={`url(#detail-grad-${flavorKey})`} opacity="0.9" />
                  <rect x="36" y="52" width="28" height="36" rx="4" fill="#ffffff" />
                  <text x="50" y="66" fontSize="5" fontWeight="900" fill="#1E3932" textAnchor="middle">CALLME</text>
                  <text x="50" y="73" fontSize="4.5" fontWeight="700" style={{ fill: flavor.brandColor }} textAnchor="middle">{flavorKey.toUpperCase()}</text>
                  <text x="50" y="80" fontSize="3.5" fill="rgba(0,0,0,0.58)" textAnchor="middle">{selectedSize} ml</text>
                </svg>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className="bg-white p-6 md:p-8 rounded-[16px] shadow-[0_0_0.5px_rgba(0,0,0,0.14),_0_1px_1px_rgba(0,0,0,0.24)] space-y-5">
                <h3 className="font-bold text-sm uppercase tracking-wider text-black/58">Pilih Ukuran</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setSelectedSize(250)} className="flex flex-col items-center gap-3 p-5 rounded-[12px] border-2 transition-all active:scale-[0.98]" style={{ borderColor: selectedSize === 250 ? flavor.brandColor : '#e5e7eb', backgroundColor: selectedSize === 250 ? `${flavor.brandColor}08` : 'transparent' }}>
                    <CupSoda size={40} color={selectedSize === 250 ? flavor.brandColor : '#9ca3af'} strokeWidth={1.5} />
                    <span className="font-bold text-base text-black/87">250 ml</span>
                    <span className="font-semibold text-sm text-black/58">Rp {flavor.prices[250].toLocaleString('id-ID')}</span>
                  </button>
                  <button onClick={() => setSelectedSize(1000)} className="flex flex-col items-center gap-3 p-5 rounded-[12px] border-2 transition-all active:scale-[0.98]" style={{ borderColor: selectedSize === 1000 ? flavor.brandColor : '#e5e7eb', backgroundColor: selectedSize === 1000 ? `${flavor.brandColor}08` : 'transparent' }}>
                    <Milk size={40} color={selectedSize === 1000 ? flavor.brandColor : '#9ca3af'} strokeWidth={1.5} />
                    <span className="font-bold text-base text-black/87">1 Liter</span>
                    <span className="font-semibold text-sm text-black/58">Rp {flavor.prices[1000].toLocaleString('id-ID')}</span>
                  </button>
                </div>
              </div>

              <div className="bg-white p-6 md:p-8 rounded-[16px] shadow-[0_0_0.5px_rgba(0,0,0,0.14),_0_1px_1px_rgba(0,0,0,0.24)] space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 border border-gray-200 rounded-[50px] px-2 py-2">
                    <button onClick={decreaseQty} className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 active:scale-90 transition-transform">
                      <Minus size={18} className="text-black/87" />
                    </button>
                    <span className="font-bold text-lg w-6 text-center text-black/87">{quantity}</span>
                    <button onClick={increaseQty} className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 active:scale-90 transition-transform">
                      <Plus size={18} className="text-black/87" />
                    </button>
                  </div>
                  <div className="text-right">
                    <span className="block text-sm text-black/58 font-medium mb-1">Total Harga</span>
                    <span className="text-3xl font-extrabold" style={{ color: flavor.brandColor }}>
                      Rp {((activePrice * quantity) / 1000).toFixed(0)}k
                    </span>
                  </div>
                </div>
                <button onClick={handleAddToCart} className="w-full text-white py-4 rounded-[50px] font-bold text-base transition-transform active:scale-95 flex items-center justify-center gap-3 hover:opacity-90 shadow-lg" style={{ backgroundColor: flavor.brandColor }}>
                  <ShoppingCart size={20} /> Tambahkan ke Pesanan
                </button>
              </div>

              <div className="bg-white rounded-[16px] shadow-[0_0_0.5px_rgba(0,0,0,0.14),_0_1px_1px_rgba(0,0,0,0.24)] overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2">
                  <div className="p-6 md:p-8 border-b md:border-b-0 md:border-r border-gray-100">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-[#00754A] mb-5">Komposisi</h4>
                    <ul className="space-y-4">
                      {flavor.ingredients.map((ing, idx) => (
                        <li key={idx} className="text-sm font-medium text-black/70 flex items-start gap-3">
                          <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: flavor.brandColor }}></span>{ing}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-6 md:p-8">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-[#00754A] mb-5">Informasi Nilai Gizi</h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-sm border-b border-gray-100 pb-3">
                        <span className="text-black/70 font-medium">Kalori</span><span className="font-bold text-black/87">{flavor.nutrition.calories}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-b border-gray-100 pb-3">
                        <span className="text-black/70 font-medium">Protein</span><span className="font-bold text-black/87">{flavor.nutrition.protein}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-b border-gray-100 pb-3">
                        <span className="text-black/70 font-medium">Lemak</span><span className="font-bold text-black/87">{flavor.nutrition.fat}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-black/70 font-medium">Gula</span><span className="font-bold text-black/87">{flavor.nutrition.sugar}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#f2f0eb] border border-[#e5e7eb] p-6 rounded-[16px] flex items-start gap-4 mt-2">
                <div className="mt-1">
                  <Snowflake size={24} className="text-[#00754A]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-black/87 mb-2">Instruksi Penyimpanan</h4>
                  <ul className="text-sm text-black/70 list-disc list-inside space-y-1.5">
                    <li>Hanya tahan <strong>3 hari</strong> di suhu ruang.</li>
                    <li>Tahan <strong>2 bulan</strong> di dalam kulkas (suhu {'<'} 5°C).</li>
                    <li>Segera masukkan ke kulkas begitu pesanan diterima.</li>
                  </ul>
                </div>
              </div>

            </div>
          </div>
        </section>

        <section className="bg-[#1E3932] text-white py-20 mt-10">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-2">
                  <Leaf size={32} className="text-white" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">100% Organik</h3>
                <p className="text-base text-white/70 leading-relaxed max-w-xs">Susu sapi organik segar yang diproses secara higienis setiap harinya.</p>
              </div>
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-2">
                  <Heart size={32} className="text-white" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">Tanpa Pengawet</h3>
                <p className="text-base text-white/70 leading-relaxed max-w-xs">Menjamin kesegaran probiotik hidup tanpa bahan kimia buatan.</p>
              </div>
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-2">
                  <ThumbsUp size={32} className="text-white" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">Rasa Premium</h3>
                <p className="text-base text-white/70 leading-relaxed max-w-xs">Ekstrak buah murni memberikan sensasi rasa mewah sekelas kafe.</p>
              </div>
            </div>
          </div>
        </section>

      </main>

      <footer className="bg-[#1E3932] text-white">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-8">
            <div className="md:col-span-4 lg:col-span-5 space-y-4">
              <span className="text-2xl font-extrabold text-white block tracking-tight">Callme Yoghurt Cipayung</span>
              <p className="text-sm text-white/70 leading-relaxed mb-2">
                Bambu Kuning Residence Blok A No.3A RT.11/RW 01,<br />Bambu Apus, Cipayung, Jakarta Timur, 13890.
              </p>
              <div className="text-sm font-bold text-white mt-4 space-y-1">
                <p>WA: 081316353365</p>
                <p>Email: yoghurtcallme@gmail.com</p>
              </div>
            </div>

            <div className="md:col-span-8 lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
              <div className="flex flex-col gap-4">
                <span className="font-bold text-white uppercase text-xs tracking-widest opacity-60">Socials</span>
                <a className="text-sm font-medium text-white/80 hover:text-white transition-colors" href="#">Instagram</a>
                <a className="text-sm font-medium text-white/80 hover:text-white transition-colors" href="#">Facebook</a>
              </div>
              <div className="flex flex-col gap-4">
                <span className="font-bold text-white uppercase text-xs tracking-widest opacity-60">Legal</span>
                <a className="text-sm font-medium text-white/80 hover:text-white transition-colors" href="#">Privacy Policy</a>
                <a className="text-sm font-medium text-white/80 hover:text-white transition-colors" href="#">Terms of Service</a>
              </div>
              <div className="flex flex-col gap-4">
                <span className="font-bold text-white uppercase text-xs tracking-widest opacity-60">Help</span>
                <a className="text-sm font-medium text-white/80 hover:text-white transition-colors" href="#">Contact Us</a>
                <a className="text-sm font-medium text-white/80 hover:text-white transition-colors" href="#">FAQ</a>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 bg-black/20">
          <div className="max-w-7xl mx-auto px-6 py-6 text-center md:text-left text-xs font-medium text-white/40">
            <p>© 2026 Callme Yoghurt. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <div className="fixed bottom-8 right-8 z-50">
        <Link
          href="/checkout"
          className="flex items-center justify-center bg-[#00754A] hover:bg-[#006241] text-white rounded-full w-14 h-14 shadow-[0_0_6px_rgba(0,0,0,0.24),_0_8px_12px_rgba(0,0,0,0.14)] hover:scale-110 active:scale-95 transition-all duration-200"
        >
          <ShoppingBag size={24} />
        </Link>
      </div>

    </div>
  );
}