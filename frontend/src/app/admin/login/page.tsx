"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Lock, Shield, ShieldAlert, KeyRound } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-[#090e1a] text-slate-100 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans antialiased">
      {/* Subtle Background Glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#00754A]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full space-y-8 bg-[#0f172a] p-8 sm:p-10 rounded-2xl shadow-2xl border border-slate-800 relative z-10">
        <div>
          <div className="mx-auto w-14 h-14 bg-gradient-to-br from-[#00754A] to-[#004d31] rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg border border-emerald-400/30">
            CY
          </div>
          <h2 className="mt-5 text-center text-2xl font-extrabold tracking-tight text-white">
            Callme Yoghurt Operations
          </h2>
          <p className="mt-1.5 text-center text-xs text-slate-400 tracking-wide uppercase font-semibold">
            Privileged Administrative Portal
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="p-3.5 text-xs text-rose-300 bg-rose-950/50 rounded-xl border border-rose-800/80 flex items-center gap-2.5"
          >
            <ShieldAlert size={16} className="text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Administrator Email
              </label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  className="block w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl shadow-inner text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00754A] focus:border-transparent disabled:opacity-50 transition-all"
                  placeholder="admin@callmeyoghurt.com"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="block w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl shadow-inner text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00754A] focus:border-transparent disabled:opacity-50 transition-all"
                />
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-[#00754A] hover:bg-[#006241] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00754A] disabled:opacity-50 transition-all"
            >
              {isSubmitting ? "Authenticating..." : "Sign In to Operations"}
            </button>
          </div>
        </form>

        <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Shield size={12} className="text-emerald-500" />
            <span>Zero-Trust RBAC</span>
          </span>
          <span>Argon2id • HttpOnly</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#090e1a]">
          <div className="text-slate-500 text-xs font-mono">Loading operations console...</div>
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
