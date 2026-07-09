import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Callme Yoghurt | Premium Stirred Yoghurt",
  description: "Menghadirkan stirred yoghurt kental, smooth, dan creamy kualitas homemade terbaik dengan standar Cold Chain Logistics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${inter.className} bg-[#f2f0eb] text-black/87 antialiased selection:bg-[#00754A] selection:text-white overflow-x-hidden`}>
        {children}
      </body>
    </html>
  );
}