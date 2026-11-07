"use client";

import React, { useState, useEffect } from "react";
import {
  Receipt,
  Plus,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getColldComprobantes, getColldDashboardMetrics } from "@/app/actions/colld";
import { ModalInvoice } from "@/components/ModalInvoice";

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

  async function loadData() {
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

  useEffect(() => {
    loadData();
  }, []);

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
            Gestión de Facturas, Boletas y Notas con consulta en tiempo real a SUNAT y asientos automáticos PCGE
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

      {/* Floating Modal Invoice */}
      <ModalInvoice
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        activeCompanyId={activeCompanyId}
        onInvoiceCreated={loadData}
      />
    </div>
  );
}
