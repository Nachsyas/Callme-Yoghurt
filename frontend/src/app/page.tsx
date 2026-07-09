"use client";

import Lenis from "@studio-freight/lenis";
import { motion } from "framer-motion";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { CheckCircle, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const flavors = [
  { id: "plain", name: "Plain", sub: "Pure Vanilla", price: "Rp 22.000", color: "bg-[#cba258]" },
  { id: "stroberi", name: "Stroberi", sub: "Summer Blush Berry", price: "Rp 25.000", color: "bg-[#D81E5B]" },
  { id: "mangga", name: "Mangga", sub: "Tropical Gold Premium", price: "Rp 28.000", color: "bg-[#F9A03F]" },
  { id: "melon", name: "Melon", sub: "Emerald Fresh Dew", price: "Rp 25.000", color: "bg-[#A1C349]" },
  { id: "anggur", name: "Anggur", sub: "Royal Purple Grape", price: "Rp 28.000", color: "bg-[#7A3B69]" },
  { id: "leci", name: "Leci", sub: "Sweet Lychee Bliss", price: "Rp 25.000", color: "bg-[#ff8da1]" },
  { id: "vanila", name: "Vanila", sub: "Velvet Orchid Vanilla", price: "Rp 25.000", color: "bg-[#f3e5AB]" },
  { id: "pisang", name: "Pisang Ambon", sub: "Sweet Banana Smooth", price: "Rp 25.000", color: "bg-[#E8D354]" },
];

export default function Home() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const horizontalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    const ctx = gsap.context(() => {
      const sections = gsap.utils.toArray(".product-card");

      gsap.to(sections, {
        xPercent: -100 * (sections.length - 1),
        ease: "none",
        scrollTrigger: {
          trigger: horizontalRef.current,
          pin: true,
          scrub: 1,
          snap: 1 / (sections.length - 1),
          end: () => "+=" + horizontalRef.current?.offsetWidth,
        }
      });
    }, scrollRef);

    return () => {
      lenis.destroy();
      ctx.revert();
    };
  }, []);

  return (
    <div className="bg-[#f2f0eb] min-h-screen font-sans antialiased overflow-x-hidden">

      <nav className="fixed top-0 w-full z-50 bg-[#f2f0eb]/90 backdrop-blur-md shadow-sm h-20 flex items-center border-b border-black/5">
        <div className="flex justify-between items-center px-6 w-full max-w-7xl mx-auto">
          <Link href="/" className="font-extrabold text-xl text-[#00754A] tracking-tight">
            Callme Yoghurt
          </Link>
          <div className="hidden md:flex gap-8">
            <button onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })} className="font-medium text-black/58 hover:text-[#00754A] transition-colors">Katalog</button>
            <Link className="font-medium text-black/58 hover:text-[#00754A] transition-colors" href="#kisah">Kisah Kami</Link>
          </div>
          <Link href="/checkout">
            <button className="px-6 py-2.5 bg-[#00754A] text-white rounded-[50px] font-semibold text-sm hover:scale-95 transition-transform duration-200 shadow-sm">
              Keranjang
            </button>
          </Link>
        </div>
      </nav>

      <main ref={scrollRef} className="pt-20">

        {/* 1. HERO SECTION ESTETIK */}
        <section className="w-full min-h-[calc(100vh-80px)] flex items-center justify-center px-6 lg:px-20 relative py-12">
          <div className="max-w-7xl w-full flex flex-col lg:flex-row items-center justify-between gap-12 z-10">
            <div className="w-full lg:w-[50%] flex flex-col items-start relative z-20">
              <span className="text-[#00754A] font-bold tracking-widest text-sm uppercase mb-4 block">Homemade Quality</span>
              <h1 className="text-6xl md:text-[5.5rem] font-bold leading-[1.1] mb-6">
                <motion.span initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="block">
                  Kentalnya
                </motion.span>
                <motion.span initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="block text-brand-strawberry">
                  Nikmat.
                </motion.span>
              </h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-lg md:text-xl text-brand-textSoft max-w-lg mb-10 leading-[1.5]">
                Stirred yoghurt premium dengan 100% gula asli tanpa pemanis buatan. Tersedia dalam 8 varian kesegaran murni yang siap menyehatkan hari Anda.
              </motion.p>
              <motion.button onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7 }} className="bg-[#1E3932] text-white px-8 py-4 rounded-[50px] font-semibold text-lg flex items-center gap-3 active:scale-95 hover:scale-95 transition-transform duration-200 shadow-md">
                Jelajahi Rasa
              </motion.button>
            </div>

            {/* FOTO HERO SPLASH: Sengaja dibuat membesar (scale-125) agar cipratan susunya terkesan keluar dari layar */}
            <div className="w-full lg:w-[50%] flex justify-center lg:justify-end relative">
              <motion.div animate={{ y: [-10, 10, -10] }} transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }} className="w-full max-w-[550px] aspect-square relative z-20 flex items-center justify-center transform scale-110 lg:scale-125">
                <Image
                  src="/images/hero-splash.png"
                  alt="Callme Yoghurt Varian"
                  fill
                  className="object-contain drop-shadow-[0_20px_25px_rgba(0,0,0,0.25)]"
                  priority
                />
              </motion.div>
              {/* Efek Cahaya di belakang botol */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-[#d4e9e2] blur-[100px] rounded-full z-0 opacity-70" />
            </div>
          </div>
        </section>

        <section className="bg-[#1E3932] w-full py-20 px-6 lg:px-20 relative z-20">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { icon: Truck, title: "Cold Chain Logistics", desc: "Suhu terjaga < 5°C dari pabrik hingga ke tangan Anda." },
              { icon: ShieldCheck, title: "Kualitas Terjamin", desc: "Terdaftar resmi BPOM RI & tersertifikasi 100% Halal MUI." },
              { icon: CheckCircle, title: "Homemade Quality", desc: "Dibuat higienis 100% gula asli tanpa pemanis buatan." }
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col items-start gap-4">
                <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center">
                  <item.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white tracking-tightest">{item.title}</h3>
                <p className="text-white/70 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 2. KATALOG ESTETIK */}
        <section ref={horizontalRef} className="h-screen bg-brand-ceramic overflow-hidden flex flex-col justify-center">
          <div className="px-6 lg:px-20 pt-10 pb-8">
            <h2 className="text-4xl md:text-5xl font-bold text-brand-textMain">Varian Rasa Pilihan.</h2>
            <p className="text-brand-textSoft mt-2">Scroll ke bawah untuk menggeser katalog.</p>
          </div>

          <div className="w-[450%] md:w-[280%] h-[60vh] flex flex-nowrap items-center px-6 lg:px-20 gap-8 mt-4">
            {flavors.map((flavor, idx) => (
              <div key={idx} className="product-card w-[80vw] md:w-[360px] flex-shrink-0 h-full bg-white rounded-[20px] shadow-card flex flex-col overflow-hidden relative group">

                {/* Kotak Gambar: Disesuaikan agar mangkok dan cipratan susu tidak terpotong (menggunakan scale-110) */}
                <div className={`w-full h-[60%] ${flavor.color} flex items-end justify-center relative px-6 pb-2 pt-10 overflow-visible transition-colors duration-500`}>
                  <div className="absolute top-0 w-full h-full bg-black/5 mix-blend-overlay"></div>
                  <div className="relative w-full h-full transform transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-4 z-10">
                    <Image
                      src={`/images/${flavor.id}.png`}
                      alt={flavor.name}
                      fill
                      className="object-contain drop-shadow-[0_15px_15px_rgba(0,0,0,0.15)]"
                    />
                  </div>
                </div>

                <div className="p-6 md:p-8 flex flex-col flex-grow justify-between bg-white z-20 rounded-t-[20px] -mt-4 relative">
                  <div>
                    <h3 className="text-2xl font-bold text-brand-textMain tracking-tight">{flavor.name}</h3>
                    <p className="text-sm text-brand-textSoft mt-1.5">{flavor.sub}</p>
                  </div>
                  <div className="flex items-center justify-between mt-6">
                    <span className="font-bold text-xl text-brand-textMain">{flavor.price}</span>
                    <Link href={`/product/${flavor.id}`}>
                      <button className="border-2 border-brand-accent text-brand-accent px-6 py-2.5 rounded-[50px] font-bold text-sm hover:bg-brand-accent hover:text-white active:scale-95 transition-all">
                        Lihat Detail
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. KISAH KAMI ESTETIK (Memakai all-variants.png) */}
        <section id="kisah" className="w-full bg-white py-24 px-6 lg:px-20 relative z-20 border-t border-gray-100 overflow-hidden">
          <div className="max-w-7xl mx-auto flex flex-col-reverse md:flex-row items-center gap-16">
            <div className="w-full md:w-1/2 aspect-[4/3] flex items-center justify-center relative">
              {/* Gambar 8 botol akan melayang bebas di atas cipratan warna */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[#E8D354]/10 blur-[80px] rounded-full z-0" />
              <div className="z-10 relative w-full h-full transform scale-110 md:scale-125 transition-transform duration-700 hover:scale-[1.30]">
                <Image
                  src="/images/all-variants.png"
                  alt="Callme Yoghurt All Variants"
                  fill
                  className="object-contain drop-shadow-2xl"
                />
              </div>
            </div>
            <div className="w-full md:w-1/2 space-y-6 relative z-10">
              <span className="text-[#00754A] font-bold tracking-widest text-sm uppercase">Kisah Kami</span>
              <h2 className="text-4xl md:text-5xl font-extrabold text-brand-textMain tracking-tight leading-tight">Dedikasi untuk<br />Keluarga Indonesia.</h2>
              <p className="text-lg text-brand-textSoft leading-relaxed">
                Berawal dari dapur rumahan di tahun 2018, kami berkomitmen menghadirkan <strong>stirred yoghurt</strong> berkualitas premium. Menggunakan 100% susu sapi segar dan kultur probiotik pilihan, setiap botol Callme Yoghurt diproses secara higienis setiap harinya.
              </p>
              <p className="text-lg text-brand-textSoft leading-relaxed pb-4">
                Bukan sekadar minuman, ini adalah dedikasi kami untuk gaya hidup sehat yang lezat, segar, tanpa kompromi kualitas—langsung dikirim dingin ke depan pintu rumah Anda.
              </p>
              <Link href="#kisah">
                <button className="bg-[#1E3932] text-white px-8 py-3.5 rounded-[50px] font-bold text-sm hover:opacity-90 active:scale-95 transition-all shadow-md">
                  Pelajari Lebih Lanjut
                </button>
              </Link>
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