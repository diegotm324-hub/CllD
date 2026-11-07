"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Receipt,
  DollarSign,
  Scale,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  BookOpen,
  Building2,
  Calendar,
  Sparkles,
} from "lucide-react";
import { getColldDashboardMetrics } from "@/app/actions/colld";
import { NewCompanyModal } from "@/components/NewCompanyModal";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    async function loadMetrics() {
      setLoading(true);
      const res = await getColldDashboardMetrics();
      if (res.success && res.data) {
        setMetrics(res.data);
      }
      setLoading(false);
    }
    loadMetrics();
  }, []);

  const hasCompany = metrics?.hasCompany !== false && !!metrics?.company;
  const totalSales = metrics?.totalSales || 0;
  const totalPurchases = metrics?.totalPurchases || 0;
  const fiscalCredit = metrics?.fiscalCreditIgv || 0;
  const tc = metrics?.exchangeRate || { buy: 3.755, sell: 3.782 };
  const monthlyFlow = metrics?.monthlyFlow || [];

  const maxVal = Math.max(
    ...monthlyFlow.map((m: any) => Math.max(m.ventas, m.compras)),
    1000
  );

  // Pantalla de Bienvenida si no hay empresas registradas
  if (!loading && !hasCompany) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-lg mx-auto animate-in fade-in duration-300">
        <div className="h-16 w-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6 shadow-xl shadow-indigo-600/10">
          <Building2 className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Bienvenido a colld
        </h2>
        <p className="text-sm text-zinc-400 mt-2">
          Tu sistema contable multi-empresa y bimoneda en la nube. Para comenzar a emitir comprobantes y generar tu Libro Diario oficial, registra tu primer RUC.
        </p>
        <button
          onClick={() => setIsModalOpen(true)}
          className="mt-6 flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-105"
        >
          <Plus className="h-4 w-4" />
          Registrar Mi Primera Empresa / RUC
        </button>

        <NewCompanyModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onCompanyCreated={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* -------------------------------------------------------------------- */}
      {/* HEADER SECTION                                                       */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/60 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Dashboard Contable
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              Periodo 2026-11
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Métricas financieras y tributarias para{" "}
            <span className="text-zinc-200 font-medium">
              {metrics?.company?.businessName || "Empresa Activa"}
            </span>{" "}
            (RUC <strong className="text-white font-mono">{metrics?.company?.ruc}</strong> - {metrics?.company?.taxRegime})
          </p>
        </div>

        {/* Quick Action Shortcuts */}
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/comprobantes"
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo Comprobante
          </Link>
          <Link
            href="/dashboard/libro-diario"
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5 text-zinc-400" />
            Libro Diario
          </Link>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* METRIC CARDS (STRIPE / LINEAR STATS)                                 */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Ventas */}
        <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 shadow-sm relative overflow-hidden group hover:border-zinc-700/80 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Total Ventas (Mes)</span>
            <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-white font-mono">
              S/ {totalSales.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-emerald-400">
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>Ventas netas facturadas</span>
            </div>
          </div>
        </div>

        {/* Total Compras */}
        <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 shadow-sm relative overflow-hidden group hover:border-zinc-700/80 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Total Compras (Mes)</span>
            <div className="p-1.5 rounded-md bg-sky-500/10 text-sky-400">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-white font-mono">
              S/ {totalPurchases.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-zinc-400">
              <span>Gastos con crédito fiscal</span>
            </div>
          </div>
        </div>

        {/* IGV / Crédito Fiscal */}
        <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 shadow-sm relative overflow-hidden group hover:border-zinc-700/80 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">IGV Estimado SUNAT</span>
            <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400">
              <Scale className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-white font-mono">
              S/ {Math.abs(fiscalCredit).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
              {fiscalCredit >= 0 ? (
                <span className="text-amber-400 font-medium">IGV a Pagar (Mes 11)</span>
              ) : (
                <span className="text-emerald-400 font-medium">Saldo a Favor (Crédito)</span>
              )}
            </div>
          </div>
        </div>

        {/* Tipo de Cambio SUNAT */}
        <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 shadow-sm relative overflow-hidden group hover:border-zinc-700/80 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Tipo de Cambio Oficial</span>
            <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-4 font-mono">
            <div>
              <div className="text-xs text-zinc-500 font-sans">Compra</div>
              <div className="text-xl font-bold text-emerald-400">
                S/ {tc.buy.toFixed(3)}
              </div>
            </div>
            <div className="text-zinc-700 font-sans">|</div>
            <div>
              <div className="text-xs text-zinc-500 font-sans">Venta</div>
              <div className="text-xl font-bold text-sky-400">
                S/ {tc.sell.toFixed(3)}
              </div>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-zinc-500">
            Fuente oficial SUNAT / SBS al día
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* COMPARATIVE MONTHLY CHART (COMPRAS VS VENTAS)                        */}
      {/* -------------------------------------------------------------------- */}
      <div className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800/80 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-white tracking-tight">
              Flujo Mensual Comparativo (Ventas vs. Compras)
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Evolución acumulada en Soles (PEN) para {metrics?.company?.businessName}
            </p>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm bg-indigo-500"></div>
              <span className="text-zinc-300">Ventas (701)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm bg-sky-500"></div>
              <span className="text-zinc-300">Compras (601)</span>
            </div>
          </div>
        </div>

        {/* Visual Bar Chart */}
        <div className="pt-4 pb-2 grid grid-cols-6 gap-3 sm:gap-6 items-end h-64 border-b border-zinc-800/80">
          {monthlyFlow.map((item: any, idx: number) => {
            const hVentas = maxVal > 0 ? Math.min(100, Math.round((item.ventas / maxVal) * 100)) : 0;
            const hCompras = maxVal > 0 ? Math.min(100, Math.round((item.compras / maxVal) * 100)) : 0;

            return (
              <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end group">
                <div className="w-full flex items-end justify-center gap-1.5 h-full">
                  <div
                    style={{ height: `${Math.max(4, hVentas)}%` }}
                    className="w-1/2 max-w-[28px] bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-md relative transition-all duration-300 group-hover:brightness-110"
                    title={`Ventas: S/ ${item.ventas.toLocaleString()}`}
                  ></div>
                  <div
                    style={{ height: `${Math.max(4, hCompras)}%` }}
                    className="w-1/2 max-w-[28px] bg-gradient-to-t from-sky-600 to-sky-400 rounded-t-md relative transition-all duration-300 group-hover:brightness-110"
                    title={`Compras: S/ ${item.compras.toLocaleString()}`}
                  ></div>
                </div>
                <span className="text-[11px] font-medium text-zinc-400 group-hover:text-white transition-colors">
                  {item.month}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center text-xs text-zinc-500 font-mono">
          <span>Aislamiento 100% garantizado por RUC</span>
          <span>Actualizado en tiempo real</span>
        </div>
      </div>
    </div>
  );
}
