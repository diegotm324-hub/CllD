"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Building2,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Search,
  ShieldCheck,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createColldEmpresa } from "@/app/actions/colld";

interface ModalNewCompanyProps {
  isOpen: boolean;
  onClose: () => void;
  onCompanyCreated?: (company: any) => void;
}

export function ModalNewCompany({ isOpen, onClose, onCompanyCreated }: ModalNewCompanyProps) {
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [form, setForm] = useState({
    ruc: "",
    businessName: "",
    commercialName: "",
    taxRegime: "MYPE_TRIBUTARIO" as "ESPECIAL_RER" | "MYPE_TRIBUTARIO" | "GENERAL",
    address: "",
    currency: "PEN" as "PEN" | "USD",
  });

  const [sunatStatus, setSunatStatus] = useState<{
    searched: boolean;
    estado: string;
    condicion: string;
    isActivo: boolean;
    isHabido: boolean;
  } | null>(null);

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Consulta automática con debounce al llegar a 11 dígitos
  useEffect(() => {
    const cleanRuc = form.ruc.trim();
    if (cleanRuc.length === 11 && /^(10|20|15|17)\d{9}$/.test(cleanRuc)) {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
      debounceTimeout.current = setTimeout(() => {
        handleLookupRuc(cleanRuc);
      }, 350);
    } else {
      setSunatStatus(null);
    }
    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [form.ruc]);

  async function handleLookupRuc(rucToSearch?: string) {
    const rucVal = rucToSearch || form.ruc.trim();
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
          businessName: d.razonSocial || prev.businessName,
          commercialName: d.nombreComercial || prev.commercialName || "",
          address: d.direccionCompleta || d.direccion || prev.address,
        }));

        setSunatStatus({
          searched: true,
          estado: d.estado || "ACTIVO",
          condicion: d.condicion || "HABIDO",
          isActivo: d.isActivo !== false && d.estado === "ACTIVO",
          isHabido: d.isHabido !== false && d.condicion === "HABIDO",
        });
      } else {
        setErrorMsg(json.error || "No se pudo consultar el RUC en SUNAT.");
      }
    } catch (e) {
      console.error("Error consultando RUC:", e);
    } finally {
      setSearching(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    const rucClean = form.ruc.trim();
    if (rucClean.length !== 11) {
      setErrorMsg("El RUC debe tener exactamente 11 dígitos numéricos.");
      return;
    }

    if (sunatStatus && !sunatStatus.isActivo) {
      if (!confirm("Atención: El contribuyente figura en estado de BAJA en SUNAT. ¿Deseas continuar?")) {
        return;
      }
    }

    setSaving(true);
    const res = await createColldEmpresa({
      ...form,
      ruc: rucClean,
    });

    if (res.success && res.company) {
      if (onCompanyCreated) onCompanyCreated(res.company);
      onClose();
      // Reset
      setForm({
        ruc: "",
        businessName: "",
        commercialName: "",
        taxRegime: "MYPE_TRIBUTARIO",
        address: "",
        currency: "PEN",
      });
      setSunatStatus(null);
    } else {
      setErrorMsg(res.error || "Error al crear la empresa");
    }
    setSaving(false);
  }

  if (!isOpen) return null;

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
              <p className="text-[11px] text-zinc-400">Consulta y validación oficial en tiempo real con SUNAT</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* RUC con Búsqueda y Spinner */}
          <div>
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-medium text-zinc-400">
                RUC del Contribuyente (11 dígitos) <span className="text-red-400">*</span>
              </label>
              {sunatStatus && (
                <div className="flex items-center gap-1.5 text-[10px] font-semibold">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full border flex items-center gap-1",
                      sunatStatus.isActivo && sunatStatus.isHabido
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    )}
                  >
                    {sunatStatus.isActivo && sunatStatus.isHabido ? (
                      <Check className="h-2.5 w-2.5" />
                    ) : (
                      <AlertTriangle className="h-2.5 w-2.5" />
                    )}
                    {sunatStatus.estado} — {sunatStatus.condicion}
                  </span>
                </div>
              )}
            </div>

            <div className="relative mt-1">
              <input
                type="text"
                required
                maxLength={11}
                value={form.ruc}
                onChange={(e) => setForm({ ...form, ruc: e.target.value.replace(/\D/g, "") })}
                placeholder="Ej. 20601234567"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md pl-3 pr-24 py-1.5 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => handleLookupRuc()}
                disabled={searching || form.ruc.length !== 11}
                className="absolute right-1 top-1 bottom-1 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40"
              >
                {searching ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
                    <span>SUNAT...</span>
                  </>
                ) : (
                  <>
                    <Search className="h-3 w-3" />
                    <span>Consultar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Razón Social */}
          <div>
            <label className="text-[11px] font-medium text-zinc-400">
              Razón Social (Oficial SUNAT) <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              placeholder="Autocompletado con consulta SUNAT..."
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
              placeholder="Ej. GRUPO COMERCIAL"
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Régimen Tributario (3 opciones exactas) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-zinc-400">Régimen Tributario</label>
              <select
                value={form.taxRegime}
                onChange={(e) => setForm({ ...form, taxRegime: e.target.value as any })}
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="MYPE_TRIBUTARIO">Régimen MYPE Tributario (RMT)</option>
                <option value="ESPECIAL_RER">Régimen Especial (RER)</option>
                <option value="GENERAL">Régimen General (RG)</option>
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
            <label className="text-[11px] font-medium text-zinc-400">Dirección Fiscal Declarada</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Dirección obtenida de SUNAT..."
              className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* PCGE Notice */}
          <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              Al crear la empresa, se inicializarán automáticamente las cuentas maestras del PCGE (101, 104, 121, 40111, 421, 601, 701) y quedará como empresa activa.
            </span>
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
              disabled={saving || searching}
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
