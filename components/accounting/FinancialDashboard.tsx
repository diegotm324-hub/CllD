"use client";

// ==============================================================================
// ContablePro - Panel de Control Ejecutivo (Financial Dashboard)
// Con Guía de Primeros Pasos (Onboarding Interactivo B2B) y Ratios Financieros
// ==============================================================================

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  Database,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  ShieldCheck,
  Building2,
  Users,
  Wallet,
  Sparkles,
  ChevronRight,
  AlertCircle,
  FileText,
  CheckCircle2,
  Circle,
  UploadCloud,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useCompany } from "@/lib/context/CompanyContext";
import { getDashboardMetricsAction, DashboardMetricsResult } from "@/app/actions/periods";

export interface FinancialDashboardProps {
  onNavigateTab: (tab: "VOUCHER_GRID" | "PURCHASES" | "SALES" | "SIRE_PLE" | "REPORTS") => void;
  onOpenSunatConfig?: () => void;
}

export function FinancialDashboard({ onNavigateTab, onOpenSunatConfig }: FinancialDashboardProps) {
  const { activeCompany, selectedYear, selectedMonth } = useCompany();

  const [metrics, setMetrics] = useState<DashboardMetricsResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const data = await getDashboardMetricsAction(
          activeCompany.ruc,
          selectedYear,
          selectedMonth
        );
        setMetrics(data);
      } catch (err) {
        console.error("Error al cargar métricas del dashboard:", err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [activeCompany.ruc, selectedYear, selectedMonth]);

  if (isLoading || !metrics) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-slate-400 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
          <span>Consolidando métricas tributarias y estados financieros...</span>
        </div>
      </div>
    );
  }

  const { taxSummary, financialRatios, monthlyTrends, topSuppliers, topClients } = metrics;
  const maxTrendIncome = Math.max(...monthlyTrends.map((t) => t.incomePEN), 1);

  // Estados del Onboarding Checklist
  const hasMovements = taxSummary.totalPurchasesPEN > 0 || taxSummary.totalSalesPEN > 0;
  const step1 = true; // Empresa activa configurada
  const step2 = hasMovements; // Compras o ventas registradas
  const step3 = hasMovements; // Asientos generados
  const step4 = false; // Balance exportado

  const completedStepsCount = [step1, step2, step3, step4].filter(Boolean).length;
  const progressPercent = Math.round((completedStepsCount / 4) * 100);

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-950 text-slate-100 space-y-6">
      {/* -------------------------------------------------------------------- */}
      {/* GUÍA DE PRIMEROS PASOS (ONBOARDING INTERACTIVO PARA CONTADORES)      */}
      {/* -------------------------------------------------------------------- */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-indigo-900/40 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Guía de Inicio Rápido (Onboarding)
                <span className="text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded-full">
                  {completedStepsCount} de 4 completados ({progressPercent}%)
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Sigue estos 4 pasos para poner en marcha la contabilidad de tu empresa en minutos.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOnboardingOpen(!isOnboardingOpen)}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {isOnboardingOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Barra de Progreso */}
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-4">
          <div
            className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {isOnboardingOpen && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {/* Paso 1: Empresa configurada */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-200">1. Empresa Lista</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-3 font-mono truncate">
                  RUC: {activeCompany.ruc}
                </p>
              </div>

              {onOpenSunatConfig && (
                <button
                  type="button"
                  onClick={onOpenSunatConfig}
                  className="inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 bg-slate-800 hover:bg-slate-750 text-indigo-300 text-[11px] font-medium rounded-lg border border-slate-700 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Ajustes Clave SOL</span>
                </button>
              )}
            </div>

            {/* Paso 2: Cargar Compras / Ventas */}
            <div
              className={cn(
                "rounded-xl p-3.5 flex flex-col justify-between border transition-all",
                step2
                  ? "bg-slate-900/80 border-slate-800"
                  : "bg-indigo-950/20 border-indigo-700/40 shadow-sm"
              )}
            >
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  {step2 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-indigo-400 shrink-0 animate-pulse" />
                  )}
                  <span className="text-xs font-bold text-slate-200">2. Cargar Compras/Ventas</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                  Arrastra tu archivo ZIP de SUNAT SIRE o sube facturas XML.
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab("SIRE_PLE")}
                className="inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Cargar Archivo SIRE</span>
              </button>
            </div>

            {/* Paso 3: Revisar Asientos en la Grilla */}
            <div
              className={cn(
                "rounded-xl p-3.5 flex flex-col justify-between border transition-all",
                step3
                  ? "bg-slate-900/80 border-slate-800"
                  : "bg-slate-900/40 border-slate-800"
              )}
            >
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  {step3 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-600 shrink-0" />
                  )}
                  <span className="text-xs font-bold text-slate-200">3. Revisar Asientos</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                  Verifica partida doble Debe=Haber y amarres automáticos 6/9/79.
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab("VOUCHER_GRID")}
                className="inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-[11px] font-medium rounded-lg border border-slate-700 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />
                <span>Abrir Grilla CONCAR</span>
              </button>
            </div>

            {/* Paso 4: Exportar Balance o Excel */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Circle className="w-4 h-4 text-slate-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-200">4. Reportes y Cierres</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                  Descarga la Hoja de 10 columnas en Excel o genera libros PLE.
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab("REPORTS")}
                className="inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 bg-slate-800 hover:bg-slate-750 text-emerald-400 text-[11px] font-medium rounded-lg border border-slate-700 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ver Reportes</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 1. HERO BANNER GERENCIAL & ACCESOS RÁPIDOS                           */}
      {/* -------------------------------------------------------------------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-mono font-semibold">
              Ejercicio {selectedYear} • Mes {String(selectedMonth).padStart(2, "0")}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Régimen {activeCompany.taxRegime}
            </span>
          </div>

          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            Panel de Control Ejecutivo • {activeCompany.businessName}
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Visión integrada de liquidez financiera, liquidación proyectada del IGV (SUNAT) y balance de comprobación en tiempo real.
          </p>
        </div>

        {/* Accesos Rápidos Operativos */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigateTab("SIRE_PLE")}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-semibold rounded-lg shadow-md transition-all active:scale-95 cursor-pointer shadow-indigo-900/30"
          >
            <Database className="w-3.5 h-3.5" />
            + SIRE SUNAT
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab("PURCHASES")}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 text-slate-200 text-xs font-semibold rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Receipt className="w-3.5 h-3.5 text-indigo-400" />
            + Compra XML
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab("SALES")}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 text-slate-200 text-xs font-semibold rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            + Venta
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab("VOUCHER_GRID")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-100 text-xs font-semibold rounded-lg border border-slate-700 transition-all active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />
            Grilla Asientos
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 2. TARJETAS MÉTRICAS TRIBUTARIAS Y RATIOS FINANCIEROS                */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Facturación del Mes */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Facturación de Ventas</span>
              <span className="flex items-center text-emerald-400 text-[11px] font-semibold">
                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                +{taxSummary.salesGrowthPercent}%
              </span>
            </div>
            <div className="text-xl font-bold font-mono text-slate-100">
              S/ {taxSummary.totalSalesPEN.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-800/80 flex justify-between">
            <span>Débito Fiscal (IGV):</span>
            <span className="font-mono text-slate-300">S/ {taxSummary.debitoFiscalIgv.toFixed(2)}</span>
          </div>
        </div>

        {/* Card 2: Adquisiciones y Gastos */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Compras y Gastos</span>
              <span className="text-slate-400 text-[11px] font-mono">Crédito Fiscal</span>
            </div>
            <div className="text-xl font-bold font-mono text-slate-100">
              S/ {taxSummary.totalPurchasesPEN.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-800/80 flex justify-between">
            <span>Crédito Fiscal (IGV):</span>
            <span className="font-mono text-slate-300">S/ {taxSummary.creditoFiscalIgv.toFixed(2)}</span>
          </div>
        </div>

        {/* Card 3: Liquidación Estimada del IGV */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Liquidación IGV SUNAT</span>
              <span
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                  taxSummary.igvPorPagar > 0
                    ? "bg-amber-950 text-amber-400 border border-amber-800/40"
                    : "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                )}
              >
                {taxSummary.igvPorPagar > 0 ? "A Pagar" : "A Favor"}
              </span>
            </div>
            <div
              className={cn(
                "text-xl font-bold font-mono",
                taxSummary.igvPorPagar > 0 ? "text-amber-400" : "text-emerald-400"
              )}
            >
              S/{" "}
              {(taxSummary.igvPorPagar > 0 ? taxSummary.igvPorPagar : taxSummary.saldoAFavor).toLocaleString("es-PE", {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-800/80">
            {taxSummary.igvPorPagar > 0
              ? "Impuesto por regularizar a fin de mes"
              : "Saldo acumulado a favor del contribuyente"}
          </div>
        </div>

        {/* Card 4: Ratio de Liquidez Corriente */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Ratio de Liquidez</span>
              <span className="text-[11px] font-mono text-indigo-400">Activo / Pasivo</span>
            </div>
            <div className="text-xl font-bold font-mono text-indigo-300">
              {financialRatios.currentLiquidity.toFixed(2)}x
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-800/80 flex justify-between">
            <span>Solvencia: {financialRatios.currentLiquidity >= 1.2 ? "Saludable" : "Ajustada"}</span>
            <span>Cap. Trabajo: S/ {financialRatios.workingCapitalPEN.toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 3. EVOLUCIÓN HISTÓRICA DE INGRESOS VS GASTOS (GRÁFICA COMPACTA)     */}
      {/* -------------------------------------------------------------------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-bold text-slate-100 tracking-tight">
              Evolución Comparativa Mensual (Ingresos vs Gastos)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Historial de movimientos contables consolidados en Soles (PEN).
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-slate-300">Ventas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
              <span className="text-slate-300">Compras</span>
            </div>
          </div>
        </div>

        {/* Gráfica de Barras SVG Proporcional */}
        <div className="h-44 w-full flex items-end gap-3 pt-4 px-2">
          {monthlyTrends.map((trend, idx) => {
            const incomeHeight = Math.max(Math.round((trend.incomePEN / maxTrendIncome) * 100), 4);
            const expenseHeight = Math.max(Math.round((trend.expensePEN / maxTrendIncome) * 100), 4);

            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                <div className="w-full flex items-end justify-center gap-1.5 h-32">
                  <div
                    style={{ height: `${incomeHeight}%` }}
                    className="w-1/2 max-w-[16px] bg-emerald-500/80 group-hover:bg-emerald-400 rounded-t transition-all shadow-sm"
                    title={`Ventas ${trend.monthName}: S/ ${trend.incomePEN.toFixed(2)}`}
                  />
                  <div
                    style={{ height: `${expenseHeight}%` }}
                    className="w-1/2 max-w-[16px] bg-indigo-500/80 group-hover:bg-indigo-400 rounded-t transition-all shadow-sm"
                    title={`Compras ${trend.monthName}: S/ ${trend.expensePEN.toFixed(2)}`}
                  />
                </div>
                <span className="text-[10px] font-mono text-slate-400 group-hover:text-slate-200 transition-colors">
                  {trend.monthName}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 4. TOP CLIENTES Y TOP PROVEEDORES (CONTROL COMERCIAL / SPOT)        */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Proveedores */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              Principales Proveedores del Mes
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">Total Compras</span>
          </div>

          <div className="space-y-3 flex-1">
            {topSuppliers.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No hay compras registradas en este periodo.
              </div>
            ) : (
              topSuppliers.map((supp, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-850/60 hover:bg-slate-850 border border-slate-800 transition-colors text-xs"
                >
                  <div className="truncate max-w-[260px]">
                    <div className="font-semibold text-slate-200 truncate">{supp.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      RUC: {supp.ruc} • {supp.invoiceCount} comp.
                    </div>
                  </div>
                  <div className="text-right font-mono font-bold text-slate-200">
                    S/ {supp.totalPEN.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Clientes */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-400" />
              Principales Clientes del Mes
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">Total Ventas</span>
          </div>

          <div className="space-y-3 flex-1">
            {topClients.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No hay ventas registradas en este periodo.
              </div>
            ) : (
              topClients.map((client, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-850/60 hover:bg-slate-850 border border-slate-800 transition-colors text-xs"
                >
                  <div className="truncate max-w-[260px]">
                    <div className="font-semibold text-slate-200 truncate">{client.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      RUC: {client.ruc} • {client.invoiceCount} comp.
                    </div>
                  </div>
                  <div className="text-right font-mono font-bold text-emerald-400">
                    S/ {client.totalPEN.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
