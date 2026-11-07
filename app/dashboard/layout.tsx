"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  BookOpen,
  Building2,
  ArrowLeftRight,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getColldDashboardMetrics, getColldEmpresas } from "@/app/actions/colld";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [activeCompany, setActiveCompany] = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [exchangeRate, setExchangeRate] = useState({ buy: 3.755, sell: 3.782 });

  useEffect(() => {
    async function loadData() {
      const res = await getColldDashboardMetrics();
      if (res.success && res.data) {
        if (res.data.company) setActiveCompany(res.data.company);
        if (res.data.exchangeRate) setExchangeRate(res.data.exchangeRate);
      }
      const compsRes = await getColldEmpresas();
      if (compsRes.success && compsRes.data) {
        setCompanies(compsRes.data);
        if (!activeCompany && compsRes.data.length > 0) {
          setActiveCompany(compsRes.data[0]);
        }
      }
    }
    loadData();
  }, []);

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/comprobantes", label: "Comprobantes", icon: Receipt },
    { href: "/dashboard/libro-diario", label: "Libro Diario", icon: BookOpen },
    { href: "/dashboard/empresas", label: "Empresas", icon: Building2 },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* -------------------------------------------------------------------- */}
      {/* TOP NAVIGATION BAR (STRIPE / LINEAR STYLE)                            */}
      {/* -------------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 h-14 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md px-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Brand */}
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="h-7 w-7 rounded-md bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center font-bold text-xs text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              cd
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-semibold text-sm tracking-tight text-white group-hover:text-indigo-400 transition-colors">
                colld
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-indigo-400 font-medium">
                Cloud ERP
              </span>
            </div>
          </Link>

          <span className="text-zinc-800">/</span>

          {/* Nav Items */}
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150",
                    isActive
                      ? "bg-zinc-900 text-white shadow-sm border border-zinc-800"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", isActive ? "text-indigo-400" : "text-zinc-500")} />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Info: Active Company + TC Pill */}
        <div className="flex items-center gap-3">
          {/* Tipo de Cambio Pill */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900/90 border border-zinc-800 text-[11px] font-mono text-zinc-300">
            <span className="text-zinc-500 uppercase font-sans text-[10px] font-semibold">TC SUNAT</span>
            <span className="text-emerald-400">C: {exchangeRate.buy.toFixed(3)}</span>
            <span className="text-zinc-700">|</span>
            <span className="text-sky-400">V: {exchangeRate.sell.toFixed(3)}</span>
          </div>

          {/* Active Company Selector */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-zinc-900/80 border border-zinc-800 text-xs">
            <Building2 className="h-3.5 w-3.5 text-indigo-400" />
            <div className="flex flex-col text-left">
              <span className="font-semibold text-zinc-200 truncate max-w-[150px] leading-tight">
                {activeCompany?.businessName || "Empresa Principal"}
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                RUC: {activeCompany?.ruc || "10746979636"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-6 md:p-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-4 px-6 text-center text-xs text-zinc-600 flex justify-between items-center">
        <span>colld v2.4 — Sistema Contable Cloud Peruano (PCGE & SUNAT SIRE)</span>
        <span className="font-mono text-[11px] text-zinc-500">Periodo: 2026-11 (Abierto)</span>
      </footer>
    </div>
  );
}
