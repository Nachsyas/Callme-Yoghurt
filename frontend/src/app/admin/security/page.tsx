"use client";

import React from "react";
import {
  CheckCircle2,
  KeyRound,
  Lock,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

interface AuditLogEntry {
  id: string;
  action: string;
  target: string;
  ipAddress: string;
  status: "SUCCESS" | "FAILED";
  timestamp: string;
}

const AUDIT_LOGS_PREVIEW: AuditLogEntry[] = [
  {
    id: "log-003",
    action: "LOGIN_SUCCESS",
    target: "owner@callmeyoghurt.com",
    ipAddress: "127.0.0.1 (Local Simulation)",
    status: "SUCCESS",
    timestamp: "24 Sep 2026 04:14:30 WIB",
  },
  {
    id: "log-002",
    action: "LOGIN_SUCCESS",
    target: "owner@callmeyoghurt.com",
    ipAddress: "127.0.0.1 (Local Simulation)",
    status: "SUCCESS",
    timestamp: "23 Sep 2026 23:26:15 WIB",
  },
  {
    id: "log-001",
    action: "ACCOUNT_CREATED",
    target: "owner@callmeyoghurt.com",
    ipAddress: "127.0.0.1 (Artisan Provision)",
    status: "SUCCESS",
    timestamp: "23 Sep 2026 23:25:02 WIB",
  },
];

export default function AdminSecurityPage() {
  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#1E3932]">
            Keamanan Sistem &amp; Zero-Trust RBAC
          </h2>
          <p className="text-xs text-[#5C6F68] mt-0.5">
            Visibilitas identitas administratif, integritas sesi, dan rekam jejak audit
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#E8F5E9] text-[#1E3932] border border-[#C8E6C9] text-xs font-semibold">
            <ShieldCheck size={13} className="text-[#00754A]" />
            <span>Zero-Trust Architecture</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FAF9F7] text-[#5C6F68] border border-[#E5E2DA] text-xs font-mono">
            Argon2id Enforced
          </span>
        </div>
      </div>

      {/* Admin Identity & Session Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card 1: Active Identity */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-3">
          <div className="flex items-center justify-between text-xs text-[#5C6F68]">
            <span className="font-bold uppercase tracking-wider">Identitas Aktif</span>
            <UserCheck size={16} className="text-[#00754A]" />
          </div>
          <div>
            <span className="font-bold text-base text-[#1E3932] block truncate">
              owner@callmeyoghurt.com
            </span>
            <span className="text-xs text-[#00754A] font-semibold mt-0.5 block">
              Callme Yoghurt Owner
            </span>
          </div>
          <div className="pt-2 border-t border-[#E5E2DA] flex items-center justify-between text-xs">
            <span className="text-[#5C6F68]">Peran RBAC:</span>
            <span className="px-2 py-0.5 rounded-full bg-[#1E3932] text-white font-mono text-[10px] font-bold">
              OWNER
            </span>
          </div>
        </div>

        {/* Card 2: Password & Auth Security */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-3">
          <div className="flex items-center justify-between text-xs text-[#5C6F68]">
            <span className="font-bold uppercase tracking-wider">Proteksi Kredensial</span>
            <KeyRound size={16} className="text-[#00754A]" />
          </div>
          <div>
            <span className="font-bold text-base text-[#1E3932] block">
              Argon2id Hashing
            </span>
            <span className="text-xs text-[#5C6F68] mt-0.5 block">
              OWASP Standard Memory-Hard
            </span>
          </div>
          <div className="pt-2 border-t border-[#E5E2DA] flex items-center justify-between text-xs">
            <span className="text-[#5C6F68]">Status Kredensial:</span>
            <span className="text-[#00754A] font-bold">Tervalidasi Kuat</span>
          </div>
        </div>

        {/* Card 3: Session Cookie Boundary */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-3">
          <div className="flex items-center justify-between text-xs text-[#5C6F68]">
            <span className="font-bold uppercase tracking-wider">Batas Sesi Browser</span>
            <Lock size={16} className="text-[#00754A]" />
          </div>
          <div>
            <span className="font-bold text-base text-[#1E3932] block">
              callme_admin_session
            </span>
            <span className="text-xs text-[#5C6F68] mt-0.5 block">
              HttpOnly • Secure • SameSite
            </span>
          </div>
          <div className="pt-2 border-t border-[#E5E2DA] flex items-center justify-between text-xs">
            <span className="text-[#5C6F68]">Penyimpanan Token:</span>
            <span className="text-[#00754A] font-bold">Zero LocalStorage</span>
          </div>
        </div>
      </div>

      {/* Zero-Trust Invariants Matrix */}
      <div className="bg-white p-5 rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
        <div className="flex items-center gap-2 border-b border-[#E5E2DA] pb-3">
          <Shield size={18} className="text-[#00754A]" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-[#1E3932]">
            Matriks Kontrol Keamanan Zero-Trust
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-lg bg-[#FAF9F7] border border-[#E5E2DA] flex items-start gap-3">
            <CheckCircle2 size={16} className="text-[#00754A] flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#1E3932] block">Enkripsi Data Konsumen (PII)</span>
              <p className="text-[11px] text-[#5C6F68] mt-0.5">
                Nomor telepon dan nama pelanggan dienkripsi menggunakan AES-256-GCM. Pencarian dilakukan melalui HMAC-SHA256 Blind Index.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#FAF9F7] border border-[#E5E2DA] flex items-start gap-3">
            <CheckCircle2 size={16} className="text-[#00754A] flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#1E3932] block">Autentikasi Internal Service (BFF &rarr; ERP)</span>
              <p className="text-[11px] text-[#5C6F68] mt-0.5">
                Seluruh komunikasi server-to-server dilindungi header Bearer Service Token yang tidak pernah dikirim ke browser client.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#FAF9F7] border border-[#E5E2DA] flex items-start gap-3">
            <CheckCircle2 size={16} className="text-[#00754A] flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#1E3932] block">Isolasi Jaringan Database &amp; Cache</span>
              <p className="text-[11px] text-[#5C6F68] mt-0.5">
                Port PostgreSQL 5432 dan Redis 6379 tidak diekspos ke internet publik, hanya dapat diakses melalui Docker bridge network privat.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#FAF9F7] border border-[#E5E2DA] flex items-start gap-3">
            <CheckCircle2 size={16} className="text-[#00754A] flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#1E3932] block">Ingress Cloudflare Tunnel Terenkripsi</span>
              <p className="text-[11px] text-[#5C6F68] mt-0.5">
                VPS beroperasi tanpa membuka port 80/443 secara publik, seluruh lalu lintas melewati terowongan Cloudflare terenkripsi QUIC/HTTP2.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log Table Preview */}
      <div className="bg-white rounded-xl border border-[#E5E2DA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#E5E2DA] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-[#1E3932]">
              Audit Trail Administratif (admin_audit_logs)
            </h3>
            <p className="text-xs text-[#5C6F68]">
              Catatan append-only aktivitas administratif di ERP Core
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-[#00754A] bg-[#E8F5E9] px-2.5 py-1 rounded-xl border border-[#C8E6C9]">
            Append-Only
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1E3932]">
            <thead className="bg-[#FAF9F7] text-[#5C6F68] font-bold uppercase text-[10px] tracking-wider border-b border-[#E5E2DA]">
              <tr>
                <th className="px-4 py-3">Log ID</th>
                <th className="px-4 py-3">Aksi / Event</th>
                <th className="px-4 py-3">Target Akun</th>
                <th className="px-4 py-3">Alamat IP / Asal</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Waktu Kejadian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E2DA]">
              {AUDIT_LOGS_PREVIEW.map((log) => (
                <tr key={log.id} className="hover:bg-[#FDFCFB] transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-[#1E3932]">
                    {log.id}
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-[#1E3932]">
                    {log.action}
                  </td>
                  <td className="px-4 py-3 text-[#5C6F68]">
                    {log.target}
                  </td>
                  <td className="px-4 py-3 font-mono text-[#5C6F68]">
                    {log.ipAddress}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F5E9] text-[#1E3932] border border-[#C8E6C9]">
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#5C6F68] text-[11px] whitespace-nowrap">
                    {log.timestamp}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
