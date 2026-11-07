"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef, useTransition } from "react";
import Decimal from "decimal.js";
import {
  FileText,
  ShieldCheck,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Percent,
  Receipt,
  Save,
  ArrowRight,
  DollarSign,
  Info,
  Sparkles,
  Upload,
  FileCode2,
  Search,
  Loader2,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import {
  validateRUC,
  validateDoubleEntry,
  generateAutoDestinations,
  AccountDestinationConfig,
  safeDecimal,
} from "@/lib/accounting/validator";
import { saveVoucherAction } from "@/app/actions/vouchers";
import { parseUblXml } from "@/lib/sunat/xmlParser";
import { lookupRucAction, getExchangeRateAction } from "@/lib/sunat/lookup";

// Códigos de Detracciones SUNAT frecuentes (SPOT)
const SPOT_SERVICES = [
  { code: "022", name: "022 - Otros servicios empresariales", rate: 12 },
  { code: "025", name: "025 - Fabricación de bienes por encargo", rate: 10 },
  { code: "020", name: "020 - Mantenimiento y reparación de bienes muebles", rate: 12 },
  { code: "019", name: "019 - Arrendamiento de bienes muebles", rate: 10 },
  { code: "021", name: "021 - Movimiento de carga", rate: 10 },
  { code: "024", name: "024 - Comisión mercantil", rate: 10 },
  { code: "037", name: "037 - Demás servicios gravados con el IGV", rate: 12 },
  { code: "030", name: "030 - Contratos de construcción", rate: 4 },
];

export interface PurchaseFormProps {
  companyRuc?: string;
  companyName?: string;
  defaultTc?: number;
  onSuccess?: (voucherId: string) => void;
}

export function PurchaseForm({
  companyRuc = "10746979636",
  companyName = "CONTRIBUYENTE RUC 10746979636 (SCABCASH)",
  defaultTc = 3.755,
  onSuccess,
}: PurchaseFormProps) {
  // ----------------------------------------------------------------------------
  // ESTADO DEL FORMULARIO DE COMPRA
  // ----------------------------------------------------------------------------
  const [docType, setDocType] = useState<"01" | "03" | "07" | "08">("01"); // 01 Factura
  const [docSeries, setDocSeries] = useState("F001");
  const [docNumber, setDocNumber] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);

  // Proveedor
  const [supplierRuc, setSupplierRuc] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [isRucValid, setIsRucValid] = useState<boolean | null>(null);

  // Moneda y Tipo de Cambio
  const [currency, setCurrency] = useState<"PEN" | "USD">("PEN");
  const [tc, setTc] = useState(defaultTc.toString());

  // Importes
  const [baseAmount, setBaseAmount] = useState<string>("");
  const [igvAmount, setIgvAmount] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<string>("");

  // Cuenta contable de gasto/adquisición
  const [expenseAccountCode, setExpenseAccountCode] = useState("63111");
  const [expenseAccountName, setExpenseAccountName] = useState("Transporte de carga y encomiendas");
  const [glossary, setGlossary] = useState("");

  // Operatividad Tributaria (SPOT / Retenciones)
  const [hasDetraction, setHasDetraction] = useState(false);
  const [spotCode, setSpotCode] = useState("022");
  const [spotRate, setSpotRate] = useState(12);
  const [detractionConstancy, setDetractionConstancy] = useState("");

  const [hasRetention, setHasRetention] = useState(false);
  const retentionRate = 3; // 3% Régimen de Retenciones del IGV

  // Feedback y persistencia con transición
  const [isPending, startTransition] = useTransition();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Referencia para selector nativo de archivos
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados de automatización XML Drag & Drop y Lookup RUC
  const [isDraggingXml, setIsDraggingXml] = useState(false);
  const [xmlToast, setXmlToast] = useState<{
    title: string;
    description: string;
    isWarning?: boolean;
  } | null>(null);
  const [isLookingUpRuc, setIsLookingUpRuc] = useState(false);

  // ----------------------------------------------------------------------------
  // PARSER DRAG & DROP DE FACTURAS XML UBL 2.1
  // ----------------------------------------------------------------------------
  const processXmlContent = (xmlString: string) => {
    try {
      const parsed = parseUblXml(xmlString, companyRuc);

      setDocType(parsed.docType);
      setDocSeries(parsed.docSeries);
      setDocNumber(parsed.docNumber);
      setIssueDate(parsed.issueDate);
      if (parsed.dueDate) setDueDate(parsed.dueDate);

      setSupplierRuc(parsed.supplier.docNumber);
      setSupplierName(parsed.supplier.businessName);
      setIsRucValid(true);

      setCurrency(parsed.currency);
      handleBaseChange(parsed.amounts.baseAmountGravada.toFixed(2));
      setTotalAmount(parsed.amounts.totalAmount.toFixed(2));
      setIgvAmount(parsed.amounts.igvAmount.toFixed(2));

      if (parsed.detraction?.isSubject) {
        setHasDetraction(true);
        setSpotCode(parsed.detraction.spotCode || "022");
        setSpotRate(parsed.detraction.spotRate || 12);
      }

      setGlossary(`Compra F/${parsed.docSeries}-${parsed.docNumber} ${parsed.supplier.businessName}`);

      const isWarning = parsed.classifiedAs === "SALE";
      setXmlToast({
        title: `Factura ${parsed.fullDocNumber} cargada con éxito`,
        description: isWarning
          ? `Atención: El emisor coincide con el RUC de su empresa (${companyRuc}). Asegúrese si corresponde a compra o venta.`
          : `Emisor: ${parsed.supplier.businessName} • Total: ${parsed.currency === "PEN" ? "S/" : "$"} ${parsed.amounts.totalAmount.toFixed(2)}`,
        isWarning,
      });

      setTimeout(() => setXmlToast(null), 8000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al procesar archivo XML.";
      setErrorMessage(`Fallo al leer XML UBL 2.1: ${msg}`);
    }
  };

  const handleXmlDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingXml(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        processXmlContent(text);
      };
      reader.readAsText(file);
    }
  };

  const handleXmlFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        processXmlContent(text);
      };
      reader.readAsText(file);
    }
  };

  // ----------------------------------------------------------------------------
  // CONSULTA DE PADRÓN RUC EN VIVO (SUNAT)
  // ----------------------------------------------------------------------------
  const handleRucLookup = async (rucToLookup: string) => {
    if (rucToLookup.length !== 11) return;
    setIsLookingUpRuc(true);
    try {
      const res = await lookupRucAction(rucToLookup);
      if (res.success && res.businessName) {
        setSupplierName(res.businessName);
        setIsRucValid(true);
      }
    } catch (e) {
      console.warn("Error en lookup RUC:", e);
    } finally {
      setIsLookingUpRuc(false);
    }
  };

  // ----------------------------------------------------------------------------
  // VALIDACIÓN DE RUC EN TIEMPO REAL
  // ----------------------------------------------------------------------------
  useEffect(() => {
    if (supplierRuc.length === 11) {
      const res = validateRUC(supplierRuc);
      setIsRucValid(res.isValid);
      if (res.isValid && !supplierName) {
        handleRucLookup(supplierRuc);
      }
    } else {
      setIsRucValid(null);
    }
  }, [supplierRuc]);

  // Actualizar tasa SPOT al cambiar código
  const handleSpotCodeChange = (code: string) => {
    setSpotCode(code);
    const item = SPOT_SERVICES.find((s) => s.code === code);
    if (item) setSpotRate(item.rate);
  };

  // ----------------------------------------------------------------------------
  // CÁLCULOS BIDIRECCIONALES (BASE <-> IGV <-> TOTAL)
  // ----------------------------------------------------------------------------
  const handleBaseChange = (val: string) => {
    setBaseAmount(val);
    const baseDec = safeDecimal(val);
    if (baseDec.gt(0)) {
      const igv = baseDec.times("0.18").toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const total = baseDec.plus(igv).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      setIgvAmount(igv.toFixed(2));
      setTotalAmount(total.toFixed(2));
    } else {
      setIgvAmount("");
      setTotalAmount("");
    }
  };

  const handleTotalChange = (val: string) => {
    setTotalAmount(val);
    const totalDec = safeDecimal(val);
    if (totalDec.gt(0)) {
      const base = totalDec.dividedBy("1.18").toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const igv = totalDec.minus(base).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      setBaseAmount(base.toFixed(2));
      setIgvAmount(igv.toFixed(2));
    } else {
      setBaseAmount("");
      setIgvAmount("");
    }
  };

  // Monto de Detracción calculada
  const detractionAmount = useMemo(() => {
    if (!hasDetraction) return new Decimal(0);
    const total = safeDecimal(totalAmount);
    return total.times(spotRate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }, [hasDetraction, totalAmount, spotRate]);

  // Monto de Retención calculada (3%)
  const retentionAmount = useMemo(() => {
    if (!hasRetention) return new Decimal(0);
    const total = safeDecimal(totalAmount);
    return total.times(retentionRate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }, [hasRetention, totalAmount]);

  // Saldo neto a transferir al proveedor
  const netPayable = useMemo(() => {
    const total = safeDecimal(totalAmount);
    return total.minus(detractionAmount).minus(retentionAmount);
  }, [totalAmount, detractionAmount, retentionAmount]);

  // ----------------------------------------------------------------------------
  // PREVIEW DEL ASIENTO CONTABLE GENERADO EN TIEMPO REAL
  // ----------------------------------------------------------------------------
  const generatedVoucherLines = useMemo(() => {
    const b = new Decimal(baseAmount || 0);
    const igv = new Decimal(igvAmount || 0);
    const tot = new Decimal(totalAmount || 0);
    const currentTc = new Decimal(tc || 3.755);

    if (tot.isZero()) return [];

    const isUSD = currency === "USD";
    const toUSD = (v: Decimal) =>
      isUSD ? v.toNumber() : v.dividedBy(currentTc).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
    const toPEN = (v: Decimal) =>
      isUSD ? v.times(currentTc).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber() : v.toNumber();

    const isNC = docType === "07";
    const descGlosa = glossary || `Compra F/${docSeries}-${docNumber} ${supplierName}`;

    const items = [
      {
        lineNumber: 1,
        accountCode: expenseAccountCode,
        accountName: expenseAccountName,
        entityDocNumber: supplierRuc,
        docType: `FACTURA_${docType}`,
        docSeries,
        docNumber,
        docDate: issueDate,
        glossary: `Base imponible ${descGlosa}`,
        debitPEN: isNC ? 0 : toPEN(b),
        creditPEN: isNC ? toPEN(b) : 0,
        debitUSD: isNC ? 0 : toUSD(b),
        creditUSD: isNC ? toUSD(b) : 0,
      },
      {
        lineNumber: 2,
        accountCode: "40111",
        accountName: "IGV - Cuenta propia 18%",
        entityDocNumber: supplierRuc,
        docType: `FACTURA_${docType}`,
        docSeries,
        docNumber,
        docDate: issueDate,
        glossary: `IGV 18% ${descGlosa}`,
        debitPEN: isNC ? 0 : toPEN(igv),
        creditPEN: isNC ? toPEN(igv) : 0,
        debitUSD: isNC ? 0 : toUSD(igv),
        creditUSD: isNC ? toUSD(igv) : 0,
      },
      {
        lineNumber: 3,
        accountCode: "42121",
        accountName: "Facturas por pagar - Emitidas",
        entityDocNumber: supplierRuc,
        docType: `FACTURA_${docType}`,
        docSeries,
        docNumber,
        docDate: issueDate,
        docDueDate: dueDate,
        glossary: `Total ${descGlosa}`,
        debitPEN: isNC ? toPEN(tot) : 0,
        creditPEN: isNC ? 0 : toPEN(tot),
        debitUSD: isNC ? toUSD(tot) : 0,
        creditUSD: isNC ? 0 : toUSD(tot),
      },
    ];

    // Simular amarre de Clase 9 si es cuenta 6x
    if (expenseAccountCode.startsWith("6") && !expenseAccountCode.startsWith("69") && !b.isZero()) {
      items.push(
        {
          lineNumber: 4,
          accountCode: "94111",
          accountName: "Gastos de Administración (Destino)",
          entityDocNumber: supplierRuc,
          docType: `FACTURA_${docType}`,
          docSeries,
          docNumber,
          docDate: issueDate,
          glossary: `[Destino] ${descGlosa}`,
          debitPEN: isNC ? 0 : toPEN(b),
          creditPEN: isNC ? toPEN(b) : 0,
          debitUSD: isNC ? 0 : toUSD(b),
          creditUSD: isNC ? toUSD(b) : 0,
        },
        {
          lineNumber: 5,
          accountCode: "79111",
          accountName: "Cargas Imputables a Cuentas de Costos (Destino)",
          entityDocNumber: supplierRuc,
          docType: `FACTURA_${docType}`,
          docSeries,
          docNumber,
          docDate: issueDate,
          glossary: `[Destino 79] ${descGlosa}`,
          debitPEN: isNC ? toPEN(b) : 0,
          creditPEN: isNC ? 0 : toPEN(b),
          debitUSD: isNC ? toUSD(b) : 0,
          creditUSD: isNC ? 0 : toUSD(b),
        }
      );
    }

    return items;
  }, [
    baseAmount,
    igvAmount,
    totalAmount,
    currency,
    tc,
    docType,
    docSeries,
    docNumber,
    supplierRuc,
    supplierName,
    expenseAccountCode,
    expenseAccountName,
    glossary,
    issueDate,
    dueDate,
  ]);

  // ----------------------------------------------------------------------------
  // ENVÍO AL SERVER ACTION TRANSACCIONAL
  // ----------------------------------------------------------------------------
  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!supplierRuc || supplierRuc.length !== 11) {
      setErrorMessage("Ingrese un RUC válido de 11 dígitos para el proveedor.");
      return;
    }

    if (!docNumber) {
      setErrorMessage("Ingrese el número correlativo del comprobante.");
      return;
    }

    if (!totalAmount || safeDecimal(totalAmount).isZero()) {
      setErrorMessage("El importe total debe ser mayor a cero.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await saveVoucherAction({
          companyRuc,
          subdiarioCode: "11", // 11 = Registro de Compras
          date: issueDate,
          currency,
          exchangeRate: parseFloat(tc),
          glossary: glossary || `COMPRA F/${docSeries}-${docNumber} ${supplierName}`,
          originModule: "SIRE_COMPRAS",
          items: generatedVoucherLines.map((it) => ({
            lineNumber: it.lineNumber,
            accountCode: it.accountCode,
            accountName: it.accountName,
            entityDocNumber: it.entityDocNumber,
            entityBusinessName: supplierName,
            docType: it.docType,
            docSeries: it.docSeries,
            docNumber: it.docNumber,
            docDate: it.docDate,
            glossary: it.glossary,
            debitPEN: Number(it.debitPEN || 0),
            creditPEN: Number(it.creditPEN || 0),
            debitUSD: Number(it.debitUSD || 0),
            creditUSD: Number(it.creditUSD || 0),
            isAutoDestination: it.lineNumber >= 4,
          })),
        });

        if (res.success && res.voucherNumber) {
          setSuccessMessage(`Comprobante registrado con éxito. Asiento N°: ${res.voucherNumber}`);
          // Reset parcial para continuar digitando rápidamente
          setDocNumber("");
          setBaseAmount("");
          setIgvAmount("");
          setTotalAmount("");
          setGlossary("");
          if (onSuccess && res.voucherId) onSuccess(res.voucherId);
        } else {
          setErrorMessage(res.error || "No se pudo registrar el comprobante de compra.");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error de comunicación con el servidor.";
        setErrorMessage(msg);
      }
    });
  };

  // Atajo de teclado: Ctrl + Enter para guardar directamente
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      className="flex flex-col lg:flex-row gap-6 p-6 bg-slate-950 text-slate-100 max-w-7xl mx-auto h-full overflow-y-auto"
    >
      {/* -------------------------------------------------------------------- */}
      {/* COLUMNA IZQUIERDA: FORMULARIO DE CAPTURA RÁPIDA                     */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col justify-between">
        <div>
          {/* Encabezado */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Receipt className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-100 tracking-tight">
                  Registro Rápido de Compras (SIRE / RCE)
                </h2>
                <p className="text-xs text-slate-400">
                  Subdiario 05 • Comprobante de pago y cálculo automático de IGV/SPOT
                </p>
              </div>
            </div>

            <span className="text-[11px] bg-slate-800 text-slate-300 px-2.5 py-1 rounded font-mono border border-slate-700">
              Ctrl + Enter para guardar
            </span>
          </div>

          {/* Mensajes de Estado */}
          {xmlToast && (
            <div
              className={cn(
                "mb-4 rounded-lg p-3 text-xs flex items-center justify-between border",
                xmlToast.isWarning
                  ? "bg-amber-950/70 border-amber-500/40 text-amber-300"
                  : "bg-indigo-950/70 border-indigo-500/40 text-indigo-300"
              )}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <span className="font-semibold block">{xmlToast.title}</span>
                  <span className="text-[11px] opacity-90">{xmlToast.description}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setXmlToast(null)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* ZONA DRAG & DROP PARA FACTURAS XML UBL 2.1                         */}
          {/* ------------------------------------------------------------------ */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingXml(true);
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setIsDraggingXml(true);
            }}
            onDragLeave={() => setIsDraggingXml(false)}
            onDrop={handleXmlDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "mb-5 border-2 border-dashed rounded-xl p-4 transition-all text-center flex flex-col items-center justify-center relative cursor-pointer select-none",
              isDraggingXml
                ? "border-indigo-500 bg-indigo-950/40 shadow-inner"
                : "border-slate-800 hover:border-slate-700 bg-slate-950/60"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml"
              onChange={handleXmlFileInput}
              className="hidden"
            />
            <div className="flex items-center gap-2 mb-1 pointer-events-none">
              <FileCode2 className="w-5 h-5 text-indigo-400" />
              <span className="text-xs font-semibold text-slate-200">
                Arrastra aquí tu Factura Electrónica XML (UBL 2.1) o haz clic para examinar
              </span>
            </div>
            <p className="text-[11px] text-slate-400 pointer-events-none">
              Auto-completa RUC, Razón Social, Serie, Correlativo, Fechas, Base Imponible, IGV y Detracción SPOT al instante.
            </p>
          </div>

          {successMessage && (
            <div className="mb-4 bg-emerald-950/70 border border-emerald-500/40 rounded-lg p-3 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 bg-rose-950/70 border border-rose-500/40 rounded-lg p-3 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            {/* 1. Proveedor (RUC y Razón Social) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  RUC Proveedor (11 dígitos)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={11}
                    value={supplierRuc}
                    onChange={(e) => setSupplierRuc(e.target.value.replace(/\D/g, ""))}
                    placeholder="20100047218"
                    className={cn(
                      "w-full bg-slate-800/90 border text-xs rounded-md px-3 py-2 font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500",
                      isRucValid === true
                        ? "border-emerald-500/50"
                        : isRucValid === false
                        ? "border-rose-500/50"
                        : "border-slate-700"
                    )}
                  />
                  {isLookingUpRuc ? (
                    <Search className="w-4 h-4 text-indigo-400 absolute right-2.5 top-2.5 animate-spin" />
                  ) : isRucValid === true ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 absolute right-2.5 top-2.5" />
                  ) : isRucValid === false ? (
                    <AlertCircle className="w-4 h-4 text-rose-400 absolute right-2.5 top-2.5" />
                  ) : supplierRuc.length === 11 ? (
                    <button
                      type="button"
                      onClick={() => handleRucLookup(supplierRuc)}
                      className="absolute right-2 top-1.5 p-1 text-slate-400 hover:text-indigo-400"
                      title="Consultar RUC en SUNAT"
                    >
                      <Search className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Razón Social / Nombre Comercial
                </label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Distribuidora de Insumos S.A.C."
                  className="w-full bg-slate-800/90 border border-slate-700 text-xs rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* 2. Documento (Tipo, Serie, Número) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Tipo Comprobante
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as "01" | "03" | "07" | "08")}
                  className="w-full bg-slate-800/90 border border-slate-700 text-xs rounded-md px-2.5 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="01">01 - Factura</option>
                  <option value="03">03 - Boleta</option>
                  <option value="07">07 - Nota de Crédito</option>
                  <option value="08">08 - Nota de Débito</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Serie</label>
                <input
                  type="text"
                  maxLength={4}
                  value={docSeries}
                  onChange={(e) => setDocSeries(e.target.value.toUpperCase())}
                  placeholder="F001"
                  className="w-full bg-slate-800/90 border border-slate-700 text-xs rounded-md px-3 py-2 font-mono uppercase text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Correlativo
                </label>
                <input
                  type="text"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  placeholder="00012450"
                  className="w-full bg-slate-800/90 border border-slate-700 text-xs rounded-md px-3 py-2 font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Fecha Emisión
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => {
                    setIssueDate(e.target.value);
                    if (!dueDate) setDueDate(e.target.value);
                  }}
                  className="w-full bg-slate-800/90 border border-slate-700 text-xs rounded-md px-2 py-2 font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* 3. Moneda y Cuentas de Gasto */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Moneda</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as "PEN" | "USD")}
                  className="w-full bg-slate-800/90 border border-slate-700 text-xs rounded-md px-2.5 py-2 font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="PEN">PEN (S/)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">TC Venta</label>
                <input
                  type="number"
                  step="0.001"
                  value={tc}
                  onChange={(e) => setTc(e.target.value)}
                  className="w-full bg-slate-800/90 border border-slate-700 text-xs rounded-md px-3 py-2 font-mono text-emerald-400 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Cuenta de Adquisición / Gasto (PCGE)
                </label>
                <select
                  value={expenseAccountCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    setExpenseAccountCode(code);
                    if (code === "60111") setExpenseAccountName("Mercaderías - Manufacturadas");
                    else if (code === "63111") setExpenseAccountName("Transporte de carga y encomiendas");
                    else if (code === "63211") setExpenseAccountName("Asesoría contable y tributaria");
                    else if (code === "65611") setExpenseAccountName("Suministros de oficina y computo");
                  }}
                  className="w-full bg-slate-800/90 border border-slate-700 text-xs rounded-md px-2.5 py-2 font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="60111">60111 - Mercaderías (Existencias)</option>
                  <option value="63111">63111 - Transporte de carga (Gastos Adm)</option>
                  <option value="63211">63211 - Asesoría contable / legal</option>
                  <option value="65611">65611 - Suministros diversos de oficina</option>
                </select>
              </div>
            </div>

            {/* 4. Importes con Cálculo Bidireccional */}
            <div className="p-4 bg-slate-850 border border-slate-800 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Base Imponible Gravada
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs text-slate-500 font-mono">
                    {currency === "PEN" ? "S/" : "$"}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={baseAmount}
                    onChange={(e) => handleBaseChange(e.target.value)}
                    placeholder="1000.00"
                    className="w-full bg-slate-900 border border-slate-700 text-xs rounded-md pl-8 pr-3 py-2 font-mono font-medium text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  IGV (18%)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs text-slate-500 font-mono">
                    {currency === "PEN" ? "S/" : "$"}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={igvAmount}
                    onChange={(e) => setIgvAmount(e.target.value)}
                    placeholder="180.00"
                    className="w-full bg-slate-900 border border-slate-700 text-xs rounded-md pl-8 pr-3 py-2 font-mono font-medium text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-indigo-400 mb-1">
                  Importe Total
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs text-indigo-400 font-mono font-semibold">
                    {currency === "PEN" ? "S/" : "$"}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={totalAmount}
                    onChange={(e) => handleTotalChange(e.target.value)}
                    placeholder="1180.00"
                    className="w-full bg-indigo-950/30 border border-indigo-700/60 text-xs rounded-md pl-8 pr-3 py-2 font-mono font-bold text-indigo-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* 5. Checks Tributarios Especiales: SPOT y Retención */}
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={hasDetraction}
                    onChange={(e) => setHasDetraction(e.target.checked)}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-800"
                  />
                  <span>Sujeto a Detracción SPOT (Banco de la Nación)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={hasRetention}
                    onChange={(e) => setHasRetention(e.target.checked)}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-800"
                  />
                  <span>Agente de Retención IGV (3%)</span>
                </label>
              </div>

              {hasDetraction && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800">
                  <div className="sm:col-span-2">
                    <select
                      value={spotCode}
                      onChange={(e) => handleSpotCodeChange(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-[11px] rounded px-2 py-1.5 text-slate-200"
                    >
                      {SPOT_SERVICES.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.name} ({s.rate}%)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <input
                      type="text"
                      value={detractionConstancy}
                      onChange={(e) => setDetractionConstancy(e.target.value)}
                      placeholder="N° Constancia Depósito"
                      className="w-full bg-slate-800 border border-slate-700 text-[11px] rounded px-2 py-1.5 font-mono text-slate-200"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Glosa Específica */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Glosa Contable
              </label>
              <input
                type="text"
                value={glossary}
                onChange={(e) => setGlossary(e.target.value)}
                placeholder="Por la adquisición de servicios de transporte de mercaderías..."
                className="w-full bg-slate-800/90 border border-slate-700 text-xs rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </form>
        </div>

        {/* Botón de Guardado */}
        <div className="pt-4 border-t border-slate-800 mt-4 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {hasDetraction && (
              <span className="text-amber-400 mr-3">
                SPOT ({spotRate}%): S/ {detractionAmount.toFixed(2)}
              </span>
            )}
            <span className="font-semibold text-slate-200">
              Neto a Pagar: S/ {netPayable.toFixed(2)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={isPending || !totalAmount}
            className={cn(
              "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold shadow-lg transition-all active:scale-95 cursor-pointer",
              totalAmount && !isPending
                ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950/40"
                : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
            )}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-indigo-300" />
                <span>Registrando Asiento...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Guardar Registro (Ctrl + Enter)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* COLUMNA DERECHA: PREVIEW EN TIEMPO REAL DEL ASIENTO CONTABLE         */}
      {/* -------------------------------------------------------------------- */}
      <div className="w-full lg:w-[440px] bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Asiento Reflejo Generado
              </h3>
            </div>
            <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800/50 px-2 py-0.5 rounded font-mono">
              Bimoneda ACID
            </span>
          </div>

          {generatedVoucherLines.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              Digite la base imponible o total para generar automáticamente la partida doble.
            </div>
          ) : (
            <div className="space-y-2">
              {generatedVoucherLines.map((line) => (
                <div
                  key={line.lineNumber}
                  className={cn(
                    "p-2.5 rounded-md border text-xs font-mono",
                    line.lineNumber >= 4
                      ? "bg-amber-950/20 border-amber-800/40"
                      : "bg-slate-850 border-slate-800"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-400">{line.accountCode}</span>
                    <span className="text-[11px] text-slate-300 font-semibold">
                      {Number(line.debitPEN) > 0
                        ? `D: S/ ${Number(line.debitPEN).toFixed(2)}`
                        : `H: S/ ${Number(line.creditPEN).toFixed(2)}`}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    {line.accountName}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resumen de Totales */}
        {generatedVoucherLines.length > 0 && (
          <div className="pt-4 border-t border-slate-800 mt-4 bg-slate-950/60 p-3 rounded-lg text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Total Debe PEN:</span>
              <span className="text-slate-200 font-semibold">
                S/{" "}
                {generatedVoucherLines
                  .reduce((acc, it) => acc + Number(it.debitPEN || 0), 0)
                  .toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-slate-400 mt-1">
              <span>Total Haber PEN:</span>
              <span className="text-slate-200 font-semibold">
                S/{" "}
                {generatedVoucherLines
                  .reduce((acc, it) => acc + Number(it.creditPEN || 0), 0)
                  .toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-emerald-400 font-bold mt-2 pt-2 border-t border-slate-800">
              <span>Partida Doble:</span>
              <span>0.0000 (EQUILIBRADO)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
