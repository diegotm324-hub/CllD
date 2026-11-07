"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  ChevronDown,
  Search,
  Plus,
  Check,
  LayoutDashboard,
  Receipt,
  BookOpen,
  DollarSign,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getColldEmpresas, switchActiveCompany } from "@/app/actions/colld";
import { NewCompanyModal } from "@/components/NewCompanyModal";

interface NavbarProps {
  activeCompany?: any;
  exchangeRate?: { buy: number; sell: number };
}

export function Navbar({ activeCompany: initialCompany, exchangeRate = { buy: 3.755, sell: 3.782 } }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [companies, setCompanies] = useState<any[]>([]);
  const [activeCompany, setActiveCompany] = useState<any>(initialCompany);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cargar empresas al montar
  useEffect(() => {
    async function load() {
      const res = await getColldEmpresas();
      if (res.success && res.data) {
        setCompanies(res.data);
        if (!activeCompany && res.data.length > 0) {
          const selected = res.data.find((c: any) => c.id === res.activeCompanyId) || res.data[0];
          setActiveCompany(selected);
        }
      }
    }
    load();
  }, []);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSelectCompany(company: any) {
    if (activeCompany?.id === company.id) {
      setIsOpen(false);
      return;
    }
    setSwitching(true);
    setActiveCompany(company);
    setIsOpen(false);

    await switchActiveCompany(company.id);
    router.refresh();
    setSwitching(false);
  }

  function handleCompanyCreated(newCompany: any) {
    setCompanies((prev) => [...prev, newCompany]);
    setActiveCompany(newCompany);
    router.refresh();
  }

  const filteredCompanies = companies.filter(
    (c) =>
      c.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.ruc.includes(searchTerm) ||
      (c.commercialName && c.commercialName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/comprobantes", label: "Comprobantes", icon: Receipt },
    { href: "/dashboard/libro-diario", label: "Libro Diario", icon: BookOpen },
    { href: "/dashboard/empresas", label: "Empresas", icon: Building2 },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 h-14 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md px-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Logo Brand */}
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="h-7 w-7 rounded-md bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center font-bold text-xs text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              cd
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-semibold text-sm tracking-tight text-white group-hover:text-indigo-400 transition-colors">
                colld
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-indigo-400 font-medium">
                Multi-RUC
              </span>
            </div>
          </Link>

          <span className="text-zinc-800">/</span>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150",
                    isActive
                      ? "bg-zinc-900 text-white shadow-sm border border-zinc-800"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", isActive ? "text-indigo-400" : "text-zinc-500")} />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Section: TC SUNAT & Multi-RUC Selector Dropdown */}
        <div className="flex items-center gap-3">
          {/* TC SUNAT Pill */}
          <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900/90 border border-zinc-800 text-[11px] font-mono text-zinc-300">
            <span className="text-zinc-500 uppercase font-sans text-[10px] font-semibold">TC SUNAT</span>
            <span className="text-emerald-400">C: {exchangeRate.buy.toFixed(3)}</span>
            <span className="text-zinc-700">|</span>
            <span className="text-sky-400">V: {exchangeRate.sell.toFixed(3)}</span>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* MULTI-RUC SELECTOR DROPDOWN (STRIPE / LINEAR STYLE)              */}
          {/* ---------------------------------------------------------------- */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-1.5 rounded-lg border text-xs transition-all duration-150",
                isOpen
                  ? "bg-zinc-900 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/10"
                  : "bg-zinc-900/80 border-zinc-800 hover:border-zinc-700 text-zinc-200"
              )}
            >
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <div className="flex flex-col text-left">
                <span className="font-semibold text-zinc-100 max-w-[180px] sm:max-w-[220px] truncate leading-tight">
                  {activeCompany ? `${activeCompany.ruc} - ${activeCompany.businessName}` : "Seleccionar Empresa"}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {activeCompany?.taxRegime ? `Régimen: ${activeCompany.taxRegime}` : "Gestión Contable"}
                </span>
              </div>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-zinc-400 transition-transform duration-200 ml-1",
                  isOpen ? "rotate-180 text-white" : ""
                )}
              />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Search Bar */}
                <div className="p-3 border-b border-zinc-850 bg-zinc-900/60">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Buscar por RUC o Razón Social..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Company List */}
                <div className="max-h-60 overflow-y-auto divide-y divide-zinc-900/80 p-1">
                  {filteredCompanies.length === 0 ? (
                    <div className="py-6 text-center text-xs text-zinc-500">
                      No se encontraron empresas para "{searchTerm}"
                    </div>
                  ) : (
                    filteredCompanies.map((comp) => {
                      const isSelected = activeCompany?.id === comp.id;
                      return (
                        <div
                          key={comp.id}
                          onClick={() => handleSelectCompany(comp)}
                          className={cn(
                            "flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors text-xs",
                            isSelected
                              ? "bg-indigo-600/10 text-white border border-indigo-500/20"
                              : "hover:bg-zinc-900 text-zinc-300"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={cn(
                                "h-7 w-7 rounded-md flex items-center justify-center font-bold text-[11px] shrink-0",
                                isSelected
                                  ? "bg-indigo-600 text-white"
                                  : "bg-zinc-850 text-zinc-400"
                              )}
                            >
                              <Building2 className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-white truncate text-xs">
                                {comp.businessName}
                              </p>
                              <p className="text-[11px] font-mono text-zinc-400">
                                RUC: <strong className="text-zinc-300">{comp.ruc}</strong>
                                <span className="ml-2 text-zinc-500">({comp.taxRegime})</span>
                              </p>
                            </div>
                          </div>

                          {isSelected && (
                            <Check className="h-4 w-4 text-indigo-400 shrink-0 ml-2" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer Option: + Agregar Nueva Empresa */}
                <div className="p-2 border-t border-zinc-850 bg-zinc-900/80">
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      setIsModalOpen(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    + Agregar nueva empresa / RUC
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Modal Nueva Empresa */}
      <NewCompanyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCompanyCreated={handleCompanyCreated}
      />
    </>
  );
}
