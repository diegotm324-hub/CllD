"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Building2,
  Calendar,
  ChevronDown,
  Lock,
  Unlock,
  Check,
  ShieldCheck,
  Layers,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/lib/context/CompanyContext";
import { PeriodStatus } from "@prisma/client";

const MONTHS = [
  { value: 0, label: "00 - Apertura" },
  { value: 1, label: "01 - Enero" },
  { value: 2, label: "02 - Febrero" },
  { value: 3, label: "03 - Marzo" },
  { value: 4, label: "04 - Abril" },
  { value: 5, label: "05 - Mayo" },
  { value: 6, label: "06 - Junio" },
  { value: 7, label: "07 - Julio" },
  { value: 8, label: "08 - Agosto" },
  { value: 9, label: "09 - Setiembre" },
  { value: 10, label: "10 - Octubre" },
  { value: 11, label: "11 - Noviembre" },
  { value: 12, label: "12 - Diciembre" },
  { value: 13, label: "13 - Cierre Anual" },
];

export function CompanySwitcher() {
  const {
    companies,
    activeCompany,
    setActiveCompany,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    periodStatus,
    isPeriodLocked,
    togglePeriodLock,
  } = useCompany();

  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCompanyDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex items-center gap-3 select-none">
      {/* -------------------------------------------------------------------- */}
      {/* 1. SELECTOR DESPLEGABLE DE EMPRESA ACTIVA                           */}
      {/* -------------------------------------------------------------------- */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-slate-100 transition-all text-left shadow-sm"
        >
          <div className="h-7 w-7 rounded-md bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
            <Building2 className="w-4 h-4 text-indigo-400" />
          </div>

          <div className="max-w-[200px] truncate">
            <span className="block text-xs font-semibold text-slate-100 truncate">
              {activeCompany.businessName}
            </span>
            <span className="block text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
              <span>RUC: {activeCompany.ruc}</span>
              <span className="text-[9px] text-emerald-400 font-semibold">• Vinculado SOL</span>
            </span>
          </div>

          <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1 shrink-0" />
        </button>

        {isCompanyDropdownOpen && (
          <div className="absolute left-0 top-full mt-1.5 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 text-xs">
            <div className="px-3 py-1.5 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Empresas Vinculadas ({companies.length})</span>
              <span className="text-[9px] bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-800/40 font-mono">
                Clave SOL
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1 py-1">
              {companies.map((comp) => {
                const isSelected = comp.id === activeCompany.id;
                return (
                  <button
                    key={comp.id}
                    type="button"
                    onClick={() => {
                      setActiveCompany(comp);
                      setIsCompanyDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full text-left p-2 rounded-lg flex items-center justify-between transition-colors",
                      isSelected
                        ? "bg-indigo-600/20 border border-indigo-500/30 text-indigo-200"
                        : "hover:bg-slate-800 text-slate-300"
                    )}
                  >
                    <div className="truncate mr-2">
                      <span className="font-semibold block truncate text-slate-100 text-xs">
                        {comp.businessName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        RUC: {comp.ruc} • {comp.taxRegime}
                      </span>
                    </div>

                    {isSelected && <Check className="w-4 h-4 text-indigo-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 2. SELECTOR DE EJERCICIO Y PERIODO FISCAL                            */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono">
        <Calendar className="w-3.5 h-3.5 text-indigo-400" />

        {/* Año */}
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
          className="bg-transparent text-slate-200 font-semibold focus:outline-none cursor-pointer"
        >
          <option value={2026} className="bg-slate-900">2026</option>
          <option value={2025} className="bg-slate-900">2025</option>
          <option value={2024} className="bg-slate-900">2024</option>
        </select>

        <span className="text-slate-600">/</span>

        {/* Mes */}
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
          className="bg-transparent text-slate-200 font-semibold focus:outline-none cursor-pointer"
        >
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value} className="bg-slate-900">
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 3. BADGE DE ESTADO DEL PERIODO Y BOTÓN DE BLOQUEO                   */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex items-center gap-2">
        {isPeriodLocked ? (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-950/70 border border-rose-500/40 rounded-full text-rose-300 text-[11px] font-semibold"
            title="Periodo cerrado contable y tributariamente ante SUNAT"
          >
            <Lock className="w-3 h-3 text-rose-400" />
            <span>Bloqueado</span>
          </div>
        ) : (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/70 border border-emerald-500/40 rounded-full text-emerald-300 text-[11px] font-semibold"
            title="Periodo abierto: Permite registro y modificación de asientos"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Abierto</span>
          </div>
        )}

        {/* Botón de alternancia de bloqueo para Administrador / Contador */}
        <button
          type="button"
          onClick={togglePeriodLock}
          className={cn(
            "p-1.5 rounded-md border transition-all text-xs active:scale-95",
            isPeriodLocked
              ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
              : "bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-rose-400 border-slate-800"
          )}
          title={
            isPeriodLocked
              ? "Reabrir periodo para ajustes contables"
              : "Bloquear periodo (evita modificaciones post-declaración SUNAT)"
          }
        >
          {isPeriodLocked ? (
            <Unlock className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-slate-400" />
          )}
        </button>
      </div>
    </div>
  );
}
