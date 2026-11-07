"use client";

import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Plus,
  Scale,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Layers,
  X,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getColldLibroDiario,
  createColldManualAsiento,
  getColldDashboardMetrics,
  getColldAccounts,
  ManualAsientoLine,
} from "@/app/actions/colld";

export default function LibroDiarioPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompanyId, setActiveCompanyId] = useState("");
  const [accounts, setAccounts] = useState<any[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [glosa, setGlosa] = useState("ASIENTO DE AJUSTE Y CENTRALIZACION FIN DE MES");
  const [currency, setCurrency] = useState<"PEN" | "USD">("PEN");
  const [exchangeRate, setExchangeRate] = useState(3.782);
  const [lines, setLines] = useState<ManualAsientoLine[]>([
    { accountCode: "6311", debit: 1500.0, credit: 0, partyName: "TELEFONICA DEL PERU S.A.A." },
    { accountCode: "40111", debit: 270.0, credit: 0 },
    { accountCode: "4212", debit: 0, credit: 1770.0, partyName: "TELEFONICA DEL PERU S.A.A." },
  ]);

  const totalDebe = lines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
  const totalHaber = lines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebe - totalHaber) < 0.01;

  useEffect(() => {
    async function load() {
      setLoading(true);
      const metrics = await getColldDashboardMetrics();
      const compId = metrics.data?.company?.id || "";
      setActiveCompanyId(compId);

      if (compId) {
        const res = await getColldLibroDiario(compId);
        if (res.success && res.data) {
          setEntries(res.data);
        }
        const accs = await getColldAccounts(compId);
        if (accs.success && accs.data) {
          setAccounts(accs.data);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  function addLine() {
    setLines([...lines, { accountCode: "101", debit: 0, credit: 0 }]);
  }

  function removeLine(idx: number) {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== idx));
  }

  function updateLine(idx: number, field: keyof ManualAsientoLine, val: any) {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: val };
    setLines(updated);
  }

  async function handleSaveAsiento(e: React.FormEvent) {
    e.preventDefault();
    if (!isBalanced) {
      setErrorMsg("El asiento está descuadrado. El Total Debe debe ser exactamente igual al Total Haber.");
      return;
    }
    setErrorMsg("");
    setSaving(true);

    const res = await createColldManualAsiento(activeCompanyId, {
      date,
      glosa,
      currency,
      exchangeRate,
      lines,
    });

    if (res.success) {
      setIsModalOpen(false);
      const updated = await getColldLibroDiario(activeCompanyId);
      if (updated.success && updated.data) {
        setEntries(updated.data);
      }
    } else {
      setErrorMsg(res.error || "Error al guardar el asiento");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/60 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Libro Diario General
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              Partida Doble
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Visor oficial de asientos contables cronológicos con validación de balance en tiempo real
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Nuevo Asiento Manual
        </button>
      </div>

      {/* Asientos List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 text-center text-xs text-zinc-500">Cargando Libro Diario...</div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center rounded-xl border border-zinc-800/80 bg-zinc-900/30 text-zinc-500 text-xs">
            No hay asientos registrados en el Libro Diario para este periodo.
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden shadow-sm"
            >
              {/* Asiento Header Bar */}
              <div className="px-5 py-3.5 bg-zinc-900/90 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded border border-indigo-500/20">
                    Voucher #{entry.voucherNumber}
                  </span>
                  <span className="font-mono text-zinc-400 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                    {entry.date}
                  </span>
                  <span className="font-medium text-zinc-200">{entry.glosa}</span>
                </div>

                {/* Double Entry Balance Badge */}
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
                      entry.isBalanced
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    )}
                  >
                    {entry.isBalanced ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        Cuadrado (Debe == Haber)
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3 w-3" />
                        Descuadrado
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Asiento Details Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950/40 text-zinc-400 uppercase font-semibold text-[10px] tracking-wider border-b border-zinc-850">
                    <tr>
                      <th className="py-2.5 px-5">Cuenta Contable</th>
                      <th className="py-2.5 px-5">Referencia / Entidad</th>
                      <th className="py-2.5 px-5 text-right">Debe ({entry.currency})</th>
                      <th className="py-2.5 px-5 text-right">Haber ({entry.currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850/60 font-mono text-xs">
                    {entry.details.map((line: any) => (
                      <tr key={line.id} className="hover:bg-zinc-900/50 transition-colors">
                        <td className="py-2 px-5 font-semibold text-zinc-200">
                          {line.accountCode}
                        </td>
                        <td className="py-2 px-5 font-sans text-zinc-400">
                          {line.partyName || (line.docNumber ? `Doc ${line.docSeries}-${line.docNumber}` : "—")}
                        </td>
                        <td className="py-2 px-5 text-right text-emerald-400 font-medium">
                          {line.debit > 0 ? line.debit.toFixed(2) : "0.00"}
                        </td>
                        <td className="py-2 px-5 text-right text-sky-400 font-medium">
                          {line.credit > 0 ? line.credit.toFixed(2) : "0.00"}
                        </td>
                      </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="bg-zinc-950/60 font-bold border-t border-zinc-800">
                      <td colSpan={2} className="py-2.5 px-5 text-right text-zinc-400 font-sans uppercase text-[10px]">
                        Totales del Asiento
                      </td>
                      <td className="py-2.5 px-5 text-right text-emerald-300">
                        S/ {entry.sumDebit.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-5 text-right text-sky-300">
                        S/ {entry.sumCredit.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: NUEVO ASIENTO MANUAL                                          */}
      {/* -------------------------------------------------------------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-indigo-400" />
                <h2 className="text-sm font-semibold text-white">Nuevo Asiento Manual / Ajuste</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAsiento} className="p-6 overflow-y-auto space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Cabecera */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-zinc-400">Fecha del Asiento</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-zinc-400">Moneda</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as any)}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white"
                  >
                    <option value="PEN">PEN (Soles)</option>
                    <option value="USD">USD (Dólares)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-zinc-400">Tipo Cambio</label>
                  <input
                    type="number"
                    step="0.001"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 3.78)}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-400">Glosa General</label>
                <input
                  type="text"
                  required
                  value={glosa}
                  onChange={(e) => setGlosa(e.target.value)}
                  className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white"
                />
              </div>

              {/* Lines Table */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-zinc-300">Líneas del Asiento (Partida Doble)</span>
                  <button
                    type="button"
                    onClick={addLine}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Añadir Cuenta
                  </button>
                </div>

                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2 space-y-2">
                  {lines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-3">
                        <input
                          type="text"
                          placeholder="Cuenta (ej. 101)"
                          required
                          value={line.accountCode}
                          onChange={(e) => updateLine(idx, "accountCode", e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-xs text-white font-mono"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          placeholder="Entidad / Ref"
                          value={line.partyName || ""}
                          onChange={(e) => updateLine(idx, "partyName", e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-xs text-white"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Debe"
                          value={line.debit || ""}
                          onChange={(e) => updateLine(idx, "debit", parseFloat(e.target.value) || 0)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-xs text-emerald-400 font-mono text-right"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Haber"
                          value={line.credit || ""}
                          onChange={(e) => updateLine(idx, "credit", parseFloat(e.target.value) || 0)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-xs text-sky-400 font-mono text-right"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="text-zinc-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Validation Footer */}
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-zinc-400" />
                    <span>Total Debe: <strong className="text-emerald-400 font-mono">S/ {totalDebe.toFixed(2)}</strong></span>
                    <span className="text-zinc-600">|</span>
                    <span>Total Haber: <strong className="text-sky-400 font-mono">S/ {totalHaber.toFixed(2)}</strong></span>
                  </div>
                  <div>
                    {isBalanced ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Balanceado
                      </span>
                    ) : (
                      <span className="text-red-400 font-semibold">
                        Diferencia: S/ {Math.abs(totalDebe - totalHaber).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-850">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-md bg-zinc-900 text-zinc-400 border border-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !isBalanced}
                  className="px-5 py-2 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 disabled:opacity-50"
                >
                  {saving ? "Registrando..." : "Guardar Asiento en Diario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
