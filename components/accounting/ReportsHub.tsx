"use client";

import React, { useState, useEffect } from "react";
import Decimal from "decimal.js";
import {
  FileSpreadsheet,
  Download,
  Calendar,
  BookOpen,
  Layers,
  Sparkles,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import {
  TrialBalanceSummary,
  JournalEntryMovement,
  generatePleLibroDiario,
  generatePleLibroMayor,
} from "@/lib/accounting/reports";
import { ExchangeDifferenceCalculationResult } from "@/lib/accounting/exchangeDifference";
import {
  getReportDataAction,
  executeExchangeDifferenceClosingAction,
  exportTrialBalanceExcelAction,
} from "@/app/actions/reports";

type ReportTab = "TRIAL_BALANCE" | "JOURNAL" | "LEDGER" | "EXCHANGE_DIFF";

export interface ReportsHubProps {
  companyRuc?: string;
  companyName?: string;
}

export function ReportsHub({
  companyRuc = "10746979636",
  companyName = "CONTRIBUYENTE RUC 10746979636 (SCABCASH)",
}: ReportsHubProps) {
  const [activeTab, setActiveTab] = useState<ReportTab>("TRIAL_BALANCE");
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(11);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Tasas de cambio de cierre (SUNAT / SBS)
  const [closingPurchaseTc, setClosingPurchaseTc] = useState("3.760");
  const [closingSaleTc, setClosingSaleTc] = useState("3.768");

  // Estados de datos
  const [isLoading, setIsLoading] = useState(false);
  const [movements, setMovements] = useState<JournalEntryMovement[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceSummary | null>(null);
  const [exchangeDiff, setExchangeDiff] = useState<ExchangeDifferenceCalculationResult | null>(null);

  // Estados de acciones
  const [isExecutingClosing, setIsExecutingClosing] = useState(false);
  const [closingSuccessMessage, setClosingSuccessMessage] = useState<string | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // Carga inicial y reactiva
  const loadReports = async () => {
    setIsLoading(true);
    setClosingSuccessMessage(null);
    try {
      const res = await getReportDataAction(
        year,
        month,
        parseFloat(closingPurchaseTc) || 3.76,
        parseFloat(closingSaleTc) || 3.768
      );
      if (res.success && res.trialBalance) {
        setMovements(res.movements || []);
        setTrialBalance(res.trialBalance);
        setExchangeDiff(res.exchangeDiff || null);
      }
    } catch (err) {
      console.error("Error al cargar reportes:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [year, month]);

  // Recalcular diferencia de cambio cuando se edita la tasa de cambio en pantalla
  const handleRecalculateExchange = () => {
    loadReports();
  };

  // Descarga del Balance de Comprobación en Excel profesional (.xlsx)
  const handleDownloadExcel = async () => {
    if (!trialBalance) return;
    setIsExportingExcel(true);
    try {
      const periodDesc = `${year}-${String(month).padStart(2, "0")}`;
      const res = await exportTrialBalanceExcelAction(
        companyName,
        companyRuc,
        periodDesc,
        trialBalance
      );

      if (res.success && "base64" in res && res.base64) {
        const byteCharacters = atob(res.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = res.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
      }
    } catch (err) {
      console.error("Error al exportar Excel:", err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Descarga de Libro Diario PLE 5.1
  const handleDownloadPleDiario = () => {
    if (movements.length === 0) return;
    const { fileName, content } = generatePleLibroDiario(companyRuc, year, month, movements);
    downloadTxtFile(fileName, content);
  };

  // Descarga de Libro Mayor PLE 6.1
  const handleDownloadPleMayor = () => {
    if (movements.length === 0) return;
    const { fileName, content } = generatePleLibroMayor(companyRuc, year, month, movements);
    downloadTxtFile(fileName, content);
  };

  const downloadTxtFile = (fileName: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  // Ejecución de cierre por Diferencia de Cambio
  const handleExecuteClosing = async () => {
    if (!exchangeDiff || exchangeDiff.generatedVoucherLines.length === 0) return;

    setIsExecutingClosing(true);
    setClosingSuccessMessage(null);

    try {
      const res = await executeExchangeDifferenceClosingAction({
        companyRuc,
        year,
        month,
        closingPurchaseRate: parseFloat(closingPurchaseTc),
        closingSaleRate: parseFloat(closingSaleTc),
        lines: exchangeDiff.generatedVoucherLines.map((l) => ({
          lineNumber: l.lineNumber,
          accountCode: l.accountCode,
          accountName: l.accountName || `Cuenta ${l.accountCode}`,
          glossary: l.glossary,
          debitPEN: Number(l.debitPEN || 0),
          creditPEN: Number(l.creditPEN || 0),
        })),
      });

      if (res.success && "voucherNumber" in res && res.voucherNumber) {
        setClosingSuccessMessage(
          `Asiento de Cierre generado con éxito bajo el correlativo N° ${res.voucherNumber} (Subdiario 35).`
        );
        loadReports();
      }
    } catch (err) {
      console.error("Error al ejecutar cierre:", err);
    } finally {
      setIsExecutingClosing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 p-6 overflow-hidden">
      {/* -------------------------------------------------------------------- */}
      {/* BARRA SUPERIOR: CONTROLES DEL PERIODO FISCAL Y PESTAÑAS              */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4 shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-mono px-2 py-0.5 rounded">
                PCGE 2026 • PLE 5.2
              </span>
              <h2 className="text-lg font-bold text-slate-100 tracking-tight">
                Reportes Financieros y Cierre Mensual
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Balance de Comprobación, Libros Oficiales PLE y Cierre por Diferencia de Cambio
            </p>
          </div>

          {/* Selector de Periodo */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value={2026} className="bg-slate-900">2026</option>
              <option value={2025} className="bg-slate-900">2025</option>
            </select>
            <span className="text-slate-600">/</span>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value={1} className="bg-slate-900">01 - Enero</option>
              <option value={2} className="bg-slate-900">02 - Febrero</option>
              <option value={3} className="bg-slate-900">03 - Marzo</option>
              <option value={4} className="bg-slate-900">04 - Abril</option>
              <option value={5} className="bg-slate-900">05 - Mayo</option>
              <option value={6} className="bg-slate-900">06 - Junio</option>
              <option value={7} className="bg-slate-900">07 - Julio</option>
              <option value={8} className="bg-slate-900">08 - Agosto</option>
              <option value={9} className="bg-slate-900">09 - Setiembre</option>
              <option value={10} className="bg-slate-900">10 - Octubre</option>
              <option value={11} className="bg-slate-900">11 - Noviembre</option>
              <option value={12} className="bg-slate-900">12 - Diciembre</option>
              <option value={13} className="bg-slate-900">13 - Cierre</option>
            </select>
          </div>
        </div>

        {/* Acciones de Exportación */}
        <div className="flex items-center gap-2">
          {activeTab === "TRIAL_BALANCE" && (
            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={isExportingExcel || !trialBalance}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-md shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {isExportingExcel ? "Generando Excel..." : "Descargar Excel (.xlsx)"}
            </button>
          )}

          {activeTab === "JOURNAL" && (
            <button
              type="button"
              onClick={handleDownloadPleDiario}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-md shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar PLE 5.1 (TXT)
            </button>
          )}

          {activeTab === "LEDGER" && (
            <button
              type="button"
              onClick={handleDownloadPleMayor}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-md shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar PLE 6.1 (TXT)
            </button>
          )}
        </div>
      </div>

      {/* Pestañas de Navegación de Reportes */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4 shrink-0 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab("TRIAL_BALANCE")}
          className={cn(
            "px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all",
            activeTab === "TRIAL_BALANCE"
              ? "bg-indigo-600 text-white shadow"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          )}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Balance de Comprobación (10 Col)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("JOURNAL")}
          className={cn(
            "px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all",
            activeTab === "JOURNAL"
              ? "bg-indigo-600 text-white shadow"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          )}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Libro Diario (PLE 5.1)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("LEDGER")}
          className={cn(
            "px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all",
            activeTab === "LEDGER"
              ? "bg-indigo-600 text-white shadow"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          )}
        >
          <Layers className="w-3.5 h-3.5" />
          Libro Mayor (PLE 6.1)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("EXCHANGE_DIFF")}
          className={cn(
            "px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all",
            activeTab === "EXCHANGE_DIFF"
              ? "bg-indigo-600 text-white shadow"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          )}
        >
          <DollarSign className="w-3.5 h-3.5 text-amber-400" />
          Ajuste Diferencia de Cambio
        </button>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* PESTAÑA 1: BALANCE DE COMPROBACIÓN (10 COLUMNAS)                     */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === "TRIAL_BALANCE" && trialBalance && (
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-xl">
          {/* Badge de Verificación del Cuadre de Utilidad */}
          <div className="px-5 py-2.5 bg-slate-850 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              {trialBalance.result.isBalanced ? (
                <div className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    HOJA DE TRABAJO CUADRADA: Utilidad del ejercicio de S/{" "}
                    {trialBalance.result.inventoryProfit.toFixed(2)} verificada en Inventario, Naturaleza y Función.
                  </span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-rose-400 font-semibold">
                  <AlertCircle className="w-4 h-4" />
                  <span>
                    DESCUADRE EN RESULTADOS: Inventario S/ {trialBalance.result.inventoryProfit.toFixed(2)} vs Naturaleza S/ {trialBalance.result.natureProfit.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            <span className="text-[11px] font-mono text-slate-400">
              {trialBalance.rows.length} cuentas registradas
            </span>
          </div>

          {/* Tabla de 10 Columnas */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-[10px] font-bold text-slate-300 uppercase tracking-wider sticky top-0 z-10 select-none border-b border-slate-800">
                <tr>
                  <th colSpan={2} className="py-2 px-3 border-r border-slate-800 bg-slate-900">
                    Cuenta Contable
                  </th>
                  <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-800 bg-indigo-950/40 text-indigo-300">
                    Sumas del Mayor
                  </th>
                  <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-800 bg-slate-850">
                    Saldos
                  </th>
                  <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-800 bg-amber-950/20 text-amber-300">
                    Transferencias
                  </th>
                  <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-800 bg-emerald-950/20 text-emerald-300">
                    Inventario / Balance
                  </th>
                  <th colSpan={2} className="py-2 px-3 text-center bg-blue-950/20 text-blue-300">
                    Resultados Naturaleza
                  </th>
                </tr>
                <tr className="border-b border-slate-800 text-[9px] text-slate-400 bg-slate-950/90 font-mono">
                  <th className="py-1.5 px-3 w-20">Código</th>
                  <th className="py-1.5 px-3 min-w-[180px] border-r border-slate-800">Denominación</th>
                  <th className="py-1.5 px-2 text-right w-24">Debe</th>
                  <th className="py-1.5 px-2 text-right w-24 border-r border-slate-800">Haber</th>
                  <th className="py-1.5 px-2 text-right w-24">Deudor</th>
                  <th className="py-1.5 px-2 text-right w-24 border-r border-slate-800">Acreedor</th>
                  <th className="py-1.5 px-2 text-right w-24">Debe</th>
                  <th className="py-1.5 px-2 text-right w-24 border-r border-slate-800">Haber</th>
                  <th className="py-1.5 px-2 text-right w-24">Activo</th>
                  <th className="py-1.5 px-2 text-right w-24 border-r border-slate-800">Pasivo</th>
                  <th className="py-1.5 px-2 text-right w-24">Pérdida</th>
                  <th className="py-1.5 px-2 text-right w-24">Ganancia</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-850 font-mono text-[11px]">
                {trialBalance.rows.map((r) => {
                  const isParent = r.accountCode.length <= 2;
                  return (
                    <tr
                      key={r.accountCode}
                      className={cn(
                        "hover:bg-slate-850/60 transition-colors",
                        isParent ? "bg-slate-900/60 font-semibold text-slate-100" : "text-slate-300"
                      )}
                    >
                      <td className="py-1.5 px-3 text-indigo-400">{r.accountCode}</td>
                      <td className="py-1.5 px-3 font-sans truncate max-w-[220px] border-r border-slate-800">
                        {r.accountName}
                      </td>
                      <td className="py-1.5 px-2 text-right">{r.debitSum ? r.debitSum.toFixed(2) : "—"}</td>
                      <td className="py-1.5 px-2 text-right border-r border-slate-800">{r.creditSum ? r.creditSum.toFixed(2) : "—"}</td>
                      <td className="py-1.5 px-2 text-right">{r.debitBalance ? r.debitBalance.toFixed(2) : "—"}</td>
                      <td className="py-1.5 px-2 text-right border-r border-slate-800">{r.creditBalance ? r.creditBalance.toFixed(2) : "—"}</td>
                      <td className="py-1.5 px-2 text-right text-amber-300">{r.transferDebit ? r.transferDebit.toFixed(2) : "—"}</td>
                      <td className="py-1.5 px-2 text-right border-r border-slate-800 text-amber-300">{r.transferCredit ? r.transferCredit.toFixed(2) : "—"}</td>
                      <td className="py-1.5 px-2 text-right text-emerald-300">{r.inventoryAsset ? r.inventoryAsset.toFixed(2) : "—"}</td>
                      <td className="py-1.5 px-2 text-right border-r border-slate-800 text-emerald-300">{r.inventoryLiability ? r.inventoryLiability.toFixed(2) : "—"}</td>
                      <td className="py-1.5 px-2 text-right text-rose-300">{r.natureLoss ? r.natureLoss.toFixed(2) : "—"}</td>
                      <td className="py-1.5 px-2 text-right text-blue-300">{r.natureGain ? r.natureGain.toFixed(2) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Fila de Totales */}
              <tfoot className="bg-slate-900 font-mono text-[11px] font-bold border-t-2 border-slate-700 sticky bottom-8">
                <tr className="bg-slate-900 border-b border-slate-800">
                  <td colSpan={2} className="py-2 px-3 border-r border-slate-800 font-sans uppercase">
                    Totales
                  </td>
                  <td className="py-2 px-2 text-right">{trialBalance.totals.debitSum.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right border-r border-slate-800">{trialBalance.totals.creditSum.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right">{trialBalance.totals.debitBalance.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right border-r border-slate-800">{trialBalance.totals.creditBalance.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right text-amber-400">{trialBalance.totals.transferDebit.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right border-r border-slate-800 text-amber-400">{trialBalance.totals.transferCredit.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right text-emerald-400">{trialBalance.totals.inventoryAsset.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right border-r border-slate-800 text-emerald-400">{trialBalance.totals.inventoryLiability.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right text-rose-400">{trialBalance.totals.natureLoss.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right text-blue-400">{trialBalance.totals.natureGain.toFixed(2)}</td>
                </tr>

                {/* Fila de Utilidad del Ejercicio */}
                <tr className="bg-slate-850 text-emerald-400">
                  <td colSpan={2} className="py-2 px-3 border-r border-slate-800 font-sans">
                    {trialBalance.result.inventoryProfit >= 0
                      ? "UTILIDAD DEL EJERCICIO"
                      : "PÉRDIDA DEL EJERCICIO"}
                  </td>
                  <td colSpan={2} className="py-2 px-2 text-right border-r border-slate-800 text-slate-500">—</td>
                  <td colSpan={2} className="py-2 px-2 text-right border-r border-slate-800 text-slate-500">—</td>
                  <td colSpan={2} className="py-2 px-2 text-right border-r border-slate-800 text-slate-500">—</td>
                  <td className="py-2 px-2 text-right">
                    {trialBalance.result.inventoryProfit < 0
                      ? Math.abs(trialBalance.result.inventoryProfit).toFixed(2)
                      : "—"}
                  </td>
                  <td className="py-2 px-2 text-right border-r border-slate-800 font-bold">
                    {trialBalance.result.inventoryProfit >= 0
                      ? trialBalance.result.inventoryProfit.toFixed(2)
                      : "—"}
                  </td>
                  <td className="py-2 px-2 text-right font-bold">
                    {trialBalance.result.natureProfit >= 0
                      ? trialBalance.result.natureProfit.toFixed(2)
                      : "—"}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {trialBalance.result.natureProfit < 0
                      ? Math.abs(trialBalance.result.natureProfit).toFixed(2)
                      : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* PESTAÑA 2: LIBRO DIARIO PLE 5.1                                      */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === "JOURNAL" && (
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-xl">
          <div className="px-5 py-3 border-b border-slate-800 bg-slate-850 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">
              Movimientos del Libro Diario • Periodo {year}-{String(month).padStart(2, "0")}
            </span>
            <span className="font-mono text-slate-400">{movements.length} líneas registradas</span>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky top-0 border-b border-slate-800 font-mono">
                <tr>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Subdiario</th>
                  <th className="py-2.5 px-3">Nro Asiento</th>
                  <th className="py-2.5 px-3">Cuenta PCGE</th>
                  <th className="py-2.5 px-3">Denominación</th>
                  <th className="py-2.5 px-3">Glosa Operación</th>
                  <th className="py-2.5 px-3 text-right">Debe (S/)</th>
                  <th className="py-2.5 px-3 text-right">Haber (S/)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 font-mono text-[11px]">
                {movements.map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-850/50 transition-colors">
                    <td className="py-2 px-3 text-slate-400">{m.date}</td>
                    <td className="py-2 px-3 text-indigo-400 font-bold">{m.subdiarioCode}</td>
                    <td className="py-2 px-3 text-slate-200">{m.voucherNumber}</td>
                    <td className="py-2 px-3 text-emerald-400 font-bold">{m.accountCode}</td>
                    <td className="py-2 px-3 font-sans truncate max-w-[200px] text-slate-300">
                      {m.accountName}
                    </td>
                    <td className="py-2 px-3 font-sans truncate max-w-[250px] text-slate-400">
                      {m.glossary}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-100">
                      {m.debitPEN ? m.debitPEN.toFixed(2) : "—"}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-100">
                      {m.creditPEN ? m.creditPEN.toFixed(2) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* PESTAÑA 3: LIBRO MAYOR PLE 6.1                                       */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === "LEDGER" && trialBalance && (
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-xl">
          <div className="px-5 py-3 border-b border-slate-800 bg-slate-850 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">
              Libro Mayor Consolidado • Periodo {year}-{String(month).padStart(2, "0")}
            </span>
            <span className="font-mono text-slate-400">Estructura PLE 6.1 SUNAT</span>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-4">
            {trialBalance.rows.map((row) => (
              <div
                key={row.accountCode}
                className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs"
              >
                <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-bold">
                      {row.accountCode}
                    </span>
                    <span className="font-sans font-semibold text-slate-200">
                      {row.accountName}
                    </span>
                  </div>
                  <span className="text-slate-400 text-[11px]">
                    Saldo {row.debitBalance > 0 ? "Deudor" : "Acreedor"}: S/{" "}
                    {(row.debitBalance || row.creditBalance).toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-900 p-2.5 rounded border border-slate-850 flex justify-between">
                    <span className="text-slate-400">Total Débitos (Debe):</span>
                    <span className="text-slate-100 font-bold">S/ {row.debitSum.toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded border border-slate-850 flex justify-between">
                    <span className="text-slate-400">Total Créditos (Haber):</span>
                    <span className="text-slate-100 font-bold">S/ {row.creditSum.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* PESTAÑA 4: AJUSTE POR DIFERENCIA DE CAMBIO (SUNAT / NIC 21)          */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === "EXCHANGE_DIFF" && exchangeDiff && (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
          {/* Panel Izquierdo: Cuentas Monetarias Evaluadas */}
          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-5 overflow-y-auto flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 mb-4 gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 tracking-tight flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-amber-400" />
                    Evaluación de Cuentas Monetarias en Moneda Extranjera (USD)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Norma SUNAT / NIC 21 • TC Venta para Activos (10, 12, 16) y TC Compra para Pasivos (42, 46)
                  </p>
                </div>

                {/* Parámetros de TC Cierre */}
                <div className="flex items-center gap-3 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 block">TC Compra (Pasivos)</span>
                    <input
                      type="number"
                      step="0.001"
                      value={closingPurchaseTc}
                      onChange={(e) => setClosingPurchaseTc(e.target.value)}
                      onBlur={handleRecalculateExchange}
                      className="w-16 bg-transparent text-emerald-400 font-bold focus:outline-none"
                    />
                  </div>
                  <div className="border-l border-slate-800 pl-3">
                    <span className="text-[10px] text-slate-500 block">TC Venta (Activos)</span>
                    <input
                      type="number"
                      step="0.001"
                      value={closingSaleTc}
                      onChange={(e) => setClosingSaleTc(e.target.value)}
                      onBlur={handleRecalculateExchange}
                      className="w-16 bg-transparent text-emerald-400 font-bold focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {closingSuccessMessage && (
                <div className="mb-4 bg-emerald-950/70 border border-emerald-500/40 rounded-lg p-3 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{closingSuccessMessage}</span>
                </div>
              )}

              {/* Lista de Cuentas Monetarias */}
              <div className="space-y-3">
                {exchangeDiff.accounts.map((acc) => (
                  <div
                    key={acc.accountCode}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-indigo-400">{acc.accountCode}</span>
                        <span className="font-sans font-medium text-slate-200">
                          {acc.accountName}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-sans">
                          {acc.accountType}
                        </span>
                      </div>

                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[11px] font-bold font-sans",
                          acc.adjustmentType === "GANANCIA"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                            : acc.adjustmentType === "PERDIDA"
                            ? "bg-rose-950 text-rose-400 border border-rose-800/40"
                            : "bg-slate-800 text-slate-400"
                        )}
                      >
                        {acc.adjustmentType}: S/ {Math.abs(acc.differencePEN).toFixed(2)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-850">
                      <div>
                        <span className="block text-[10px] text-slate-500">Saldo USD:</span>
                        <span className="text-slate-200 font-semibold">$ {acc.balanceUSD.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500">TC Aplicado:</span>
                        <span className="text-emerald-400 font-semibold">{acc.closingExchangeRate.toFixed(3)}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500">Saldo Histórico:</span>
                        <span className="text-slate-300">S/ {acc.recordedBalancePEN.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500">Saldo Ajustado:</span>
                        <span className="text-slate-100 font-bold">S/ {acc.adjustedBalancePEN.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Resumen Final */}
            <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
              <div className="space-x-4">
                <span className="text-emerald-400 font-semibold">
                  Ganancia Total (776): S/ {exchangeDiff.totalGainPEN.toFixed(2)}
                </span>
                <span className="text-rose-400 font-semibold">
                  Pérdida Total (676): S/ {exchangeDiff.totalLossPEN.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Panel Derecho: Asiento de Regularización a Generar */}
          <div className="w-full lg:w-[450px] bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Asiento de Cierre (Subdiario 35)
                  </h3>
                </div>
                <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800/50 px-2 py-0.5 rounded font-mono">
                  Automático
                </span>
              </div>

              {exchangeDiff.generatedVoucherLines.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-xs">
                  No hay diferencias de cambio pendientes de regularización.
                </div>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {exchangeDiff.generatedVoucherLines.map((line) => (
                    <div
                      key={line.lineNumber}
                      className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs font-mono"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-indigo-400">{line.accountCode}</span>
                        <span className="font-semibold text-slate-200">
                          {new Decimal(line.debitPEN).gt(0)
                            ? `D: S/ ${new Decimal(line.debitPEN).toFixed(2)}`
                            : `H: S/ ${new Decimal(line.creditPEN).toFixed(2)}`}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {line.accountName}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Botón de Ejecución del Asiento */}
            <div className="pt-4 border-t border-slate-800 mt-4">
              <button
                type="button"
                onClick={handleExecuteClosing}
                disabled={isExecutingClosing || exchangeDiff.generatedVoucherLines.length === 0}
                className={cn(
                  "w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold shadow-lg transition-all active:scale-95",
                  exchangeDiff.generatedVoucherLines.length > 0 && !isExecutingClosing
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-indigo-950/50"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                )}
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                {isExecutingClosing
                  ? "Registrando Cierre..."
                  : "Ejecutar Cierre por Diferencia de Cambio"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
