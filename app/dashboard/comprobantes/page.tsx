"use client";

import React, { useState, useEffect } from "react";
import {
  Receipt,
  Plus,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getColldComprobantes,
  createColldComprobante,
  getColldDashboardMetrics,
} from "@/app/actions/colld";

export default function ComprobantesPage() {
  const [comprobantes, setComprobantes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompanyId, setActiveCompanyId] = useState<string>("");

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL"); // ALL, VENTA, COMPRA
  const [filterDoc, setFilterDoc] = useState<string>("ALL"); // ALL, 01, 03
  const [filterCurrency, setFilterCurrency] = useState<string>("ALL"); // ALL, PEN, USD

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    operationType: "VENTA" as "VENTA" | "COMPRA",
    docType: "01" as "01" | "03",
    docSeries: "F001",
    docNumber: "0001",
    partyRuc: "20100070970",
    partyName: "SUPERMERCADOS PERUANOS S.A.",
    date: new Date().toISOString().split("T")[0],
    currency: "PEN" as "PEN" | "USD",
    exchangeRate: 3.782,
    baseAmount: 1000.0,
    generateAccountingEntry: true,
  });

  const base = Number(form.baseAmount) || 0;
  const igv = Math.round(base * 0.18 * 100) / 100;
  const total = Math.round((base + igv) * 100) / 100;

  useEffect(() => {
    async function load() {
      setLoading(true);
      const metricsRes = await getColldDashboardMetrics();
      const compId = metricsRes.data?.company?.id || "";
      setActiveCompanyId(compId);

      if (compId) {
        const res = await getColldComprobantes(compId);
        if (res.success && res.data) {
          setComprobantes(res.data);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompanyId) return;

    setSaving(true);
    const res = await createColldComprobante(activeCompanyId, form);
    if (res.success) {
      setIsModalOpen(false);
      // Recargar tabla
      const updated = await getColldComprobantes(activeCompanyId);
      if (updated.success && updated.data) {
        setComprobantes(updated.data);
      }
    } else {
      alert("Error al guardar comprobante: " + res.error);
    }
    setSaving(false);
  }

  // Filtrado de comprobantes
  const filtered = comprobantes.filter((item) => {
    const matchesSearch =
      item.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.partyRuc.includes(searchTerm) ||
      item.docNumber.includes(searchTerm);

    const matchesOp = filterType === "ALL" || item.operationType === filterType;
    const matchesDoc = filterDoc === "ALL" || item.docType === filterDoc;
    const matchesCur = filterCurrency === "ALL" || item.currency === filterCurrency;

    return matchesSearch && matchesOp && matchesDoc && matchesCur;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/60 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Registro de Comprobantes
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
              Ventas & Compras
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Gestión de Facturas, Boletas y Notas con provisión y asientos automáticos PCGE
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Nuevo Comprobante
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por RUC, Razón Social o Serie/Número..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-9 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Operación */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Todas las Operaciones</option>
            <option value="VENTA">Solo Ventas</option>
            <option value="COMPRA">Solo Compras</option>
          </select>

          {/* Tipo Doc */}
          <select
            value={filterDoc}
            onChange={(e) => setFilterDoc(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Todos los Tipos</option>
            <option value="01">01 Factura</option>
            <option value="03">03 Boleta</option>
          </select>

          {/* Moneda */}
          <select
            value={filterCurrency}
            onChange={(e) => setFilterCurrency(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Todas las Monedas</option>
            <option value="PEN">PEN (S/)</option>
            <option value="USD">USD ($)</option>
          </select>
        </div>
      </div>

      {/* Comprobantes Table */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-semibold tracking-wider uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Operación</th>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Comprobante</th>
                <th className="py-3 px-4">Entidad (RUC / Razón Social)</th>
                <th className="py-3 px-4 text-right">Base Imponible</th>
                <th className="py-3 px-4 text-right">IGV (18%)</th>
                <th className="py-3 px-4 text-right">Importe Total</th>
                <th className="py-3 px-4 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850 text-zinc-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-500">
                    Cargando comprobantes...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    No se encontraron comprobantes registrados en este periodo.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-900/60 transition-colors">
                    <td className="py-3 px-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          item.operationType === "VENTA"
                            ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                            : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                        )}
                      >
                        {item.operationType === "VENTA" ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownLeft className="h-3 w-3" />
                        )}
                        {item.operationType}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-400">{item.date}</td>
                    <td className="py-3 px-4 font-mono font-medium text-white">
                      {item.docType === "01" ? "FAC" : "BOL"} {item.docSeries}-{item.docNumber}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-zinc-200 truncate max-w-[200px]">{item.partyName}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">RUC: {item.partyRuc}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-300">
                      {item.currency === "USD" ? "$ " : "S/ "}
                      {item.baseAmount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-400">
                      {item.currency === "USD" ? "$ " : "S/ "}
                      {item.igvAmount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white">
                      {item.currency === "USD" ? "$ " : "S/ "}
                      {item.totalAmount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Asentado
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* FLOATING MODAL: NUEVO COMPROBANTE                                    */}
      {/* -------------------------------------------------------------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-indigo-400" />
                <h2 className="text-sm font-semibold text-white">Nuevo Comprobante de Pago</h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Operación Selector */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, operationType: "VENTA", docSeries: "F001" })}
                  className={cn(
                    "py-2 text-xs font-semibold rounded-lg border transition-all flex items-center justify-center gap-2",
                    form.operationType === "VENTA"
                      ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850"
                  )}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Registro de Ventas (RVIE)
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, operationType: "COMPRA", docSeries: "E001" })}
                  className={cn(
                    "py-2 text-xs font-semibold rounded-lg border transition-all flex items-center justify-center gap-2",
                    form.operationType === "COMPRA"
                      ? "bg-sky-600/20 border-sky-500 text-sky-300"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850"
                  )}
                >
                  <ArrowDownLeft className="h-3.5 w-3.5" />
                  Registro de Compras (RCE)
                </button>
              </div>

              {/* Document Details Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-zinc-400">Tipo Doc</label>
                  <select
                    value={form.docType}
                    onChange={(e) => setForm({ ...form, docType: e.target.value as any })}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="01">01 - Factura</option>
                    <option value="03">03 - Boleta</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-zinc-400">Serie</label>
                  <input
                    type="text"
                    required
                    value={form.docSeries}
                    onChange={(e) => setForm({ ...form, docSeries: e.target.value.toUpperCase() })}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white uppercase font-mono focus:outline-none focus:border-indigo-500"
                    placeholder="F001"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-zinc-400">Número</label>
                  <input
                    type="text"
                    required
                    value={form.docNumber}
                    onChange={(e) => setForm({ ...form, docNumber: e.target.value })}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    placeholder="0000123"
                  />
                </div>
              </div>

              {/* RUC y Razón Social */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-zinc-400">RUC Entidad</label>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    value={form.partyRuc}
                    onChange={(e) => setForm({ ...form, partyRuc: e.target.value })}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    placeholder="20..."
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] font-medium text-zinc-400">Razón Social</label>
                  <input
                    type="text"
                    required
                    value={form.partyName}
                    onChange={(e) => setForm({ ...form, partyName: e.target.value })}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    placeholder="Empresa o Cliente S.A.C."
                  />
                </div>
              </div>

              {/* Fecha y Moneda */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-zinc-400">Fecha Emisión</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-zinc-400">Moneda</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value as any })}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="PEN">PEN (S/)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-zinc-400">Tipo Cambio</label>
                  <input
                    type="number"
                    step="0.001"
                    value={form.exchangeRate}
                    onChange={(e) => setForm({ ...form, exchangeRate: parseFloat(e.target.value) || 3.78 })}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Importes y Cálculos Automáticos */}
              <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-zinc-400">Base Imponible</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={form.baseAmount}
                      onChange={(e) => setForm({ ...form, baseAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-md px-3 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-zinc-400">IGV (18%)</label>
                    <div className="w-full mt-1 bg-zinc-950/50 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-300 font-mono">
                      S/ {igv.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-zinc-400">Importe Total</label>
                    <div className="w-full mt-1 bg-indigo-500/10 border border-indigo-500/30 rounded-md px-3 py-1.5 text-xs text-indigo-300 font-mono font-bold">
                      S/ {total.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Checkbox Asiento Automático */}
                <div className="pt-2 border-t border-zinc-800 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="autoEntry"
                    checked={form.generateAccountingEntry}
                    onChange={(e) => setForm({ ...form, generateAccountingEntry: e.target.checked })}
                    className="mt-0.5 rounded border-zinc-700 text-indigo-600 focus:ring-0 bg-zinc-950 cursor-pointer"
                  />
                  <label htmlFor="autoEntry" className="text-xs text-zinc-300 cursor-pointer select-none">
                    <span className="font-medium text-white">Generar asiento contable automático en Libro Diario</span>
                    <p className="text-[11px] text-zinc-500">
                      {form.operationType === "VENTA"
                        ? "121 Clientes (Debe) vs 40111 IGV (Haber) + 70111 Ventas (Haber)"
                        : "6011 Mercaderías (Debe) + 40111 IGV (Debe) vs 421 Proveedores (Haber) con amarre de destino 20111 / 6111"}
                    </p>
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-md bg-zinc-900 hover:bg-zinc-850 text-zinc-400 border border-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50"
                >
                  {saving ? "Registrando..." : "Guardar Comprobante y Asentar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
