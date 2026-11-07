"use client";

import React, { useState } from "react";
import { CompanyProvider, useCompany } from "@/lib/context/CompanyContext";
import { CompanySwitcher } from "@/components/layout/CompanySwitcher";
import { FinancialDashboard } from "@/components/accounting/FinancialDashboard";
import { VoucherGrid } from "@/components/accounting/VoucherGrid";
import { PurchaseForm } from "@/components/accounting/PurchaseForm";
import { SalesForm } from "@/components/accounting/SalesForm";
import { SireHub } from "@/components/accounting/SireHub";
import { ReportsHub } from "@/components/accounting/ReportsHub";
import { SunatConfigModal } from "@/components/settings/SunatConfigModal";
import {
  LayoutDashboard,
  FileSpreadsheet,
  Receipt,
  TrendingUp,
  Database,
  BarChart3,
  DollarSign,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ActiveTab = "DASHBOARD" | "VOUCHER_GRID" | "PURCHASES" | "SALES" | "SIRE_PLE" | "REPORTS";

function AccountingShell() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("DASHBOARD");
  const [isSunatModalOpen, setIsSunatModalOpen] = useState(false);
  const { activeCompany, selectedYear, selectedMonth } = useCompany();

  return (
    <main className="flex flex-col h-screen w-full overflow-hidden bg-slate-950">
      {/* -------------------------------------------------------------------- */}
      {/* BARRA SUPERIOR INTEGRADA (HEADER EMPRESARIAL STRIPE / LINEAR)        */}
      {/* -------------------------------------------------------------------- */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-6 flex items-center justify-between select-none shrink-0 z-20">
        <div className="flex items-center gap-5">
          {/* Logo y Marca */}
          <div
            onClick={() => setActiveTab("DASHBOARD")}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform">
              CP
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-white group-hover:text-indigo-300 transition-colors">
                ContablePro
              </span>
              <span className="text-[10px] text-indigo-400 font-mono ml-1.5 uppercase font-semibold">
                SaaS ERP
              </span>
            </div>
          </div>

          <span className="text-slate-700">|</span>

          {/* Conmutador Multi-Empresa y Selector de Ejercicio/Periodo */}
          <CompanySwitcher />
        </div>

        {/* Selector de Módulos Operativos */}
        <nav className="hidden xl:flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("DASHBOARD")}
            className={cn(
              "px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all font-medium cursor-pointer",
              activeTab === "DASHBOARD"
                ? "bg-slate-800 text-indigo-300 border border-slate-700/80 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-indigo-400" />
            Dashboard
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("VOUCHER_GRID")}
            className={cn(
              "px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all font-medium cursor-pointer",
              activeTab === "VOUCHER_GRID"
                ? "bg-slate-800 text-indigo-300 border border-slate-700/80 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Asientos (CONCAR)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("PURCHASES")}
            className={cn(
              "px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all font-medium cursor-pointer",
              activeTab === "PURCHASES"
                ? "bg-slate-800 text-indigo-300 border border-slate-700/80 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Receipt className="w-3.5 h-3.5" />
            Compras (XML)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("SALES")}
            className={cn(
              "px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all font-medium cursor-pointer",
              activeTab === "SALES"
                ? "bg-slate-800 text-indigo-300 border border-slate-700/80 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Ventas
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("SIRE_PLE")}
            className={cn(
              "px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all font-medium cursor-pointer",
              activeTab === "SIRE_PLE"
                ? "bg-slate-800 text-indigo-300 border border-slate-700/80 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Database className="w-3.5 h-3.5 text-amber-400" />
            SUNAT SIRE
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("REPORTS")}
            className={cn(
              "px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all font-medium cursor-pointer",
              activeTab === "REPORTS"
                ? "bg-slate-800 text-indigo-300 border border-slate-700/80 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
            Reportes & Cierres
          </button>
        </nav>

        {/* Indicador de Tipo de Cambio SUNAT y Acceso a Clave SOL */}
        <div className="flex items-center gap-2.5 text-xs font-mono">
          <button
            type="button"
            onClick={() => setIsSunatModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-[11px] font-sans font-medium transition-colors cursor-pointer"
            title="Conectar o configurar Clave SOL de SUNAT"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Clave SOL</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 bg-slate-850 px-2.5 py-1 rounded-md border border-slate-800 text-[11px] text-slate-400">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>TC SUNAT:</span>
            <span className="text-emerald-400 font-semibold">C: 3.752 | V: 3.758</span>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------------------- */}
      {/* VISTA ACTIVA DEL SISTEMA CONTABLE                                    */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "DASHBOARD" && (
          <FinancialDashboard
            onNavigateTab={(tab) => setActiveTab(tab)}
            onOpenSunatConfig={() => setIsSunatModalOpen(true)}
          />
        )}

        {activeTab === "VOUCHER_GRID" && (
          <VoucherGrid
            companyRuc={activeCompany.ruc}
            companyName={activeCompany.businessName}
            initialVoucherNumber={`${String(selectedMonth).padStart(2, "0")}0001`}
            exchangeRate={3.755}
          />
        )}

        {activeTab === "PURCHASES" && (
          <PurchaseForm
            companyRuc={activeCompany.ruc}
            companyName={activeCompany.businessName}
            defaultTc={3.755}
          />
        )}

        {activeTab === "SALES" && (
          <SalesForm
            companyRuc={activeCompany.ruc}
            companyName={activeCompany.businessName}
            defaultTc={3.755}
          />
        )}

        {activeTab === "SIRE_PLE" && (
          <SireHub
            companyRuc={activeCompany.ruc}
            companyName={activeCompany.businessName}
            year={selectedYear}
            month={selectedMonth}
          />
        )}

        {activeTab === "REPORTS" && (
          <ReportsHub
            companyRuc={activeCompany.ruc}
            companyName={activeCompany.businessName}
          />
        )}
      </div>

      {/* Modal de Conexión Rápida SUNAT Clave SOL */}
      <SunatConfigModal
        isOpen={isSunatModalOpen}
        onClose={() => setIsSunatModalOpen(false)}
        currentRuc={activeCompany.ruc}
      />
    </main>
  );
}

export default function HomePage() {
  return (
    <CompanyProvider>
      <AccountingShell />
    </CompanyProvider>
  );
}
