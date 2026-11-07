"use client";

import React, { useState } from "react";
import { Building2, X, CheckCircle2, AlertCircle } from "lucide-react";
import { createColldEmpresa } from "@/app/actions/colld";

interface NewCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompanyCreated: (company: any) => void;
}

export function NewCompanyModal({ isOpen, onClose, onCompanyCreated }: NewCompanyModalProps) {
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState({
    ruc: "",
    businessName: "",
    commercialName: "",
    taxRegime: "MYPE_TRIBUTARIO" as any,
    address: "",
    currency: "PEN" as "PEN" | "USD",
  });

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    const rucClean = form.ruc.trim();
    if (rucClean.length !== 11) {
      setErrorMsg("El RUC debe tener exactamente 11 dígitos numéricos.");
      return;
    }

    setSaving(true);
    const res = await createColldEmpresa({
      ...form,
      ruc: rucClean,
    });

    if (res.success && res.company) {
      onCompanyCreated(res.company);
      onClose();
      // Reset form
      setForm({
        ruc: "",
        businessName: "",
        commercialName: "",
        taxRegime: "MYPE_TRIBUTARIO",
        address: "",
        currency: "PEN",
      });
    } else {
      setErrorMsg(res.error || "Error al crear la empresa");
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Agregar Nueva Empresa / RUC</h2>
              <p className="text-[11px] text-zinc-400">Asigna un nuevo contribuyente a tu panel de contador</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* RUC */}
          <div>
            <label className="text-[11px] font-medium text-zinc-400">
              RUC del Contribuyente <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={11}
              value={form.ruc}
              onChange={(e) => setForm({ ...form, ruc: e.target.value.replace(/\D/g, "") })}
              placeholder="Ej. 20601234567"
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Razón Social */}
          <div>
            <label className="text-[11px] font-medium text-zinc-400">
              Razón Social según Ficha RUC <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              placeholder="Ej. COMERCIAL ANDINA S.A.C."
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Nombre Comercial */}
          <div>
            <label className="text-[11px] font-medium text-zinc-400">Nombre Comercial (Opcional)</label>
            <input
              type="text"
              value={form.commercialName}
              onChange={(e) => setForm({ ...form, commercialName: e.target.value })}
              placeholder="Ej. GRUPO ANDINA"
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Régimen Tributario */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-zinc-400">Régimen Tributario</label>
              <select
                value={form.taxRegime}
                onChange={(e) => setForm({ ...form, taxRegime: e.target.value })}
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="MYPE_TRIBUTARIO">MYPE Tributario</option>
                <option value="ESPECIAL_RER">Especial (RER)</option>
                <option value="GENERAL">Régimen General</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-400">Moneda Base</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value as any })}
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="PEN">PEN (Soles - S/)</option>
                <option value="USD">USD (Dólares - $)</option>
              </select>
            </div>
          </div>

          {/* Domicilio Fiscal */}
          <div>
            <label className="text-[11px] font-medium text-zinc-400">Domicilio Fiscal (Opcional)</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Av. Principal 123, San Isidro, Lima"
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* PCGE Notice */}
          <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              Se inicializará automáticamente el Plan Contable oficial PCGE (Caja 101, Bancos 104, Clientes 121, IGV 40111, Proveedores 421, Compras 601, Ventas 701) para este RUC.
            </span>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-md bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              {saving ? "Registrando e Inicializando..." : "Registrar Empresa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
