"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import Decimal from "decimal.js";
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Sparkles,
  Save,
  ArrowRight,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  DollarSign,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import {
  VoucherLineInput,
  AccountDestinationConfig,
  validateDoubleEntry,
  generateAutoDestinations,
  validateRUC,
  convertCurrency,
  safeDecimal,
} from "@/lib/accounting/validator";

// ------------------------------------------------------------------------------
// CATÁLOGO BASE DE CUENTAS PCGE PARA DEMOSTRACIÓN Y AUTOCOMPLETADO
// ------------------------------------------------------------------------------
const DEFAULT_ACCOUNTS: AccountDestinationConfig[] = [
  {
    id: "acc-10111",
    code: "10111",
    name: "Caja - Moneda Nacional",
    allowsMovement: true,
    requiresEntity: false,
    requiresCostCenter: false,
    requiresDocRef: false,
    hasAutomaticDestination: false,
  },
  {
    id: "acc-10411",
    code: "10411",
    name: "Cuentas corrientes operativas - BCP Soles",
    allowsMovement: true,
    requiresEntity: true,
    requiresCostCenter: false,
    requiresDocRef: true,
    hasAutomaticDestination: false,
  },
  {
    id: "acc-12121",
    code: "12121",
    name: "Facturas por cobrar - Emitidas en cartera",
    allowsMovement: true,
    requiresEntity: true,
    requiresCostCenter: false,
    requiresDocRef: true,
    hasAutomaticDestination: false,
  },
  {
    id: "acc-40111",
    code: "40111",
    name: "IGV - Cuenta propia 18%",
    allowsMovement: true,
    requiresEntity: true,
    requiresCostCenter: false,
    requiresDocRef: true,
    hasAutomaticDestination: false,
  },
  {
    id: "acc-42121",
    code: "42121",
    name: "Facturas por pagar - Emitidas de proveedores",
    allowsMovement: true,
    requiresEntity: true,
    requiresCostCenter: false,
    requiresDocRef: true,
    hasAutomaticDestination: false,
  },
  {
    id: "acc-60111",
    code: "60111",
    name: "Mercaderías - Manufacturadas",
    allowsMovement: true,
    requiresEntity: true,
    requiresCostCenter: true,
    requiresDocRef: true,
    hasAutomaticDestination: true,
    destinationDebitAccountId: "acc-20111",
    destinationDebitAccountCode: "20111",
    destinationDebitAccountName: "Mercaderías Manufacturadas (Almacén)",
    destinationCreditAccountId: "acc-61111",
    destinationCreditAccountCode: "61111",
    destinationCreditAccountName: "Variación de Existencias - Mercaderías",
  },
  {
    id: "acc-63111",
    code: "63111",
    name: "Transporte de carga y encomiendas",
    allowsMovement: true,
    requiresEntity: true,
    requiresCostCenter: true,
    requiresDocRef: true,
    hasAutomaticDestination: true,
    destinationDebitAccountId: "acc-94111",
    destinationDebitAccountCode: "94111",
    destinationDebitAccountName: "Gastos de Administración",
    destinationCreditAccountId: "acc-79111",
    destinationCreditAccountCode: "79111",
    destinationCreditAccountName: "Cargas Imputables a Cuentas de Costos y Gastos",
  },
  {
    id: "acc-63211",
    code: "63211",
    name: "Asesoría contable y tributaria",
    allowsMovement: true,
    requiresEntity: true,
    requiresCostCenter: true,
    requiresDocRef: true,
    hasAutomaticDestination: true,
    destinationDebitAccountId: "acc-94111",
    destinationDebitAccountCode: "94111",
    destinationDebitAccountName: "Gastos de Administración",
    destinationCreditAccountId: "acc-79111",
    destinationCreditAccountCode: "79111",
    destinationCreditAccountName: "Cargas Imputables a Cuentas de Costos y Gastos",
  },
  {
    id: "acc-65611",
    code: "65611",
    name: "Suministros de oficina y computo",
    allowsMovement: true,
    requiresEntity: true,
    requiresCostCenter: true,
    requiresDocRef: true,
    hasAutomaticDestination: true,
    destinationDebitAccountId: "acc-94111",
    destinationDebitAccountCode: "94111",
    destinationDebitAccountName: "Gastos de Administración",
    destinationCreditAccountId: "acc-79111",
    destinationCreditAccountCode: "79111",
    destinationCreditAccountName: "Cargas Imputables a Cuentas de Costos y Gastos",
  },
  {
    id: "acc-70111",
    code: "70111",
    name: "Ventas de mercaderías al por mayor",
    allowsMovement: true,
    requiresEntity: true,
    requiresCostCenter: false,
    requiresDocRef: true,
    hasAutomaticDestination: false,
  },
  {
    id: "acc-79111",
    code: "79111",
    name: "Cargas imputables a cuentas de costos y gastos",
    allowsMovement: true,
    requiresEntity: false,
    requiresCostCenter: false,
    requiresDocRef: false,
    hasAutomaticDestination: false,
  },
  {
    id: "acc-94111",
    code: "94111",
    name: "Gastos de Administración",
    allowsMovement: true,
    requiresEntity: false,
    requiresCostCenter: true,
    requiresDocRef: false,
    hasAutomaticDestination: false,
  },
  {
    id: "acc-95111",
    code: "95111",
    name: "Gastos de Ventas",
    allowsMovement: true,
    requiresEntity: false,
    requiresCostCenter: true,
    requiresDocRef: false,
    hasAutomaticDestination: false,
  },
];

// Opciones de comprobantes de pago SUNAT Tabla 10
const SUNAT_DOC_TYPES = [
  { code: "FACTURA_01", label: "01 - Factura" },
  { code: "RECIBO_HONORARIOS_02", label: "02 - Recibo Honorarios" },
  { code: "BOLETA_03", label: "03 - Boleta de Venta" },
  { code: "NOTA_CREDITO_07", label: "07 - Nota de Crédito" },
  { code: "NOTA_DEBITO_08", label: "08 - Nota de Débito" },
  { code: "DOCUMENTO_BANCOS_13", label: "13 - Doc. Bancario" },
  { code: "SERVICIOS_PUBLICOS_14", label: "14 - Recibo Servicios" },
  { code: "OTROS_99", label: "99 - Otros" },
];

export interface VoucherGridProps {
  initialVoucherNumber?: string;
  initialDate?: string;
  exchangeRate?: number;
  companyRuc?: string;
  companyName?: string;
  onSave?: (voucherData: {
    header: Record<string, unknown>;
    items: VoucherLineInput[];
    validation: ReturnType<typeof validateDoubleEntry>;
  }) => Promise<void> | void;
}

export function VoucherGrid({
  initialVoucherNumber = "050001",
  initialDate = new Date().toISOString().split("T")[0],
  exchangeRate = 3.755,
  companyRuc = "10746979636",
  companyName = "CONTRIBUYENTE RUC 10746979636 (SCABCASH)",
  onSave,
}: VoucherGridProps) {
  // ----------------------------------------------------------------------------
  // ESTADO DE CABECERA DEL VOUCHER
  // ----------------------------------------------------------------------------
  const [subdiario, setSubdiario] = useState("05"); // 05 = Registro de Compras
  const [voucherNumber, setVoucherNumber] = useState(initialVoucherNumber);
  const [voucherDate, setVoucherDate] = useState(initialDate);
  const [currency, setCurrency] = useState<"PEN" | "USD">("PEN");
  const [tc, setTc] = useState(exchangeRate.toString());
  const [generalGlossary, setGeneralGlossary] = useState("PROVISIÓN FACTURA PROVEEDOR SERVICIOS");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ----------------------------------------------------------------------------
  // CATÁLOGO INDEXADO EN MAPA
  // ----------------------------------------------------------------------------
  const accountsCatalog = useMemo(() => {
    const map = new Map<string, AccountDestinationConfig>();
    DEFAULT_ACCOUNTS.forEach((acc) => {
      map.set(acc.id, acc);
      map.set(acc.code, acc);
    });
    return map;
  }, []);

  // ----------------------------------------------------------------------------
  // ESTADO DE LÍNEAS DEL ASIENTO (DETALLE)
  // Inicializamos con un asiento de compra típico con base imponible, IGV y cuenta por pagar
  // ----------------------------------------------------------------------------
  const [lines, setLines] = useState<VoucherLineInput[]>([
    {
      id: "row-1",
      lineNumber: 1,
      accountId: "acc-63111",
      accountCode: "63111",
      accountName: "Transporte de carga y encomiendas",
      entityDocNumber: "20100047218",
      costCenterCode: "ADM-01",
      docType: "FACTURA_01",
      docSeries: "F001",
      docNumber: "0004520",
      docDate: initialDate,
      glossary: "Servicio de flete y transporte",
      debitPEN: "1000.00",
      creditPEN: "0.00",
      debitUSD: "266.31",
      creditUSD: "0.00",
      isAutoDestination: false,
    },
    {
      id: "row-2",
      lineNumber: 2,
      accountId: "acc-40111",
      accountCode: "40111",
      accountName: "IGV - Cuenta propia 18%",
      entityDocNumber: "20100047218",
      costCenterCode: "",
      docType: "FACTURA_01",
      docSeries: "F001",
      docNumber: "0004520",
      docDate: initialDate,
      glossary: "IGV 18% F/F001-0004520",
      debitPEN: "180.00",
      creditPEN: "0.00",
      debitUSD: "47.94",
      creditUSD: "0.00",
      isAutoDestination: false,
    },
    {
      id: "row-3",
      lineNumber: 3,
      accountId: "acc-42121",
      accountCode: "42121",
      accountName: "Facturas por pagar - Emitidas de proveedores",
      entityDocNumber: "20100047218",
      costCenterCode: "",
      docType: "FACTURA_01",
      docSeries: "F001",
      docNumber: "0004520",
      docDate: initialDate,
      glossary: "Provisión F/F001-0004520",
      debitPEN: "0.00",
      creditPEN: "1180.00",
      debitUSD: "0.00",
      creditUSD: "314.25",
      isAutoDestination: false,
    },
  ]);

  // ----------------------------------------------------------------------------
  // GESTIÓN DE AUTOCOMPLETADO Y BÚSQUEDA RÁPIDA DE CUENTAS
  // ----------------------------------------------------------------------------
  const [activeAccountSearchIndex, setActiveAccountSearchIndex] = useState<number | null>(null);
  const [searchFilter, setSearchFilter] = useState("");

  const filteredAccounts = useMemo(() => {
    if (!searchFilter.trim()) return DEFAULT_ACCOUNTS.slice(0, 6);
    const q = searchFilter.toLowerCase();
    return DEFAULT_ACCOUNTS.filter(
      (a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    );
  }, [searchFilter]);

  // ----------------------------------------------------------------------------
  // MOTOR DE VALIDACIÓN EN TIEMPO REAL (MEMORIZADO CON DECIMAL.JS)
  // ----------------------------------------------------------------------------
  const validation = useMemo(() => {
    return validateDoubleEntry(lines, accountsCatalog);
  }, [lines, accountsCatalog]);

  // ----------------------------------------------------------------------------
  // REFERENCIAS DE ELEMENTOS PARA NAVEGACIÓN TIPO CONCAR POR TECLADO
  // ----------------------------------------------------------------------------
  const cellRefs = useRef<Map<string, HTMLInputElement | HTMLSelectElement>>(new Map());

  const registerCell = (rowIdx: number, colName: string) => (el: HTMLInputElement | HTMLSelectElement | null) => {
    const key = `${rowIdx}-${colName}`;
    if (el) {
      cellRefs.current.set(key, el);
    } else {
      cellRefs.current.delete(key);
    }
  };

  const focusCell = useCallback((rowIdx: number, colName: string) => {
    const key = `${rowIdx}-${colName}`;
    const el = cellRefs.current.get(key);
    if (el) {
      el.focus();
      if ("select" in el) {
        el.select();
      }
    }
  }, []);

  // Orden estricto de columnas editables para avance con tecla 'Enter'
  const EDITABLE_COLUMNS = [
    "accountCode",
    "entityDocNumber",
    "costCenterCode",
    "docType",
    "docSeries",
    "docNumber",
    "glossary",
    "debitPEN",
    "creditPEN",
    "debitUSD",
    "creditUSD",
  ];

  // ----------------------------------------------------------------------------
  // MANIPULACIÓN DE LÍNEAS
  // ----------------------------------------------------------------------------

  const handleAddLine = useCallback(() => {
    setLines((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${Math.random()}`,
        lineNumber: prev.length + 1,
        accountId: "",
        accountCode: "",
        accountName: "",
        entityDocNumber: "",
        costCenterCode: "",
        docType: "FACTURA_01",
        docSeries: "",
        docNumber: "",
        docDate: voucherDate,
        glossary: generalGlossary,
        debitPEN: "0.00",
        creditPEN: "0.00",
        debitUSD: "0.00",
        creditUSD: "0.00",
        isAutoDestination: false,
      },
    ]);

    // Enfocar la nueva línea en la siguiente iteración
    setTimeout(() => {
      focusCell(lines.length, "accountCode");
    }, 50);
  }, [lines.length, voucherDate, generalGlossary, focusCell]);

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    const newLines = lines
      .filter((_, idx) => idx !== index)
      .map((item, idx) => ({ ...item, lineNumber: idx + 1 }));
    setLines(newLines);
  };

  const handleLineChange = (index: number, field: keyof VoucherLineInput, value: string) => {
    setLines((prev) => {
      const updated = [...prev];
      const target = { ...updated[index], [field]: value };

      // Si cambia el código de cuenta, actualizar la descripción y reglas
      if (field === "accountCode") {
        const found = accountsCatalog.get(value.trim());
        if (found) {
          target.accountId = found.id;
          target.accountName = found.name;
        } else {
          target.accountName = "";
        }
      }

      // Sincronización automática de PEN a USD si se ingresa importe en Soles o viceversa
      const currentTc = safeDecimal(tc || 3.75);
      if (field === "debitPEN") {
        const val = safeDecimal(value);
        target.debitUSD = val.gt(0) && currentTc.gt(0)
          ? convertCurrency(val, currentTc, "PEN_TO_USD").toFixed(2)
          : "0.00";
        if (val.gt(0)) {
          target.creditPEN = "0.00";
          target.creditUSD = "0.00";
        }
      } else if (field === "creditPEN") {
        const val = safeDecimal(value);
        target.creditUSD = val.gt(0) && currentTc.gt(0)
          ? convertCurrency(val, currentTc, "PEN_TO_USD").toFixed(2)
          : "0.00";
        if (val.gt(0)) {
          target.debitPEN = "0.00";
          target.debitUSD = "0.00";
        }
      } else if (field === "debitUSD") {
        const val = safeDecimal(value);
        target.debitPEN = val.gt(0) && currentTc.gt(0)
          ? convertCurrency(val, currentTc, "USD_TO_PEN").toFixed(2)
          : "0.00";
        if (val.gt(0)) {
          target.creditPEN = "0.00";
          target.creditUSD = "0.00";
        }
      } else if (field === "creditUSD") {
        const val = safeDecimal(value);
        target.creditPEN = val.gt(0) && currentTc.gt(0)
          ? convertCurrency(val, currentTc, "USD_TO_PEN").toFixed(2)
          : "0.00";
        if (val.gt(0)) {
          target.debitPEN = "0.00";
          target.debitUSD = "0.00";
        }
      }

      updated[index] = target;
      return updated;
    });
  };

  // ----------------------------------------------------------------------------
  // ACCIÓN DE AMARRES AUTOMÁTICOS DE CLASE 6 A CLASE 9 / 79
  // ----------------------------------------------------------------------------
  const handleGenerateDestinations = () => {
    const result = generateAutoDestinations(lines, accountsCatalog);
    setLines(result.lines);
  };

  // ----------------------------------------------------------------------------
  // SELECCIONAR CUENTA DESDE EL DIÁLOGO RÁPIDO
  // ----------------------------------------------------------------------------
  const selectAccountForLine = (index: number, account: AccountDestinationConfig) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
      };
      return updated;
    });
    setActiveAccountSearchIndex(null);
    setSearchFilter("");
    focusCell(index, "entityDocNumber");
  };

  // ----------------------------------------------------------------------------
  // GESTIÓN DE TECLADO (ENTER PARA AVANZAR, FLECHAS PARA NAVEGAR)
  // ----------------------------------------------------------------------------
  const handleKeyDown = (
    e: React.KeyboardEvent,
    rowIdx: number,
    colName: string
  ) => {
    const colIdx = EDITABLE_COLUMNS.indexOf(colName);

    if (e.key === "Enter") {
      e.preventDefault();

      // Si estamos en la última columna de la fila
      if (colIdx === EDITABLE_COLUMNS.length - 1) {
        if (rowIdx === lines.length - 1) {
          // Agregar nueva fila y enfocar
          handleAddLine();
        } else {
          // Ir a la primera columna de la siguiente fila
          focusCell(rowIdx + 1, EDITABLE_COLUMNS[0]);
        }
      } else {
        // Ir a la siguiente columna
        focusCell(rowIdx, EDITABLE_COLUMNS[colIdx + 1]);
      }
    } else if (e.key === "ArrowDown" && rowIdx < lines.length - 1) {
      e.preventDefault();
      focusCell(rowIdx + 1, colName);
    } else if (e.key === "ArrowUp" && rowIdx > 0) {
      e.preventDefault();
      focusCell(rowIdx - 1, colName);
    } else if (e.key === "F2" && colName === "accountCode") {
      e.preventDefault();
      setActiveAccountSearchIndex(rowIdx);
      setSearchFilter(lines[rowIdx].accountCode || "");
    }
  };

  // ----------------------------------------------------------------------------
  // AUTO-BALANCEAR CON CONTRAPARTIDA
  // ----------------------------------------------------------------------------
  const handleAutoBalance = () => {
    if (validation.isBalanced) return;

    const diffPEN = validation.totalDebitPEN.minus(validation.totalCreditPEN);
    const diffUSD = validation.totalDebitUSD.minus(validation.totalCreditUSD);
    const currentTc = new Decimal(tc || 3.75);

    // Si el Debe es mayor al Haber, falta Haber
    const needsCredit = diffPEN.gt(0);
    const missingPEN = diffPEN.abs().toFixed(2);
    const missingUSD = diffUSD.abs().toFixed(2);

    setLines((prev) => [
      ...prev,
      {
        id: `row-balance-${Date.now()}`,
        lineNumber: prev.length + 1,
        accountId: "acc-10411",
        accountCode: "10411",
        accountName: "Cuentas corrientes operativas - BCP Soles",
        entityDocNumber: companyRuc,
        costCenterCode: "",
        docType: "DOCUMENTO_BANCOS_13",
        docSeries: "0001",
        docNumber: "CH-001",
        docDate: voucherDate,
        glossary: `Cancelación / Contrapartida de cuadre`,
        debitPEN: needsCredit ? "0.00" : missingPEN,
        creditPEN: needsCredit ? missingPEN : "0.00",
        debitUSD: needsCredit ? "0.00" : missingUSD,
        creditUSD: needsCredit ? missingUSD : "0.00",
        isAutoDestination: false,
      },
    ]);
  };

  // ----------------------------------------------------------------------------
  // GUARDAR VOUCHER CON VALIDACIÓN ATÓMICA
  // ----------------------------------------------------------------------------
  const handleSave = async () => {
    if (!validation.isBalanced) return;

    setIsSaving(true);
    try {
      if (onSave) {
        await onSave({
          header: {
            subdiario,
            voucherNumber,
            voucherDate,
            currency,
            exchangeRate: new Decimal(tc).toNumber(),
            glossary: generalGlossary,
          },
          items: lines,
          validation,
        });
      } else {
        // Simulación de persistencia ACID
        await new Promise((res) => setTimeout(res, 800));
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Error al persistir voucher contable:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 font-sans selection:bg-indigo-600 selection:text-white">
      {/* -------------------------------------------------------------------- */}
      {/* CABECERA SUPERIOR: DATOS DE EMPRESA Y CONFIGURACIÓN DEL ASIENTO      */}
      {/* -------------------------------------------------------------------- */}
      <div className="border-b border-slate-800 bg-slate-900/90 backdrop-blur px-6 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold shadow-inner">
              <Building2 className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-100 tracking-tight text-base">
                  {companyName}
                </span>
                <span className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded border border-slate-700 font-mono">
                  RUC: {companyRuc}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Plan Contable General Empresarial (PCGE 2026) • Régimen MYPE Tributario
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateDestinations}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200 text-xs font-medium rounded-md transition-all shadow-sm active:scale-95"
              title="Analiza cuentas de la Clase 6 y genera líneas de la Clase 9 con abono a la 79"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Destinos Clase 9 (F8)
            </button>

            {!validation.isBalanced && (
              <button
                type="button"
                onClick={handleAutoBalance}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-900/40 hover:bg-indigo-900/60 border border-indigo-700/50 text-indigo-300 text-xs font-medium rounded-md transition-all shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                Auto-Cuadrar
              </button>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={!validation.isBalanced || isSaving}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-md transition-all shadow-md active:scale-95",
                validation.isBalanced
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-emerald-950/40"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800"
              )}
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? "Guardando..." : "Guardar Voucher (Ctrl+S)"}
            </button>
          </div>
        </div>

        {/* Formulario rápido de Cabecera */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mt-4 pt-3 border-t border-slate-800/80">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Subdiario
            </label>
            <select
              value={subdiario}
              onChange={(e) => setSubdiario(e.target.value)}
              className="w-full bg-slate-800/90 border border-slate-700 text-slate-100 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            >
              <option value="01">01 - Asiento de Apertura</option>
              <option value="05">05 - Registro de Compras</option>
              <option value="11">11 - Registro de Ventas</option>
              <option value="14">14 - Caja Chica / Efectivo</option>
              <option value="21">21 - Bancos e Ingresos</option>
              <option value="22">22 - Bancos y Egresos</option>
              <option value="31">31 - Diario General</option>
              <option value="34">34 - Costo de Ventas</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Nro. Asiento
            </label>
            <input
              type="text"
              value={voucherNumber}
              onChange={(e) => setVoucherNumber(e.target.value)}
              className="w-full bg-slate-800/90 border border-slate-700 text-slate-100 text-xs rounded px-2.5 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              Fecha Asiento
            </label>
            <input
              type="date"
              value={voucherDate}
              onChange={(e) => setVoucherDate(e.target.value)}
              className="w-full bg-slate-800/90 border border-slate-700 text-slate-100 text-xs rounded px-2 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Moneda Origen
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as "PEN" | "USD")}
              className="w-full bg-slate-800/90 border border-slate-700 text-slate-100 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-medium"
            >
              <option value="PEN">PEN - Soles (S/)</option>
              <option value="USD">USD - Dólares ($)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-emerald-400" />
              T.C. Venta (SUNAT)
            </label>
            <input
              type="number"
              step="0.001"
              value={tc}
              onChange={(e) => setTc(e.target.value)}
              className="w-full bg-slate-800/90 border border-slate-700 text-emerald-400 font-mono font-semibold text-xs rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Glosa Principal
            </label>
            <input
              type="text"
              value={generalGlossary}
              onChange={(e) => setGeneralGlossary(e.target.value)}
              className="w-full bg-slate-800/90 border border-slate-700 text-slate-100 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Descripción general del voucher..."
            />
          </div>
        </div>
      </div>

      {/* Notificación de guardado exitoso */}
      {saveSuccess && (
        <div className="bg-emerald-950/80 border-b border-emerald-800 px-6 py-2 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Voucher contable persistido con éxito mediante transacción ACID atómica.</span>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* ÁREA CENTRAL: GRILLA EDITABLE TIPO HOJA DE CÁLCULO                  */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex-1 overflow-auto relative">
        <table className="w-full border-collapse text-[12px] text-left">
          {/* Encabezado fijo de columnas */}
          <thead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 text-[11px] font-semibold text-slate-300 uppercase tracking-wider select-none">
            <tr>
              <th className="py-2.5 px-2 w-10 text-center text-slate-400">#</th>
              <th className="py-2.5 px-2 w-28">Cuenta PCGE</th>
              <th className="py-2.5 px-2 min-w-[200px]">Descripción de Cuenta</th>
              <th className="py-2.5 px-2 w-32">Anexo (RUC/DNI)</th>
              <th className="py-2.5 px-2 w-24">C. Costo</th>
              <th className="py-2.5 px-2 w-28">Tipo Doc</th>
              <th className="py-2.5 px-2 w-20">Serie</th>
              <th className="py-2.5 px-2 w-24">Número</th>
              <th className="py-2.5 px-2 min-w-[180px]">Glosa Específica</th>
              <th className="py-2.5 px-2 w-28 text-right bg-indigo-950/30 text-indigo-200">Debe PEN (S/)</th>
              <th className="py-2.5 px-2 w-28 text-right bg-indigo-950/30 text-indigo-200">Haber PEN (S/)</th>
              <th className="py-2.5 px-2 w-28 text-right bg-emerald-950/20 text-emerald-200">Debe USD ($)</th>
              <th className="py-2.5 px-2 w-28 text-right bg-emerald-950/20 text-emerald-200">Haber USD ($)</th>
              <th className="py-2.5 px-2 w-12 text-center">Acción</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-850">
            {lines.map((line, rowIdx) => {
              const accountCfg = accountsCatalog.get(line.accountCode);
              const isClass6 = line.accountCode.startsWith("6") && !line.accountCode.startsWith("69");

              return (
                <tr
                  key={line.id || `line-${rowIdx}`}
                  className={cn(
                    "hover:bg-slate-850/60 transition-colors group",
                    line.isAutoDestination
                      ? "bg-amber-950/15 border-l-2 border-l-amber-500"
                      : "even:bg-slate-900/40"
                  )}
                >
                  {/* Número de fila */}
                  <td className="py-1 px-2 text-center font-mono text-[11px] text-slate-500">
                    {line.lineNumber}
                  </td>

                  {/* Input Cuenta Contable */}
                  <td className="py-1 px-1 relative">
                    <input
                      ref={registerCell(rowIdx, "accountCode")}
                      type="text"
                      value={line.accountCode}
                      onChange={(e) => handleLineChange(rowIdx, "accountCode", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, "accountCode")}
                      onFocus={() => {
                        setActiveAccountSearchIndex(rowIdx);
                        setSearchFilter(line.accountCode || "");
                      }}
                      className={cn(
                        "w-full bg-transparent px-2 py-1 font-mono font-medium rounded text-slate-100 focus:bg-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none",
                        !accountCfg && line.accountCode ? "text-rose-400 underline decoration-wavy" : ""
                      )}
                      placeholder="Ej: 63111"
                    />

                    {/* Popover de autocompletado de cuentas al escribir */}
                    {activeAccountSearchIndex === rowIdx && (
                      <div className="absolute left-0 top-full mt-1 z-30 w-72 bg-slate-900 border border-slate-700 rounded-md shadow-2xl p-1.5 text-xs">
                        <div className="flex items-center gap-1.5 px-2 py-1 mb-1 border-b border-slate-800 text-slate-400 text-[10px]">
                          <Search className="w-3 h-3" />
                          <span>Buscar en PCGE (Enter para elegir)</span>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-0.5">
                          {filteredAccounts.map((acc) => (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => selectAccountForLine(rowIdx, acc)}
                              className="w-full text-left px-2 py-1.5 hover:bg-indigo-600/30 rounded flex items-center justify-between text-slate-200 transition-colors"
                            >
                              <div className="truncate">
                                <span className="font-mono font-bold text-indigo-400 mr-2">{acc.code}</span>
                                <span className="text-[11px] text-slate-300">{acc.name}</span>
                              </div>
                              {acc.hasAutomaticDestination && (
                                <span className="text-[9px] bg-amber-900/60 text-amber-300 px-1 rounded ml-1">
                                  Clase 9
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Descripción de Cuenta */}
                  <td className="py-1 px-2 text-slate-300 truncate max-w-[220px]">
                    <div className="flex items-center gap-1">
                      <span className="truncate">{line.accountName || "—"}</span>
                      {line.isAutoDestination && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 py-0.2 rounded font-mono">
                          Amarre
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Anexo / RUC / DNI */}
                  <td className="py-1 px-1">
                    <input
                      ref={registerCell(rowIdx, "entityDocNumber")}
                      type="text"
                      value={line.entityDocNumber || ""}
                      onChange={(e) => handleLineChange(rowIdx, "entityDocNumber", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, "entityDocNumber")}
                      placeholder={accountCfg?.requiresEntity ? "RUC requerido" : "Opcional"}
                      className={cn(
                        "w-full bg-transparent px-2 py-1 font-mono text-slate-100 rounded focus:bg-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none",
                        accountCfg?.requiresEntity && !line.entityDocNumber
                          ? "border border-amber-500/50 bg-amber-950/20"
                          : ""
                      )}
                    />
                  </td>

                  {/* Centro de Costo */}
                  <td className="py-1 px-1">
                    <input
                      ref={registerCell(rowIdx, "costCenterCode")}
                      type="text"
                      value={line.costCenterCode || ""}
                      onChange={(e) => handleLineChange(rowIdx, "costCenterCode", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, "costCenterCode")}
                      placeholder={accountCfg?.requiresCostCenter ? "CC requerido" : "—"}
                      className="w-full bg-transparent px-2 py-1 font-mono text-slate-100 rounded focus:bg-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </td>

                  {/* Tipo de Comprobante SUNAT */}
                  <td className="py-1 px-1">
                    <select
                      ref={registerCell(rowIdx, "docType")}
                      value={line.docType || "FACTURA_01"}
                      onChange={(e) => handleLineChange(rowIdx, "docType", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, "docType")}
                      className="w-full bg-transparent px-1.5 py-1 text-slate-100 rounded focus:bg-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-[11px]"
                    >
                      {SUNAT_DOC_TYPES.map((d) => (
                        <option key={d.code} value={d.code} className="bg-slate-900">
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Serie del Documento */}
                  <td className="py-1 px-1">
                    <input
                      ref={registerCell(rowIdx, "docSeries")}
                      type="text"
                      value={line.docSeries || ""}
                      onChange={(e) => handleLineChange(rowIdx, "docSeries", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, "docSeries")}
                      placeholder="F001"
                      className="w-full bg-transparent px-1.5 py-1 font-mono uppercase text-slate-100 rounded focus:bg-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </td>

                  {/* Número Correlativo del Documento */}
                  <td className="py-1 px-1">
                    <input
                      ref={registerCell(rowIdx, "docNumber")}
                      type="text"
                      value={line.docNumber || ""}
                      onChange={(e) => handleLineChange(rowIdx, "docNumber", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, "docNumber")}
                      placeholder="000123"
                      className="w-full bg-transparent px-1.5 py-1 font-mono text-slate-100 rounded focus:bg-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </td>

                  {/* Glosa Específica */}
                  <td className="py-1 px-1">
                    <input
                      ref={registerCell(rowIdx, "glossary")}
                      type="text"
                      value={line.glossary}
                      onChange={(e) => handleLineChange(rowIdx, "glossary", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, "glossary")}
                      className="w-full bg-transparent px-2 py-1 text-slate-200 rounded focus:bg-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none truncate"
                    />
                  </td>

                  {/* Debe PEN (S/) */}
                  <td className="py-1 px-1 bg-indigo-950/10">
                    <input
                      ref={registerCell(rowIdx, "debitPEN")}
                      type="number"
                      step="0.01"
                      value={line.debitPEN.toString()}
                      onChange={(e) => handleLineChange(rowIdx, "debitPEN", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, "debitPEN")}
                      className="w-full text-right bg-transparent px-2 py-1 font-mono font-medium text-indigo-300 rounded focus:bg-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </td>

                  {/* Haber PEN (S/) */}
                  <td className="py-1 px-1 bg-indigo-950/10">
                    <input
                      ref={registerCell(rowIdx, "creditPEN")}
                      type="number"
                      step="0.01"
                      value={line.creditPEN.toString()}
                      onChange={(e) => handleLineChange(rowIdx, "creditPEN", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, "creditPEN")}
                      className="w-full text-right bg-transparent px-2 py-1 font-mono font-medium text-indigo-300 rounded focus:bg-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </td>

                  {/* Debe USD ($) */}
                  <td className="py-1 px-1 bg-emerald-950/10">
                    <input
                      ref={registerCell(rowIdx, "debitUSD")}
                      type="number"
                      step="0.01"
                      value={line.debitUSD.toString()}
                      onChange={(e) => handleLineChange(rowIdx, "debitUSD", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, "debitUSD")}
                      className="w-full text-right bg-transparent px-2 py-1 font-mono font-medium text-emerald-300 rounded focus:bg-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </td>

                  {/* Haber USD ($) */}
                  <td className="py-1 px-1 bg-emerald-950/10">
                    <input
                      ref={registerCell(rowIdx, "creditUSD")}
                      type="number"
                      step="0.01"
                      value={line.creditUSD.toString()}
                      onChange={(e) => handleLineChange(rowIdx, "creditUSD", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, "creditUSD")}
                      className="w-full text-right bg-transparent px-2 py-1 font-mono font-medium text-emerald-300 rounded focus:bg-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </td>

                  {/* Botón Eliminar Línea */}
                  <td className="py-1 px-1 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(rowIdx)}
                      title="Eliminar fila"
                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Botón flotante para insertar línea rápida */}
        <div className="p-3 bg-slate-900/60 border-t border-slate-800">
          <button
            type="button"
            onClick={handleAddLine}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-medium rounded transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-400" />
            <span>Agregar Línea al Asiento (Enter en última celda)</span>
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* FOOTER STICKY: TOTALES EN TIEMPO REAL Y CONTROL DE PARTIDA DOBLE     */}
      {/* -------------------------------------------------------------------- */}
      <footer className="sticky bottom-0 z-30 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md px-6 py-3 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Badge de Estado: Equilibrado vs Descuadrado */}
          <div className="flex items-center gap-3">
            {validation.isBalanced ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-950/60 border border-emerald-500/40 rounded-full text-emerald-300 text-xs font-semibold shadow-inner">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>ASIENTO EQUILIBRADO (PARTIDA DOBLE OK)</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-950/60 border border-rose-500/40 rounded-full text-rose-300 text-xs font-semibold shadow-inner">
                <AlertTriangle className="w-4 h-4 text-rose-400 animate-bounce" />
                <span>ASIENTO DESCUADRADO (BLOQUEO DE GUARDADO)</span>
              </div>
            )}

            {validation.lineErrors.length > 0 && (
              <span className="text-[11px] text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                {validation.lineErrors.length} advertencia(s) en cuentas
              </span>
            )}
          </div>

          {/* Tablero Resumen de Totales y Diferencias */}
          <div className="flex items-center gap-6">
            {/* Totales en Soles (PEN) */}
            <div className="flex items-center gap-3 bg-slate-950/70 border border-slate-800 px-4 py-1.5 rounded-lg">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                PEN (S/)
              </span>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Debe</span>
                <span className="font-mono text-xs font-semibold text-slate-200">
                  {validation.totalDebitPEN.toFixed(2)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Haber</span>
                <span className="font-mono text-xs font-semibold text-slate-200">
                  {validation.totalCreditPEN.toFixed(2)}
                </span>
              </div>
              <div className="text-right pl-2 border-l border-slate-800">
                <span className="text-[10px] text-slate-400 block">Diferencia</span>
                <span
                  className={cn(
                    "font-mono text-xs font-bold",
                    validation.isBalancedPEN ? "text-emerald-400" : "text-rose-400"
                  )}
                >
                  {validation.diffPEN.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Totales en Dólares (USD) */}
            <div className="flex items-center gap-3 bg-slate-950/70 border border-slate-800 px-4 py-1.5 rounded-lg">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                USD ($)
              </span>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Debe</span>
                <span className="font-mono text-xs font-semibold text-slate-200">
                  {validation.totalDebitUSD.toFixed(2)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Haber</span>
                <span className="font-mono text-xs font-semibold text-slate-200">
                  {validation.totalCreditUSD.toFixed(2)}
                </span>
              </div>
              <div className="text-right pl-2 border-l border-slate-800">
                <span className="text-[10px] text-slate-400 block">Diferencia</span>
                <span
                  className={cn(
                    "font-mono text-xs font-bold",
                    validation.isBalancedUSD ? "text-emerald-400" : "text-rose-400"
                  )}
                >
                  {validation.diffUSD.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
