'use client';

import { useCartStore } from '@/store/cartStore';
import { CupSoda, Heart, Leaf, Milk, Minus, Plus, ShoppingBag, ShoppingCart, Snowflake, ThumbsUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { parseNetContentMl, type PublicCatalogData, type PublicCatalogProduct, type PublicCatalogVariant } from '@/lib/catalog';

interface FlavorData {
  name: string;
  brandColor: string;
  darkBg: string;
  tagline: string;
  description: string;
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
    ingredients: ['Yogurt kental (86,3%)', 'Gula pasir murni', 'Perisa pisang ambon alami', 'Topping Jelly / Nata de Coco'],
    nutrition: { calories: '125kcal', protein: '8g', fat: '3.2g', sugar: '13g' },
    svgGradient: (<linearGradient id="detail-grad-pisang" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#fcf6ce" /><stop offset="50%" stopColor="#E8D354" /><stop offset="100%" stopColor="#a3922c" /></linearGradient>)
  }
};

type FlavorKey = keyof typeof FLAVORS;

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  // Separate visual theme presentation from authoritative transactional identity
  const requestedSlug = id.trim().toLowerCase();
  const visualFlavorKey = (requestedSlug in FLAVORS ? requestedSlug : 'plain') as FlavorKey;
  const flavor = FLAVORS[visualFlavorKey];

  const [selectedSize, setSelectedSize] = useState<250 | 1000>(250);
  const [quantity, setQuantity] = useState<number>(1);
  const [catalogLoading, setCatalogLoading] = useState<boolean>(true);
  const [erpProduct, setErpProduct] = useState<PublicCatalogProduct | null>(null);

  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
    let isMounted = true;
    async function loadCatalog() {
      try {
        const res = await fetch('/api/catalog');
        if (!res.ok) {
          if (isMounted) setCatalogLoading(false);
          return;
        }
        const data: PublicCatalogData = await res.json();
        if (isMounted) {
          // Authoritative catalog matching MUST use requestedSlug, NOT any visual fallback
          const matched = data.products?.find(
            (p: PublicCatalogProduct) => p.slug.toLowerCase() === requestedSlug
          );
          setErpProduct(matched || null);
          setCatalogLoading(false);
        }
      } catch {
        if (isMounted) setCatalogLoading(false);
      }
    }
    loadCatalog();
    return () => { isMounted = false; };
  }, [requestedSlug]);

  // Authoritative variant matching strictly by normalized net content (ml) without SKU guessing
  const variant250 = erpProduct?.variants.find((v: PublicCatalogVariant) => {
    const ml = parseNetContentMl(v.net_content?.quantity, v.net_content?.uom);
    return ml === 250;
  });

  const variant1000 = erpProduct?.variants.find((v: PublicCatalogVariant) => {
    const ml = parseNetContentMl(v.net_content?.quantity, v.net_content?.uom);
    return ml === 1000;
  });

  const selectedVariant = selectedSize === 250 ? variant250 : variant1000;
  const isAvailable = Boolean(selectedVariant);
  const displayPrice = selectedVariant?.price.amount ?? null;

  const handleAddToCart = () => {
    if (!selectedVariant) return;

    addItem({
      variant_id: selectedVariant.variant_id, // Authoritative UUID from ERP
      sku: selectedVariant.sku,
      name: selectedVariant.name,
      volume_ml: selectedSize,
      quantity: quantity,
      display_price: selectedVariant.price.amount, // Presentation only
    });
    alert(`${selectedVariant.name} (${selectedSize}ml) telah ditambahkan ke pesanan!`);
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
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 backdrop-blur-sm text-white/90 text-xs font-semibold mb-6 border border-white/10">
                <Leaf size={14} className="text-[#a8e6cf]" />
                100% Susu Murni & Buah Alami
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-[-0.02em]">{flavor.name}</h1>
              <p className="text-white/80 text-lg md:text-xl max-w-2xl leading-relaxed">{flavor.tagline}</p>
            </div>

            <div className="flex justify-center">
              <div className="relative w-64 h-80 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full blur-3xl opacity-30" style={{ backgroundColor: flavor.brandColor }}></div>
                <div className="relative z-10 flex flex-col items-center">
                  <div className="absolute -top-4 z-20">
                    <span className="text-white font-bold text-xs px-4 py-1.5 rounded-full shadow-sm tracking-wide" style={{ backgroundColor: flavor.brandColor }}>
                      {selectedSize}ml
                    </span>
                  </div>
                  <svg className="w-44 h-72 drop-shadow-2xl hover:scale-105 transition-transform duration-500" viewBox="0 0 100 160">
                    <defs>
                      <linearGradient id="detail-bottle-glass" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
                        <stop offset="30%" stopColor="#ffffff" stopOpacity="0.1" />
                        <stop offset="70%" stopColor="#ffffff" stopOpacity="0.05" />
                        <stop offset="100%" stopColor="#000000" stopOpacity="0.2" />
                      </linearGradient>
                      {flavor.svgGradient}
                    </defs>
                    <path d="M42 8H58V16H42Z" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1" />
                    <path d="M40 16H60V28H40Z" fill="#ffffff" />
                    <path d="M30 36C30 31 34 28 40 28H60C66 28 70 31 70 36V102C70 107 66 110 60 110H40C34 110 30 107 30 102V36Z" fill={`url(#detail-grad-${visualFlavorKey})`} />
                    <path d="M30 36C30 31 34 28 40 28H60C66 28 70 31 70 36V102C70 107 66 110 60 110H40C34 110 30 107 30 102V36Z" fill="url(#detail-bottle-glass)" stroke={flavor.brandColor} strokeWidth="2" />
                    <rect x="36" y="55" width="28" height="42" rx="4" fill="#ffffff" opacity="0.95" />
                    <text x="50" y="65" fontSize="4.5" fontWeight="800" fill="#00754A" textAnchor="middle">CALLME</text>
                    <text x="50" y="73" fontSize="4.5" fontWeight="700" style={{ fill: flavor.brandColor }} textAnchor="middle">{visualFlavorKey.toUpperCase()}</text>
                    <text x="50" y="80" fontSize="3" fontWeight="500" fill="#6b7280" textAnchor="middle">YOGHURT</text>
                    <text x="50" y="88" fontSize="2.5" fontWeight="400" fill="#9ca3af" textAnchor="middle">{selectedSize} ML</text>
                    <path d="M34 40L34 100" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-12">
              <div className="bg-white rounded-2xl p-8 border border-black/5 shadow-sm">
                <h2 className="text-xl font-bold mb-4">Pilih Ukuran</h2>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setSelectedSize(250)}
                    disabled={!variant250}
                    className={`p-6 rounded-xl border-2 text-left transition-all ${
                      selectedSize === 250 && variant250 ? 'shadow-md' : 'opacity-70'
                    } ${!variant250 ? 'opacity-40 cursor-not-allowed' : ''}`}
                    style={{
                      borderColor: selectedSize === 250 && variant250 ? flavor.brandColor : '#e5e7eb',
                      backgroundColor: selectedSize === 250 && variant250 ? `${flavor.brandColor}08` : 'transparent',
                    }}
                  >
                    <CupSoda size={40} color={selectedSize === 250 && variant250 ? flavor.brandColor : '#9ca3af'} strokeWidth={1.5} />
                    <div className="font-bold text-lg text-black/87 mt-3">Ukuran Personal (250ml)</div>
                    <div className="text-sm text-black/58 mt-1">
                      {variant250 ? `Rp ${variant250.price.amount.toLocaleString('id-ID')}` : 'Stok Belum Tersedia'}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSize(1000)}
                    disabled={!variant1000}
                    className={`p-6 rounded-xl border-2 text-left transition-all ${
                      selectedSize === 1000 && variant1000 ? 'shadow-md' : 'opacity-70'
                    } ${!variant1000 ? 'opacity-40 cursor-not-allowed' : ''}`}
                    style={{
                      borderColor: selectedSize === 1000 && variant1000 ? flavor.brandColor : '#e5e7eb',
                      backgroundColor: selectedSize === 1000 && variant1000 ? `${flavor.brandColor}08` : 'transparent',
                    }}
                  >
                    <Milk size={40} color={selectedSize === 1000 && variant1000 ? flavor.brandColor : '#9ca3af'} strokeWidth={1.5} />
                    <div className="font-bold text-lg text-black/87 mt-3">Ukuran Keluarga (1 Liter)</div>
                    <div className="text-sm text-black/58 mt-1">
                      {variant1000 ? `Rp ${variant1000.price.amount.toLocaleString('id-ID')}` : 'Stok Belum Tersedia'}
                    </div>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-8 border border-black/5 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-black/5">
                  <div>
                    <div className="text-sm font-semibold text-black/58 uppercase tracking-wider mb-1">Estimasi Total</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold" style={{ color: isAvailable ? flavor.brandColor : '#9ca3af' }}>
                        {displayPrice ? `Rp ${(displayPrice * quantity).toLocaleString('id-ID')}` : 'Tidak Tersedia'}
                      </span>
                      {displayPrice && <span className="text-xs text-black/40">(@ Rp {displayPrice.toLocaleString('id-ID')})</span>}
                    </div>
                    <p className="text-xs text-black/50 mt-1">Total akhir diverifikasi oleh sistem saat pesanan dibuat.</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-black/58">Jumlah:</span>
                    <div className="flex items-center border border-black/10 rounded-xl overflow-hidden bg-[#f2f0eb]/50">
                      <button onClick={decreaseQty} className="p-2 hover:bg-black/5 text-black/70 transition-colors"><Minus size={18} /></button>
                      <span className="w-12 text-center font-bold text-black/87">{quantity}</span>
                      <button onClick={increaseQty} className="p-2 hover:bg-black/5 text-black/70 transition-colors"><Plus size={18} /></button>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    disabled={!isAvailable || catalogLoading}
                    onClick={handleAddToCart}
                    className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 ${
                      !isAvailable || catalogLoading ? 'cursor-not-allowed opacity-60' : ''
                    }`}
                    style={{ backgroundColor: isAvailable ? flavor.brandColor : '#9ca3af' }}
                  >
                    <ShoppingBag size={22} />
                    {catalogLoading ? 'Memeriksa Ketersediaan...' : isAvailable ? 'Pesan Sekarang' : 'Produk Tidak Tersedia'}
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-8 border border-black/5 shadow-sm">
                <h2 className="text-xl font-bold mb-4">Tentang Produk Ini</h2>
                <p className="text-black/70 leading-relaxed text-base">{flavor.description}</p>

                <h3 className="text-lg font-bold mt-8 mb-3">Komposisi Bahan</h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {flavor.ingredients.map((ing, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-black/70 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: flavor.brandColor }}></span>
                      {ing}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-black/5 shadow-sm">
                <h2 className="font-bold text-lg mb-4">Informasi Nilai Gizi</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-black/5">
                    <span className="text-black/70 font-medium">Kalori</span>
                    <span className="font-bold text-black/87">{flavor.nutrition.calories}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-black/5">
                    <span className="text-black/70 font-medium">Protein</span>
                    <span className="font-bold text-black/87">{flavor.nutrition.protein}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-black/5">
                    <span className="text-black/70 font-medium">Lemak</span>
                    <span className="font-bold text-black/87">{flavor.nutrition.fat}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-black/5">
                    <span className="text-black/70 font-medium">Gula</span>
                    <span className="font-bold text-black/87">{flavor.nutrition.sugar}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-black/5 shadow-sm">
                <h2 className="font-bold text-lg mb-4">Garansi Kualitas Dingin</h2>
                <div className="space-y-4 text-sm text-black/70">
                  <div className="flex items-start gap-3">
                    <Snowflake size={20} className="text-[#00754A] flex-shrink-0 mt-0.5" />
                    <p>Suhu penyimpanan dan pengiriman ketat pada rentang 2°C - 4°C.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <ThumbsUp size={20} className="text-[#00754A] flex-shrink-0 mt-0.5" />
                    <p>Pengemasan higienis dengan ice gel pack khusus kurir instan/sameday.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
