"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  CompanyDto,
  FiscalPeriodDto,
  getCompaniesAction,
  getFiscalPeriodsAction,
  togglePeriodStatusAction,
} from "@/app/actions/periods";
import { PeriodStatus, TaxRegime } from "@prisma/client";

interface CompanyContextType {
  companies: CompanyDto[];
  activeCompany: CompanyDto;
  setActiveCompany: (company: CompanyDto) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  selectedMonth: number;
  setSelectedMonth: (month: number) => void;
  periodStatus: PeriodStatus;
  isPeriodLocked: boolean;
  togglePeriodLock: () => Promise<void>;
  isLoading: boolean;
}

const DEFAULT_COMPANY: CompanyDto = {
  id: "comp-sol-active",
  ruc: "10746979636",
  businessName: "CONTRIBUYENTE RUC 10746979636 (SCABCASH)",
  tradeName: "SCABCASH",
  taxRegime: TaxRegime.ESPECIAL_RER,
  legalAddress: "DOMICILIO FISCAL DECLARADO ANTE SUNAT",
};

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<CompanyDto[]>([DEFAULT_COMPANY]);
  const [activeCompany, setActiveCompanyState] = useState<CompanyDto>(DEFAULT_COMPANY);
  const [selectedYear, setSelectedYearState] = useState<number>(2026);
  const [selectedMonth, setSelectedMonthState] = useState<number>(11);
  const [periodStatus, setPeriodStatus] = useState<PeriodStatus>(PeriodStatus.ABIERTO);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Carga inicial de empresas y preferencias guardadas
  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const res = await getCompaniesAction();
        if (res.success && res.data.length > 0) {
          setCompanies(res.data);

          let initialCompany = res.data[0];
          if (typeof window !== "undefined") {
            const savedRuc = localStorage.getItem("contablepro_active_ruc");
            const found = res.data.find((c) => c.ruc === savedRuc);
            if (found) {
              initialCompany = found;
            } else {
              localStorage.setItem("contablepro_active_ruc", initialCompany.ruc);
            }
          }
          setActiveCompanyState(initialCompany);
        }

        if (typeof window !== "undefined") {
          const savedYear = localStorage.getItem("contablepro_active_year");
          const savedMonth = localStorage.getItem("contablepro_active_month");
          if (savedYear) setSelectedYearState(parseInt(savedYear, 10));
          if (savedMonth) setSelectedMonthState(parseInt(savedMonth, 10));
        }
      } catch (e) {
        console.warn("Fallo al inicializar CompanyContext:", e);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Sincronización reactiva del estado del periodo seleccionado
  const syncPeriodStatus = useCallback(async () => {
    if (!activeCompany?.id) return;
    try {
      const res = await getFiscalPeriodsAction(activeCompany.id, selectedYear);
      if (res.success && res.data) {
        const currentPeriod = res.data.find((p) => p.month === selectedMonth);
        if (currentPeriod) {
          setPeriodStatus(currentPeriod.status);
        } else {
          setPeriodStatus(PeriodStatus.ABIERTO);
        }
      }
    } catch (e) {
      console.warn("No se pudo sincronizar el estado del periodo:", e);
    }
  }, [activeCompany?.id, selectedYear, selectedMonth]);

  useEffect(() => {
    syncPeriodStatus();
  }, [syncPeriodStatus]);

  const setActiveCompany = (company: CompanyDto) => {
    setActiveCompanyState(company);
    if (typeof window !== "undefined") {
      localStorage.setItem("contablepro_active_ruc", company.ruc);
    }
  };

  const setSelectedYear = (y: number) => {
    setSelectedYearState(y);
    if (typeof window !== "undefined") {
      localStorage.setItem("contablepro_active_year", y.toString());
    }
  };

  const setSelectedMonth = (m: number) => {
    setSelectedMonthState(m);
    if (typeof window !== "undefined") {
      localStorage.setItem("contablepro_active_month", m.toString());
    }
  };

  // Bloqueo o Reapertura del Periodo Fiscal
  const togglePeriodLock = async () => {
    const nextStatus =
      periodStatus === PeriodStatus.ABIERTO ? PeriodStatus.BLOQUEADO : PeriodStatus.ABIERTO;

    try {
      const res = await togglePeriodStatusAction({
        companyId: activeCompany.id,
        year: selectedYear,
        month: selectedMonth,
        newStatus: nextStatus,
        userName: "CPC. Auditor Principal",
      });

      if (res.success && res.period) {
        setPeriodStatus(res.period.status);
      }
    } catch (e) {
      console.error("Error al alternar bloqueo de periodo:", e);
    }
  };

  const isPeriodLocked = periodStatus === PeriodStatus.BLOQUEADO || periodStatus === PeriodStatus.CERRADO;

  return (
    <CompanyContext.Provider
      value={{
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
        isLoading,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error("useCompany debe ser utilizado dentro de un CompanyProvider");
  }
  return context;
}
