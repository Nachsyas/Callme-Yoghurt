"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Snowflake,
  Users,
  X,
} from "lucide-react";

interface AdminShellProps {
  children: React.ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/admin" },
  { id: "catalog", label: "Catalog", icon: Package, href: "/admin/catalog" },
  { id: "inventory", label: "Inventory", icon: Boxes, href: "/admin/inventory" },
  { id: "orders", label: "Orders", icon: ShoppingCart, href: "/admin/orders" },
  { id: "customers", label: "Customers", icon: Users, href: "/admin/customers" },
  { id: "cold-chain", label: "Cold Chain", icon: Snowflake, href: "/admin/cold-chain" },
  { id: "reports", label: "Reports", icon: FileBarChart, href: "/admin/reports" },
  { id: "security", label: "Security", icon: Settings, href: "/admin/security" },
];

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tabletCollapsed, setTabletCollapsed] = useState(false);

  // If viewing the admin login page, bypass the sidebar shell
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  // Determine active item from pathname
  const isNavActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  // Get current page title for the header bar
  const currentNav = NAV_ITEMS.find((item) => isNavActive(item.href)) || NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-[#F2F0EB] text-[#1E3932] flex font-sans antialiased max-w-full overflow-x-hidden">
      {/* MOBILE BACKDROP OVERLAY */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* SIDEBAR:
          - Desktop (lg): Fixed w-64
          - Tablet (md to lg): Collapsible between w-64 and w-20
          - Mobile (<md): Off-canvas sliding drawer
      */}
      <aside
        aria-label="Admin Navigation"
        className={`
          fixed top-0 bottom-0 left-0 z-50 bg-[#1E3932] text-white flex flex-col justify-between flex-shrink-0 border-r border-[#172C27] transition-all duration-300 ease-in-out
          ${mobileMenuOpen ? "translate-x-0 w-64 shadow-2xl" : "-translate-x-full md:translate-x-0"}
          ${tabletCollapsed ? "md:w-20 lg:w-64" : "md:w-64 lg:w-64"}
        `}
      >
        <div>
          {/* Logo & Brand Block */}
          <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#00754A] flex items-center justify-center text-white font-black text-sm tracking-wider shadow-sm flex-shrink-0">
                CY
              </div>
              <div className={`${tabletCollapsed ? "md:hidden lg:block" : "block"} overflow-hidden`}>
                <span className="font-extrabold text-sm text-white tracking-tight block truncate">
                  CALLME ERP
                </span>
                <span className="text-[10px] uppercase tracking-widest text-[#98D8B6] font-semibold block truncate">
                  Operations Console
                </span>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              type="button"
              className="p-1 rounded-lg text-white/70 hover:text-white lg:hidden md:hidden cursor-pointer"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close Sidebar"
            >
              <X size={20} />
            </button>

            {/* Tablet Collapse Toggle Button */}
            <button
              type="button"
              onClick={() => setTabletCollapsed(!tabletCollapsed)}
              className="hidden md:flex lg:hidden p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
              aria-label={tabletCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {tabletCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>

            <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white/80 border border-white/15 font-mono hidden lg:block">
              v1.7
            </span>
          </div>

          {/* Navigation Menu */}
          <nav className="p-3 space-y-1 text-xs font-medium" aria-label="ERP Modules">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider text-[#98D8B6]/70 px-3 pt-2 pb-1.5 block ${
                tabletCollapsed ? "md:hidden lg:block" : "block"
              }`}
            >
              Menu Navigasi
            </span>

            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isNavActive(item.href);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors ${
                    active
                      ? "bg-[#00754A] text-white font-semibold shadow-sm"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon size={18} className="flex-shrink-0" />
                    <span className={`${tabletCollapsed ? "md:hidden lg:inline" : "inline"} truncate`}>
                      {item.label}
                    </span>
                  </div>

                  {active && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 ${
                        tabletCollapsed ? "md:hidden lg:block" : "block"
                      }`}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Operator Profile & Logout Footer */}
        <div className="p-3 sm:p-4 border-t border-white/10 bg-[#172C27]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#00754A] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                OP
              </div>
              <div className={`${tabletCollapsed ? "md:hidden lg:block" : "block"} overflow-hidden`}>
                <span className="text-xs font-semibold text-white block truncate">
                  owner@callmeyoghurt.com
                </span>
                <span className="text-[10px] text-[#98D8B6] font-mono block">
                  ROLE: OWNER
                </span>
              </div>
            </div>
            <form action="/api/admin/logout" method="POST">
              <button
                type="submit"
                aria-label="Logout"
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* MAIN OPERATIONS WORKSPACE */}
      <div
        className={`
          flex-1 flex flex-col min-w-0 transition-all duration-300
          ${tabletCollapsed ? "md:pl-20 lg:pl-64" : "md:pl-64 lg:pl-64"}
        `}
      >
        {/* Top Header Bar */}
        <header className="bg-white border-b border-[#E5E2DA] px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-3 sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Hamburger Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-1 rounded-xl text-[#1E3932] hover:bg-[#FAF9F7] md:hidden border border-[#E5E2DA] cursor-pointer"
              aria-label="Open Mobile Menu"
            >
              <Menu size={20} />
            </button>

            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-[#1E3932] tracking-tight truncate">
                {currentNav.label}
              </h1>
              <p className="text-[11px] sm:text-xs text-[#5C6F68] mt-0.5 font-medium truncate">
                Operational module — Callme Yoghurt ERP Console
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
            {/* Status Invariant Badge */}
            <span className="inline-flex items-center px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold bg-[#E8F5E9] text-[#1E3932] border border-[#C8E6C9]">
              Authenticated Session Active
            </span>

            {/* User Profile Pill */}
            <div className="hidden xl:flex items-center gap-2 pl-2 border-l border-[#E5E2DA] text-xs font-medium text-[#5C6F68]">
              <span>owner@callmeyoghurt.com</span>
              <span className="px-2 py-0.5 rounded-full bg-[#1E3932] text-white font-mono text-[10px] font-bold">
                OWNER
              </span>
            </div>
          </div>
        </header>

        {/* Page Main Content Area */}
        <main className="p-4 sm:p-6 space-y-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
