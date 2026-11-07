"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Plus,
  ShieldCheck,
  CheckCircle2,
  X,
  Briefcase,
  Layers,
  MapPin,
  Calendar,
} from "lucide-react";
import { getColldEmpresas, createColldEmpresa } from "@/app/actions/colld";

export default function EmpresasPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [form, setForm] = useState({
    ruc: "",
    businessName: "",
    commercialName: "",
    taxRegime: "MYPE_TRIBUTARIO" as "MYPE_TRIBUTARIO" | "ESPECIAL_RER" | "GENERAL" | "NUEVO_RUS",
    address: "",
    currency: "PEN" as "PEN" | "USD",
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await getColldEmpresas();
      if (res.success && res.data) {
        setCompanies(res.data);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    if (!form.ruc || form.ruc.length !== 11) {
      setErrorMsg("El RUC debe tener exactamente 11 dígitos.");
      return;
    }

    setSaving(true);
    const res = await createColldEmpresa(form);
    if (res.success) {
      setIsModalOpen(false);
      setForm({
        ruc: "",
        businessName: "",
        commercialName: "",
        taxRegime: "MYPE_TRIBUTARIO",
        address: "",
        currency: "PEN",
      });
      // Recargar lista
      const updated = await getColldEmpresas();
      if (updated.success && updated.data) {
        setCompanies(updated.data);
      }
    } else {
      setErrorMsg(res.error || "Error al crear la empresa");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/60 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Gestión de Empresas
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
              Multi-Tenant
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Administración centralizada de contribuyentes, razones sociales y configuración contable SUNAT
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Registrar Nueva Empresa
        </button>
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-3 py-12 text-center text-xs text-zinc-500">
            Cargando empresas registradas...
          </div>
        ) : companies.length === 0 ? (
          <div className="col-span-3 p-12 text-center rounded-xl border border-zinc-800 bg-zinc-900/30 text-zinc-500 text-xs">
            No hay empresas registradas aún. Haz clic en "Registrar Nueva Empresa".
          </div>
        ) : (
          companies.map((comp) => (
            <div
              key={comp.id}
              className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5 space-y-4 shadow-sm hover:border-zinc-700 transition-all relative overflow-hidden group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                      {comp.businessName}
                    </h3>
                    <p className="text-xs font-mono text-zinc-400">RUC: {comp.ruc}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Activa
                </span>
              </div>

              {/* Badges & Meta */}
              <div className="space-y-1.5 text-xs text-zinc-400 pt-2 border-t border-zinc-800/60">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Régimen:</span>
                  <span className="font-medium text-zinc-200">
                    {comp.taxRegime.replace("_", " ")}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Moneda Base:</span>
                  <span className="font-mono text-zinc-200">{comp.currency}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Cuentas PCGE:</span>
                  <span className="font-mono text-indigo-400">
                    {comp._count?.accountPlans || 10} Cuentas Activas
                  </span>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-zinc-500 flex items-center gap-1.5 truncate">
                <MapPin className="h-3 w-3 shrink-0 text-zinc-600" />
                <span className="truncate">{comp.address || comp.legalAddress || "Domicilio fiscal"}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: REGISTRAR NUEVA EMPRESA                                       */}
      {/* -------------------------------------------------------------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-400" />
                <h2 className="text-sm font-semibold text-white">Registrar Nueva Empresa</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                  {errorMsg}
                </div>
              )}

              {/* RUC */}
              <div>
                <label className="text-[11px] font-medium text-zinc-400">RUC de la Empresa (11 dígitos)</label>
                <input
                  type="text"
                  required
                  maxLength={11}
                  value={form.ruc}
                  onChange={(e) => setForm({ ...form, ruc: e.target.value.replace(/\D/g, "") })}
                  placeholder="20123456789"
                  className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Razón Social */}
              <div>
                <label className="text-[11px] font-medium text-zinc-400">Razón Social</label>
                <input
                  type="text"
                  required
                  value={form.businessName}
                  onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                  placeholder="COMERCIALIZADORA DEL PERU S.A.C."
                  className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Nombre Comercial */}
              <div>
                <label className="text-[11px] font-medium text-zinc-400">Nombre Comercial (Opcional)</label>
                <input
                  type="text"
                  value={form.commercialName}
                  onChange={(e) => setForm({ ...form, commercialName: e.target.value })}
                  placeholder="GRUPO COMERCIAL"
                  className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Régimen Tributario y Moneda */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-zinc-400">Régimen Tributario</label>
                  <select
                    value={form.taxRegime}
                    onChange={(e) => setForm({ ...form, taxRegime: e.target.value as any })}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="MYPE_TRIBUTARIO">MYPE Tributario</option>
                    <option value="ESPECIAL_RER">Especial (RER)</option>
                    <option value="GENERAL">Régimen General</option>
                    <option value="NUEVO_RUS">Nuevo RUS</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-zinc-400">Moneda Base</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value as any })}
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="PEN">PEN (Soles)</option>
                    <option value="USD">USD (Dólares)</option>
                  </select>
                </div>
              </div>

              {/* Domicilio Fiscal */}
              <div>
                <label className="text-[11px] font-medium text-zinc-400">Domicilio Fiscal</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="AV. JAVIER PRADO ESTE 1234, SAN ISIDRO, LIMA"
                  className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* PCGE Notice */}
              <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Al crear la empresa, se inicializará automáticamente el Plan Contable PCGE oficial con cuentas 101, 104, 121, 40111, 421, 6011, 70111 y sus amarres.</span>
              </div>

              {/* Buttons */}
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
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 disabled:opacity-50"
                >
                  {saving ? "Creando e Inicializando..." : "Crear Empresa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
