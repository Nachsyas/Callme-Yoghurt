"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Lenis from "@studio-freight/lenis";
import { motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import {
  ArrowRight,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
} from "lucide-react";
import {
  CatalogCard,
  type FlavorPresentation,
} from "@/components/catalog/CatalogCard";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { useCartStore } from "@/store/cartStore";
import { MOTION_TOKENS } from "@/lib/motion";
import type { PublicCatalogData, PublicCatalogProduct } from "@/lib/catalog";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// Visual presentation metadata only — NO variant IDs, NO SKUs, NO price authority
const OFFICIAL_FLAVORS_PRESENTATION: FlavorPresentation[] = [
  {
    slug: "plain",
    name: "Plain Pure Original",
    sub: "Yogurt stirred murni tanpa pemanis buatan",
    color: "bg-[#cba258]",
    artwork: "/images/products/plain-250-500.png",
  },
  {
    slug: "stroberi",
    name: "Stroberi Summer Blush",
    sub: "Paduan rasa stroberi buah segar aromatik",
    color: "bg-[#D81E5B]",
    artwork: "/images/products/stroberi-250-500.png",
  },
  {
    slug: "mangga",
    name: "Mangga Tropical Gold",
    sub: "Kombinasi asam manis harum manis eksotis",
    color: "bg-[#F9A03F]",
    artwork: "/images/products/mangga-250-500.png",
  },
  {
    slug: "melon",
    name: "Melon Emerald Fresh",
    sub: "Sensasi kesegaran buah melon berair renyah",
    color: "bg-[#A1C349]",
    artwork: "/images/products/melon-250-500.png",
  },
  {
    slug: "anggur",
    name: "Anggur Royal Purple",
    sub: "Sensasi rasa anggur merah premium manis",
    color: "bg-[#7A3B69]",
    artwork: "/images/products/anggur-250-500.png",
  },
  {
    slug: "leci",
    name: "Leci Sweet Bliss",
    sub: "Rasa leci manis harum khas yang menyegarkan",
    color: "bg-[#ff8da1]",
    artwork: "/images/products/leci-250-500.png",
  },
  {
    slug: "vanila",
    name: "Vanila Velvet Orchid",
    sub: "Kehangatan rasa vanila klasik susu fermentasi",
    color: "bg-[#f3e5AB]",
    artwork: "/images/products/vanila-250-500.png",
  },
];

export default function Home() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const heroGlowRef = useRef<HTMLDivElement>(null);
  const storyImageRef = useRef<HTMLDivElement>(null);

  const shouldReduceMotion = useReducedMotion();
  const items = useCartStore((state) => state.items);
  const openCart = useCartStore((state) => state.openCart);

  // Authoritative ERP Catalog fetching
  const [catalogData, setCatalogData] = useState<PublicCatalogData | null>(null);
  const [catalogLoading, setCatalogLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function loadCatalog() {
      try {
        const res = await fetch("/api/catalog");
        if (!res.ok) {
          if (isMounted) setCatalogLoading(false);
          return;
        }
        const data: PublicCatalogData = await res.json();
        if (isMounted) {
          setCatalogData(data);
          setCatalogLoading(false);
        }
      } catch {
        if (isMounted) setCatalogLoading(false);
      }
    }
    loadCatalog();
    return () => {
      isMounted = false;
    };
  }, []);

  const totalItemsCount = items.reduce((acc, item) => acc + item.quantity, 0);

  // Smooth scroll and subtle GSAP storytelling parallax with verified recursive RAF cleanup
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      smoothWheel: true,
    });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    // Controlled GSAP Parallax on storytelling assets without scroll hijacking
    const ctx = gsap.context(() => {
      if (!shouldReduceMotion && heroGlowRef.current) {
        gsap.to(heroGlowRef.current, {
          y: 40,
          ease: "none",
          scrollTrigger: {
            trigger: heroGlowRef.current,
            start: "top center",
            end: "bottom top",
            scrub: true,
          },
        });
      }

      if (!shouldReduceMotion && storyImageRef.current) {
        gsap.fromTo(
          storyImageRef.current,
          { y: 30 },
          {
            y: -20,
            ease: "none",
            scrollTrigger: {
              trigger: storyImageRef.current,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          }
        );
      }
    }, scrollRef);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      ctx.revert();
    };
  }, [shouldReduceMotion]);

  // Carousel Arrow Controls with smooth non-hijacked scroll
  const handleScrollCarousel = (direction: "left" | "right") => {
    if (!carouselRef.current) return;
    const scrollAmount = 380;
    carouselRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div ref={scrollRef} className="bg-[#f2f0eb] min-h-screen font-sans antialiased overflow-x-hidden selection:bg-[#00754A] selection:text-white">
      {/* 1. TOP NAVBAR */}
      <nav className="fixed top-0 w-full z-40 bg-[#f2f0eb]/90 backdrop-blur-md shadow-xs h-20 flex items-center border-b border-black/5 transition-colors">
        <div className="flex justify-between items-center px-6 w-full max-w-7xl mx-auto">
          <Link href="/" className="font-extrabold text-xl text-[#00754A] tracking-tight">
            Callme Yoghurt
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-black/70">
            <button
              type="button"
              onClick={() => scrollToSection("katalog")}
              className="hover:text-[#00754A] transition-colors cursor-pointer"
            >
              Katalog
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("kisah")}
              className="hover:text-[#00754A] transition-colors cursor-pointer"
            >
              Kisah Kami
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("standar")}
              className="hover:text-[#00754A] transition-colors cursor-pointer"
            >
              Standar Kualitas
            </button>
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              type="button"
              onClick={openCart}
              whileHover={shouldReduceMotion ? undefined : { scale: 1.03 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
              className="relative px-5 py-2.5 bg-[#00754A] hover:bg-[#006241] text-white rounded-full font-semibold text-xs flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
            >
              <ShoppingBag size={15} />
              <span>Keranjang</span>

              {totalItemsCount > 0 && (
                <motion.span
                  key={totalItemsCount}
                  initial={shouldReduceMotion ? undefined : { scale: 1.4 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: MOTION_TOKENS.duration.fast }}
                  className="bg-[#A1C349] text-[#1E3932] text-[10px] font-black rounded-full px-1.5 py-0.2 min-w-[18px] text-center"
                >
                  {totalItemsCount}
                </motion.span>
              )}
            </motion.button>
          </div>
        </div>
      </nav>

      <main className="pt-20">
        {/* 2. HERO SECTION */}
        <section className="w-full min-h-[calc(100vh-80px)] flex items-center justify-center px-6 lg:px-20 relative py-12">
          <div className="max-w-7xl w-full flex flex-col lg:flex-row items-center justify-between gap-12 z-10">
            <div className="w-full lg:w-[50%] flex flex-col items-start relative z-20">
              <motion.span
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: MOTION_TOKENS.duration.normal, delay: 0.1 }}
                className="text-[#00754A] font-bold tracking-widest text-xs uppercase mb-4 inline-flex items-center gap-1.5 bg-[#00754A]/10 px-3 py-1 rounded-full"
              >
                <Sparkles size={12} />
                <span>Homemade Quality & Stirred Texture</span>
              </motion.span>

              <h1 className="text-4xl sm:text-6xl md:text-[5.25rem] font-bold leading-[1.08] mb-6 tracking-tight">
                <motion.span
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: MOTION_TOKENS.duration.normal, delay: 0.15 }}
                  className="block text-[#1E3932]"
                >
                  Kentalnya
                </motion.span>
                <motion.span
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: MOTION_TOKENS.duration.normal, delay: 0.25 }}
                  className="block text-brand-strawberry"
                >
                  Nikmat.
                </motion.span>
              </h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: MOTION_TOKENS.duration.normal, delay: 0.35 }}
                className="text-base sm:text-lg md:text-xl text-[#5C6F68] max-w-lg mb-8 leading-relaxed"
              >
                Stirred yoghurt premium dengan gula pasir murni tanpa pemanis buatan. Tersedia dalam 7 varian kesegaran dengan pengiriman rantai dingin &lt; 5°C.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: MOTION_TOKENS.duration.normal, delay: 0.45 }}
                className="flex items-center gap-4 flex-wrap"
              >
                <motion.button
                  type="button"
                  onClick={() => scrollToSection("katalog")}
                  whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                  className="bg-[#1E3932] hover:bg-[#152722] text-white px-7 sm:px-8 py-3.5 rounded-full font-bold text-sm sm:text-base flex items-center gap-2.5 transition-colors shadow-md cursor-pointer"
                >
                  <span>Jelajahi 7 Rasa</span>
                  <ArrowRight size={16} />
                </motion.button>

                <button
                  type="button"
                  onClick={() => scrollToSection("kisah")}
                  className="text-xs sm:text-sm font-bold text-[#1E3932] px-4 py-3 rounded-full hover:bg-black/5 transition-colors cursor-pointer"
                >
                  Kisah Kami
                </button>
              </motion.div>
            </div>

            {/* HERO VISUAL WITH SUBTLE FLOATING */}
            <div className="w-full lg:w-[50%] flex justify-center lg:justify-end relative">
              <motion.div
                animate={
                  shouldReduceMotion
                    ? undefined
                    : { y: [-6, 6, -6] }
                }
                transition={{
                  repeat: Infinity,
                  duration: 5,
                  ease: "easeInOut",
                }}
                className="w-full max-w-[520px] aspect-square relative z-20 flex items-center justify-center transform scale-100 sm:scale-105 lg:scale-115"
              >
                <Image
                  src="/images/hero-splash.png"
                  alt="Callme Yoghurt Kemasan Premium"
                  fill
                  sizes="(max-width: 768px) 380px, 520px"
                  className="object-contain drop-shadow-[0_20px_25px_rgba(0,0,0,0.20)]"
                  priority
                />
              </motion.div>

              {/* Decorative Glow */}
              <div
                ref={heroGlowRef}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-[85%] bg-[#d4e9e2] blur-[90px] rounded-full z-0 opacity-70 pointer-events-none"
              />
            </div>
          </div>
        </section>

        {/* 3. STANDAR LOGISTIK & KUALITAS */}
        <section id="standar" className="bg-[#1E3932] w-full py-16 sm:py-20 px-6 lg:px-20 relative z-20">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
            {[
              {
                icon: Truck,
                title: "Cold Chain Logistics",
                desc: "Suhu terjaga ketat 0°C – 4°C dari fasilitas pengolahan hingga tiba di tangan Anda.",
              },
              {
                icon: ShieldCheck,
                title: "Legalitas & Halal MUI",
                desc: "Tersertifikasi 100% Halal LPPOM MUI, berstandar CPPOB dan nomor izin edar BPOM resmi.",
              },
              {
                icon: CheckCircle,
                title: "Homemade Quality",
                desc: "Dibuat higienis menggunakan susu sapi segar dan gula tebu alami.",
              },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: shouldReduceMotion ? 0.01 : MOTION_TOKENS.duration.normal,
                  delay: shouldReduceMotion ? 0 : idx * 0.1,
                  ease: MOTION_TOKENS.ease.out,
                }}
                className="flex flex-col items-start gap-3.5 bg-white/5 p-6 rounded-2xl border border-white/10"
              >
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-white">
                  <item.icon className="w-6 h-6 text-[#A1C349]" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">{item.title}</h3>
                <p className="text-white/75 text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* 4. HORIZONTAL PRODUCT CATALOG CAROUSEL */}
        <section id="katalog" className="py-20 bg-brand-ceramic relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 lg:px-20 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#00754A] block mb-2">
                Katalog Resmi 7 Varian
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#1E3932] tracking-tight">
                Varian Rasa Pilihan.
              </h2>
              <p className="text-sm text-[#5C6F68] mt-2 max-w-lg">
                Pilih ukuran resmi 250ml (Rp 16.000), 500ml (Rp 30.000), dan 1 Liter (Rp 55.000) dengan data resmi tersinkronisasi langsung dari ERP.
              </p>
            </div>

            {/* Carousel Arrow Controls */}
            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                onClick={() => handleScrollCarousel("left")}
                whileHover={shouldReduceMotion ? undefined : { scale: 1.08 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
                aria-label="Geser katalog ke kiri"
                className="w-11 h-11 rounded-full bg-white border border-[#E5E2DA] flex items-center justify-center text-[#1E3932] hover:bg-[#00754A] hover:text-white transition-colors shadow-xs cursor-pointer"
              >
                <ChevronLeft size={20} />
              </motion.button>
              <motion.button
                type="button"
                onClick={() => handleScrollCarousel("right")}
                whileHover={shouldReduceMotion ? undefined : { scale: 1.08 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
                aria-label="Geser katalog ke kanan"
                className="w-11 h-11 rounded-full bg-white border border-[#E5E2DA] flex items-center justify-center text-[#1E3932] hover:bg-[#00754A] hover:text-white transition-colors shadow-xs cursor-pointer"
              >
                <ChevronRight size={20} />
              </motion.button>
            </div>
          </div>

          {/* Horizontal Scroll Container */}
          <div
            id="catalog-carousel"
            ref={carouselRef}
            className="flex overflow-x-auto scroll-smooth snap-x snap-mandatory gap-6 pb-6 pt-2 px-6 lg:px-20 no-scrollbar"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {OFFICIAL_FLAVORS_PRESENTATION.map((flavor, idx) => {
              const erpProduct = catalogData?.products.find(
                (p: PublicCatalogProduct) => p.slug.toLowerCase() === flavor.slug
              ) || null;

              return (
                <CatalogCard
                  key={flavor.slug}
                  flavor={flavor}
                  erpProduct={erpProduct}
                  isErpOnline={Boolean(catalogData && erpProduct)}
                  catalogLoading={catalogLoading}
                  index={idx}
                />
              );
            })}
          </div>
        </section>

        {/* 5. KISAH KAMI SECTION */}
        <section id="kisah" className="w-full bg-white py-24 px-6 lg:px-20 relative z-20 border-t border-[#E5E2DA] overflow-hidden">
          <div className="max-w-7xl mx-auto flex flex-col-reverse md:flex-row items-center gap-16">
            <div
              ref={storyImageRef}
              className="w-full md:w-1/2 aspect-[4/3] flex items-center justify-center relative"
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[#E8D354]/10 blur-[80px] rounded-full z-0 pointer-events-none" />
              <div className="z-10 relative w-full h-full transform scale-105 md:scale-115 transition-transform duration-500 hover:scale-[1.2]">
                <Image
                  src="/images/all-variants.png"
                  alt="Callme Yoghurt All Variants Official Collection"
                  fill
                  sizes="(max-width: 768px) 340px, 500px"
                  className="object-contain drop-shadow-xl"
                />
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: shouldReduceMotion ? 0.01 : MOTION_TOKENS.duration.normal }}
              className="w-full md:w-1/2 space-y-6 relative z-10"
            >
              <span className="text-[#00754A] font-bold tracking-widest text-xs uppercase inline-block">
                Kisah Kami
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#1E3932] tracking-tight leading-tight">
                Dedikasi untuk<br />Keluarga Indonesia.
              </h2>
              <p className="text-base sm:text-lg text-[#5C6F68] leading-relaxed">
                Berawal dari dapur rumahan di tahun 2018, kami berkomitmen menghadirkan <strong>stirred yoghurt</strong> berkualitas premium. Menggunakan susu sapi segar dan kultur probiotik pilihan, setiap botol Callme Yoghurt diproses secara higienis setiap harinya.
              </p>
              <p className="text-base sm:text-lg text-[#5C6F68] leading-relaxed pb-2">
                Bukan sekadar minuman, ini adalah dedikasi kami untuk gaya hidup sehat yang lezat, segar, tanpa kompromi kualitas—langsung dikirim dingin ke depan pintu rumah Anda.
              </p>
              <div>
                <motion.button
                  type="button"
                  onClick={() => scrollToSection("katalog")}
                  whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                  className="bg-[#1E3932] hover:bg-[#152722] text-white px-8 py-3.5 rounded-full font-bold text-sm transition-colors shadow-md cursor-pointer"
                >
                  Pesan Sekarang
                </motion.button>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* 6. FOOTER */}
      <footer className="bg-[#1E3932] text-white border-t border-[#172C27]">
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
              <div className="flex flex-col gap-3">
                <span className="font-bold text-white uppercase text-xs tracking-widest opacity-60">Socials</span>
                <span className="text-sm font-medium text-white/80">Instagram</span>
                <span className="text-sm font-medium text-white/80">Facebook</span>
              </div>
              <div className="flex flex-col gap-3">
                <span className="font-bold text-white uppercase text-xs tracking-widest opacity-60">Legalitas</span>
                <span className="text-sm font-medium text-white/80">100% Halal MUI</span>
                <span className="text-sm font-medium text-white/80">Standar CPPOB</span>
                <span className="text-sm font-medium text-white/80">HAKI IDM000981336</span>
              </div>
              <div className="flex flex-col gap-3">
                <span className="font-bold text-white uppercase text-xs tracking-widest opacity-60">Operasional</span>
                <span className="text-sm font-medium text-white/80">Suhu &lt; 5°C Terjaga</span>
                <span className="text-sm font-medium text-white/80">Pengiriman Instant & Sameday</span>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 bg-black/20">
          <div className="max-w-7xl mx-auto px-6 py-6 text-center md:text-left text-xs font-medium text-white/40">
            <p>© 2026 Callme Yoghurt. Seluruh hak cipta dilindungi undang-undang.</p>
          </div>
        </div>
      </footer>

      {/* 7. FLOATING CART ACTION BUTTON */}
      <div className="fixed bottom-6 right-6 z-30">
        <motion.button
          type="button"
          onClick={openCart}
          whileHover={shouldReduceMotion ? undefined : { scale: 1.08 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
          aria-label="Buka Keranjang Belanja"
          className="relative flex items-center justify-center bg-[#00754A] hover:bg-[#006241] text-white rounded-full w-14 h-14 shadow-lg cursor-pointer transition-colors"
        >
          <ShoppingBag size={22} />
          {totalItemsCount > 0 && (
            <motion.span
              key={totalItemsCount}
              initial={shouldReduceMotion ? undefined : { scale: 1.3 }}
              animate={{ scale: 1 }}
              transition={{ duration: MOTION_TOKENS.duration.fast }}
              className="absolute -top-1 -right-1 bg-brand-strawberry text-white text-[11px] font-black rounded-full w-6 h-6 flex items-center justify-center border-2 border-white shadow-xs"
            >
              {totalItemsCount}
            </motion.span>
          )}
        </motion.button>
      </div>

      {/* 8. CART DRAWER OVERLAY */}
      <CartDrawer />
    </div>
  );
}