"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { MOTION_TOKENS } from "@/lib/motion";

export default function RootTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const isAdmin = pathname?.startsWith("/admin");

  if (shouldReduceMotion) {
    return <>{children}</>;
  }

  // Admin routes use a calm, fast fade (~180ms) without y-shifts
  if (isAdmin) {
    return (
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: MOTION_TOKENS.duration.fast,
          ease: MOTION_TOKENS.ease.out,
        }}
        className="w-full"
      >
        {children}
      </motion.div>
    );
  }

  // Customer routes use slightly richer motion (opacity + 10px y-shift, ~240ms)
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: MOTION_TOKENS.duration.normal,
        ease: MOTION_TOKENS.ease.out,
      }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}
