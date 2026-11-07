"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Plus,
  CheckCircle2,
  MapPin,
} from "lucide-react";
import { getColldEmpresas } from "@/app/actions/colld";
import { ModalNewCompany } from "@/components/ModalNewCompany";

export default function EmpresasPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  async function loadData() {
    setLoading(true);
    const res = await getColldEmpresas();
    if (res.success && res.data) {
      setCompanies(res.data);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

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
            Administración centralizada con consulta y validación automática de RUC ante SUNAT
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
                    {comp._count?.accounts || 10} Cuentas Activas
                  </span>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-zinc-500 flex items-center gap-1.5 truncate">
                <MapPin className="h-3 w-3 shrink-0 text-zinc-600" />
                <span className="truncate">{comp.address || comp.legalAddress || "Domicilio fiscal declarado"}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal con Autocompletado SUNAT */}
      <ModalNewCompany
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCompanyCreated={loadData}
      />
    </div>
  );
}
