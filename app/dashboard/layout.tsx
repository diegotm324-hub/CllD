import React from "react";
import { Navbar } from "@/components/Navbar";
import { getColldDashboardMetrics } from "@/app/actions/colld";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const metricsRes = await getColldDashboardMetrics();
  const activeCompany = metricsRes.data?.company;
  const exchangeRate = metricsRes.data?.exchangeRate || { buy: 3.755, sell: 3.782 };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* -------------------------------------------------------------------- */}
      {/* TOP NAVIGATION BAR CON SELECTOR MULTI-EMPRESA / MULTI-RUC            */}
      {/* -------------------------------------------------------------------- */}
      <Navbar activeCompany={activeCompany} exchangeRate={exchangeRate} />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-6 md:p-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-4 px-6 text-center text-xs text-zinc-600 flex flex-col sm:flex-row justify-between items-center gap-2">
        <span>colld v2.5 — Sistema Contable Cloud Multi-Empresa (PCGE & SUNAT SIRE)</span>
        <span className="font-mono text-[11px] text-zinc-500">Aislamiento total por RUC</span>
      </footer>
    </div>
  );
}
