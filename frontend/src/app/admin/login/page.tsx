"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Shield, ShieldAlert, Lock, ArrowRight } from "lucide-react";

function AdminLoginForm() {
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("from") || "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrorMessage(data.error || "Invalid credentials");
        setIsSubmitting(false);
        return;
      }

      // SECURITY INVARIANT: Zero token storage in localStorage or sessionStorage.
      // Session is managed exclusively via HTTP-only cookie set by backend/BFF.
      window.location.href = fromUrl;
    } catch {
      setErrorMessage("Authentication service unavailable. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F2F0EB] text-[#1E3932] py-12 px-4 sm:px-6 lg:px-8 font-sans antialiased">
      <div className="max-w-md w-full space-y-7 bg-white p-8 sm:p-10 rounded-2xl shadow-[0_4px_20px_rgba(30,57,50,0.06)] border border-[#E5E2DA]">
        {/* Brand Header */}
        <div className="text-center">
          <div className="mx-auto w-14 h-14 bg-[#1E3932] rounded-xl flex items-center justify-center text-white font-black text-xl shadow-sm tracking-wider">
            CY
          </div>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-[#1E3932]">
            Callme Yoghurt Operations
          </h1>
          <p className="mt-1.5 text-xs text-[#5C6F68] tracking-wider uppercase font-semibold">
            Privileged Administrative Portal
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="p-3.5 text-xs text-[#C62828] bg-[#FFEBEE] rounded-xl border border-[#FFCDD2] flex items-center gap-2.5"
          >
            <ShieldAlert size={16} className="text-[#C62828] flex-shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold text-[#1E3932] mb-1.5"
              >
                Administrator Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className="block w-full px-3.5 py-2.5 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-sm text-[#1E3932] placeholder-[#8A9590] focus:outline-none focus:ring-2 focus:ring-[#00754A] focus:border-transparent disabled:opacity-50 transition-colors"
                placeholder="admin@callmeyoghurt.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold text-[#1E3932] mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                className="block w-full px-3.5 py-2.5 bg-[#FAF9F7] border border-[#D5D1C7] rounded-xl text-sm text-[#1E3932] placeholder-[#8A9590] focus:outline-none focus:ring-2 focus:ring-[#00754A] focus:border-transparent disabled:opacity-50 transition-colors"
                placeholder="••••••••••••"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl shadow-sm text-sm font-bold text-white bg-[#00754A] hover:bg-[#1E3932] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00754A] disabled:opacity-50 transition-all cursor-pointer"
            >
              <span>{isSubmitting ? "Authenticating..." : "Sign In to Operations"}</span>
              {!isSubmitting && <ArrowRight size={15} />}
            </button>
          </div>
        </form>

        <div className="pt-4 border-t border-[#E5E2DA] flex items-center justify-between text-[11px] text-[#5C6F68]">
          <span className="flex items-center gap-1 font-medium">
            <Shield size={13} className="text-[#00754A]" />
            <span>Zero-Trust RBAC</span>
          </span>
          <span className="font-mono text-[10px]">Argon2id • HttpOnly</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F2F0EB]">
          <div className="text-[#5C6F68] text-xs font-medium">Loading operations console...</div>
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
