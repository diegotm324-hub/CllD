"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Receipt,
  X,
  Search,
  Loader2,
  Check,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createColldComprobante } from "@/app/actions/colld";

interface ModalInvoiceProps {
  isOpen: boolean;
  onClose: () => void;
  activeCompanyId: string;
  onInvoiceCreated?: () => void;
}

export function ModalInvoice({
  isOpen,
  onClose,
  activeCompanyId,
  onInvoiceCreated,
}: ModalInvoiceProps) {
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [form, setForm] = useState({
    operationType: "VENTA" as "VENTA" | "COMPRA",
    docType: "01" as "01" | "03",
    docSeries: "F001",
    docNumber: "0001",
    partyRuc: "",
    partyName: "",
    date: new Date().toISOString().split("T")[0],
    currency: "PEN" as "PEN" | "USD",
    exchangeRate: 3.782,
    baseAmount: 1000.0,
    generateAccountingEntry: true,
  });

  const [sunatStatus, setSunatStatus] = useState<{
    searched: boolean;
    estado: string;
    condicion: string;
    isActivo: boolean;
    isHabido: boolean;
  } | null>(null);

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Autoconsulta de RUC al llegar a 11 dígitos
  useEffect(() => {
    const cleanRuc = form.partyRuc.trim();
    if (cleanRuc.length === 11 && /^(10|20|15|17)\d{9}$/.test(cleanRuc)) {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
      debounceTimeout.current = setTimeout(() => {
        handleLookupPartyRuc(cleanRuc);
      }, 350);
    } else {
      setSunatStatus(null);
    }
    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [form.partyRuc]);

  async function handleLookupPartyRuc(rucToSearch?: string) {
    const rucVal = rucToSearch || form.partyRuc.trim();
    if (rucVal.length !== 11) return;

    setSearching(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/sunat/ruc?ruc=${encodeURIComponent(rucVal)}`);
      const json = await res.json();

      if (json.success && json.data) {
        const d = json.data;
        setForm((prev) => ({
          ...prev,
          partyName: d.razonSocial || prev.partyName,
        }));

        setSunatStatus({
          searched: true,
          estado: d.estado || "ACTIVO",
          condicion: d.condicion || "HABIDO",
          isActivo: d.isActivo !== false && d.estado === "ACTIVO",
          isHabido: d.isHabido !== false && d.condicion === "HABIDO",
        });

        if (d.estado !== "ACTIVO") {
          setErrorMsg(`Atención SUNAT: El contribuyente ${d.razonSocial} se encuentra en estado de ${d.estado}. No se permite emitir o deducir comprobantes.`);
        }
      } else {
        setErrorMsg(json.error || "RUC no encontrado en el padrón de SUNAT.");
      }
    } catch (e) {
      console.error("Error consultando RUC de entidad:", e);
    } finally {
      setSearching(false);
    }
  }

  const base = Number(form.baseAmount) || 0;
  const igv = Math.round(base * 0.18 * 100) / 100;
  const total = Math.round((base + igv) * 100) / 100;

  // Bloqueo de emisión si está en estado de BAJA
  const isBlockedBySunat = sunatStatus?.searched && !sunatStatus.isActivo;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompanyId) {
      setErrorMsg("No hay empresa activa seleccionada.");
      return;
    }

    if (isBlockedBySunat) {
      setErrorMsg("Emisión bloqueada: No se pueden registrar comprobantes de contribuyentes en estado de BAJA ante SUNAT.");
      return;
    }

    setSaving(true);
    const res = await createColldComprobante(activeCompanyId, form);
    if (res.success) {
      if (onInvoiceCreated) onInvoiceCreated();
      onClose();
      // Reset form
      setForm({
        operationType: "VENTA",
        docType: "01",
        docSeries: "F001",
        docNumber: "0001",
        partyRuc: "",
        partyName: "",
        date: new Date().toISOString().split("T")[0],
        currency: "PEN",
        exchangeRate: 3.782,
        baseAmount: 1000.0,
        generateAccountingEntry: true,
      });
      setSunatStatus(null);
    } else {
      setErrorMsg(res.error || "Error al registrar comprobante");
    }
    setSaving(false);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400">
              <Receipt className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Nuevo Comprobante de Pago</h2>
              <p className="text-[11px] text-zinc-400">Emisión y registro con validación en vivo SUNAT</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {errorMsg && (
            <div
              className={cn(
                "p-3 rounded-lg border text-xs flex items-center gap-2",
                isBlockedBySunat
                  ? "bg-red-500/15 border-red-500/40 text-red-200 font-medium"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-300"
              )}
            >
              {isBlockedBySunat ? <ShieldAlert className="h-4 w-4 text-red-400 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Operación Selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, operationType: "VENTA", docSeries: "F001" })}
              className={cn(
                "py-2 text-xs font-semibold rounded-lg border transition-all flex items-center justify-center gap-2",
                form.operationType === "VENTA"
                  ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm"
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
                  ? "bg-sky-600/20 border-sky-500 text-sky-300 shadow-sm"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850"
              )}
            >
              <ArrowDownLeft className="h-3.5 w-3.5" />
              Registro de Compras (RCE)
            </button>
          </div>

          {/* Document Series & Correlativo */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-medium text-zinc-400">Tipo Doc</label>
              <select
                value={form.docType}
                onChange={(e) => setForm({ ...form, docType: e.target.value as any })}
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="01">01 - Factura Electrónica</option>
                <option value="03">03 - Boleta de Venta</option>
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

          {/* RUC con Autoconsulta SUNAT */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-medium text-zinc-400">
                  {form.operationType === "VENTA" ? "RUC Cliente" : "RUC Proveedor"}
                </label>
              </div>
              <div className="relative mt-1">
                <input
                  type="text"
                  required
                  maxLength={11}
                  value={form.partyRuc}
                  onChange={(e) => setForm({ ...form, partyRuc: e.target.value.replace(/\D/g, "") })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-md pl-3 pr-8 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  placeholder="20..."
                />
                <div className="absolute right-2 top-2">
                  {searching ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                  ) : sunatStatus?.isActivo ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : null}
                </div>
              </div>
            </div>

            <div className="col-span-2">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-medium text-zinc-400">
                  Razón Social / Denominación
                </label>
                {sunatStatus && (
                  <span
                    className={cn(
                      "text-[9px] font-bold px-1.5 py-0.2 rounded border",
                      sunatStatus.isActivo && sunatStatus.isHabido
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-red-500/15 text-red-400 border-red-500/30"
                    )}
                  >
                    {sunatStatus.estado} — {sunatStatus.condicion}
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                value={form.partyName}
                onChange={(e) => setForm({ ...form, partyName: e.target.value })}
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                placeholder="Autocompletado con RUC..."
              />
            </div>
          </div>

          {/* Fecha, Moneda y TC */}
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
              <label className="text-[11px] font-medium text-zinc-400">Tipo Cambio SUNAT</label>
              <input
                type="number"
                step="0.001"
                value={form.exchangeRate}
                onChange={(e) => setForm({ ...form, exchangeRate: parseFloat(e.target.value) || 3.782 })}
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Importes y Cálculos */}
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
                id="autoEntryInvoice"
                checked={form.generateAccountingEntry}
                onChange={(e) => setForm({ ...form, generateAccountingEntry: e.target.checked })}
                className="mt-0.5 rounded border-zinc-700 text-indigo-600 focus:ring-0 bg-zinc-950 cursor-pointer"
              />
              <label htmlFor="autoEntryInvoice" className="text-xs text-zinc-300 cursor-pointer select-none">
                <span className="font-medium text-white">Generar asiento contable automático en Libro Diario</span>
                <p className="text-[11px] text-zinc-500">
                  {form.operationType === "VENTA"
                    ? "121 Clientes (Debe) vs 40111 IGV (Haber) + 701 Ventas (Haber)"
                    : "601 Mercaderías (Debe) + 40111 IGV (Debe) vs 421 Proveedores (Haber)"}
                </p>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-md bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-850 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || searching || isBlockedBySunat}
              className={cn(
                "px-5 py-2 text-xs font-semibold rounded-md text-white shadow-md transition-all disabled:opacity-50",
                isBlockedBySunat
                  ? "bg-red-600/50 cursor-not-allowed text-zinc-300"
                  : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30"
              )}
            >
              {saving
                ? "Registrando..."
                : isBlockedBySunat
                ? "Bloqueado por SUNAT (Baja)"
                : "Guardar Comprobante y Asentar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
