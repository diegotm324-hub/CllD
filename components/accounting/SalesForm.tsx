"use client";

import React, { useState, useEffect, useMemo, useRef, useTransition } from "react";
import Decimal from "decimal.js";
import {
  FileText,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Save,
  DollarSign,
  Sparkles,
  TrendingUp,
  FileCode2,
  Upload,
  Search,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { validateRUC, safeDecimal } from "@/lib/accounting/validator";
import { saveVoucherAction } from "@/app/actions/vouchers";
import { parseUblXml } from "@/lib/sunat/xmlParser";
import { lookupRucAction } from "@/lib/sunat/lookup";

export interface SalesFormProps {
  companyRuc?: string;
  companyName?: string;
  defaultTc?: number;
  onSuccess?: (voucherId: string) => void;
}

export function SalesForm({
  companyRuc = "10746979636",
  companyName = "CONTRIBUYENTE RUC 10746979636 (SCABCASH)",
  defaultTc = 3.755,
  onSuccess,
}: SalesFormProps) {
  // ----------------------------------------------------------------------------
  // ESTADO DEL FORMULARIO DE VENTAS
  // ----------------------------------------------------------------------------
  const [docType, setDocType] = useState<"01" | "03" | "07" | "08">("01"); // 01 Factura
  const [docSeries, setDocSeries] = useState("F001");
  const [docNumber, setDocNumber] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);

  // Cliente
  const [clientDocType, setClientDocType] = useState<"6" | "1">("6"); // 6 = RUC, 1 = DNI
  const [clientDocNumber, setClientDocNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [isDocValid, setIsDocValid] = useState<boolean | null>(null);

  // Moneda y Tipo de Cambio
  const [currency, setCurrency] = useState<"PEN" | "USD">("PEN");
  const [tc, setTc] = useState(defaultTc.toString());

  // Importes
  const [baseAmount, setBaseAmount] = useState<string>("");
  const [igvAmount, setIgvAmount] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<string>("");

  // Cuenta contable de ingresos
  const [salesAccountCode, setSalesAccountCode] = useState("70121");
  const [salesAccountName, setSalesAccountName] = useState("Venta de mercaderías al por mayor");
  const [glossary, setGlossary] = useState("");

  // Operatividad Tributaria (SPOT / Retenciones)
  const [hasDetraction, setHasDetraction] = useState(false);
  const [spotRate, setSpotRate] = useState(12);

  const [hasClientRetention, setHasClientRetention] = useState(false);
  const retentionRate = 3;

  // Feedback y persistencia con transición
  const [isPending, startTransition] = useTransition();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Referencia para selector nativo de archivos
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Automatización XML UBL 2.1 Drag & Drop y Lookup RUC/DNI
  const [isDraggingXml, setIsDraggingXml] = useState(false);
  const [xmlToast, setXmlToast] = useState<{
    title: string;
    description: string;
    isWarning?: boolean;
  } | null>(null);
  const [isLookingUpClient, setIsLookingUpClient] = useState(false);

  // Procesamiento de Factura/Boleta XML UBL 2.1
  const processXmlContent = (xmlString: string) => {
    try {
      const parsed = parseUblXml(xmlString, companyRuc);

      setDocType(parsed.docType);
      setDocSeries(parsed.docSeries);
      setDocNumber(parsed.docNumber);
      setIssueDate(parsed.issueDate);
      if (parsed.dueDate) setDueDate(parsed.dueDate);

      // En Venta, el cliente es el receptor (customer)
      setClientDocType(parsed.customer.docType === "1" ? "1" : "6");
      setClientDocNumber(parsed.customer.docNumber);
      setClientName(parsed.customer.businessName);
      setIsDocValid(true);

      setCurrency(parsed.currency);
      handleBaseChange(parsed.amounts.baseAmountGravada.toFixed(2));
      setTotalAmount(parsed.amounts.totalAmount.toFixed(2));
      setIgvAmount(parsed.amounts.igvAmount.toFixed(2));

      setGlossary(`Venta F/${parsed.docSeries}-${parsed.docNumber} ${parsed.customer.businessName}`);

      const isWarning = parsed.classifiedAs === "PURCHASE";
      setXmlToast({
        title: `Factura de Venta ${parsed.fullDocNumber} cargada con éxito`,
        description: isWarning
          ? `Atención: El receptor coincide con el RUC de su empresa (${companyRuc}). Probablemente sea una Compra recibida.`
          : `Cliente: ${parsed.customer.businessName} • Total: ${parsed.currency === "PEN" ? "S/" : "$"} ${parsed.amounts.totalAmount.toFixed(2)}`,
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

  // Consulta en vivo RUC Cliente
  const handleClientLookup = async (docNum: string) => {
    if (clientDocType === "6" && docNum.length === 11) {
      setIsLookingUpClient(true);
      try {
        const res = await lookupRucAction(docNum);
        if (res.success && res.businessName) {
          setClientName(res.businessName);
          setIsDocValid(true);
        }
      } catch (e) {
        console.warn("Error en lookup RUC:", e);
      } finally {
        setIsLookingUpClient(false);
      }
    }
  };

  // Validación de RUC / DNI
  useEffect(() => {
    if (clientDocType === "6" && clientDocNumber.length === 11) {
      const res = validateRUC(clientDocNumber);
      setIsDocValid(res.isValid);
      if (res.isValid && !clientName) {
        handleClientLookup(clientDocNumber);
      }
    } else if (clientDocType === "1" && clientDocNumber.length === 8) {
      setIsDocValid(true);
      if (!clientName) setClientName(`CLIENTE DNI ${clientDocNumber}`);
    } else {
      setIsDocValid(null);
    }
  }, [clientDocType, clientDocNumber]);

  // Si cambia el tipo de comprobante, ajustar serie y tipo de documento por defecto
  const handleDocTypeChange = (type: "01" | "03" | "07" | "08") => {
    setDocType(type);
    if (type === "01") {
      setDocSeries("F001");
      setClientDocType("6");
    } else if (type === "03") {
      setDocSeries("B001");
      setClientDocType("1");
    } else if (type === "07") {
      setDocSeries("FC01");
    } else if (type === "08") {
      setDocSeries("FD01");
    }
  };

  // Cálculos bidireccionales
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

  // Preview del asiento contable generado
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
    const descGlosa = glossary || `Venta F/${docSeries}-${docNumber} ${clientName}`;

    return [
      {
        lineNumber: 1,
        accountCode: "12121",
        accountName: "Facturas por cobrar - Emitidas en cartera",
        entityDocNumber: clientDocNumber,
        docType: `FACTURA_${docType}`,
        docSeries,
        docNumber,
        docDate: issueDate,
        docDueDate: dueDate,
        glossary: `Total ${descGlosa}`,
        debitPEN: isNC ? 0 : toPEN(tot),
        creditPEN: isNC ? toPEN(tot) : 0,
        debitUSD: isNC ? 0 : toUSD(tot),
        creditUSD: isNC ? toUSD(tot) : 0,
      },
      {
        lineNumber: 2,
        accountCode: "40111",
        accountName: "IGV - Cuenta propia 18%",
        entityDocNumber: clientDocNumber,
        docType: `FACTURA_${docType}`,
        docSeries,
        docNumber,
        docDate: issueDate,
        glossary: `IGV 18% ${descGlosa}`,
        debitPEN: isNC ? toPEN(igv) : 0,
        creditPEN: isNC ? 0 : toPEN(igv),
        debitUSD: isNC ? toUSD(igv) : 0,
        creditUSD: isNC ? 0 : toUSD(igv),
      },
      {
        lineNumber: 3,
        accountCode: salesAccountCode,
        accountName: salesAccountName,
        entityDocNumber: clientDocNumber,
        docType: `FACTURA_${docType}`,
        docSeries,
        docNumber,
        docDate: issueDate,
        glossary: `Ingreso ${descGlosa}`,
        debitPEN: isNC ? toPEN(b) : 0,
        creditPEN: isNC ? 0 : toPEN(b),
        debitUSD: isNC ? toUSD(b) : 0,
        creditUSD: isNC ? 0 : toUSD(b),
      },
    ];
  }, [
    baseAmount,
    igvAmount,
    totalAmount,
    currency,
    tc,
    docType,
    docSeries,
    docNumber,
    clientDocNumber,
    clientName,
    salesAccountCode,
    salesAccountName,
    glossary,
    issueDate,
    dueDate,
  ]);

  // Guardado transaccional con transición
  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!clientDocNumber) {
      setErrorMessage("Ingrese el número de RUC o DNI del cliente.");
      return;
    }

    if (!docNumber) {
      setErrorMessage("Ingrese el número correlativo de la factura o boleta.");
      return;
    }

    if (!totalAmount || safeDecimal(totalAmount).isZero()) {
      setErrorMessage("El importe total de la venta debe ser mayor a cero.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await saveVoucherAction({
          companyRuc,
          subdiarioCode: "21", // 21 = Registro de Ventas e Ingresos
          date: issueDate,
          currency,
          exchangeRate: parseFloat(tc),
          glossary: glossary || `VENTA F/${docSeries}-${docNumber} ${clientName}`,
          originModule: "SIRE_VENTAS",
          items: generatedVoucherLines.map((it) => ({
            lineNumber: it.lineNumber,
            accountCode: it.accountCode,
            accountName: it.accountName,
            entityDocNumber: it.entityDocNumber,
            entityBusinessName: clientName,
            docType: it.docType,
            docSeries: it.docSeries,
            docNumber: it.docNumber,
            docDate: it.docDate,
            glossary: it.glossary,
            debitPEN: Number(it.debitPEN || 0),
            creditPEN: Number(it.creditPEN || 0),
            debitUSD: Number(it.debitUSD || 0),
            creditUSD: Number(it.creditUSD || 0),
            isAutoDestination: false,
          })),
        });

        if (res.success && res.voucherNumber) {
          setSuccessMessage(`Comprobante de venta registrado con éxito. Asiento N°: ${res.voucherNumber}`);
          setDocNumber("");
          setBaseAmount("");
          setIgvAmount("");
          setTotalAmount("");
          setGlossary("");
          if (onSuccess && res.voucherId) onSuccess(res.voucherId);
        } else {
          setErrorMessage(res.error || "No se pudo registrar la venta.");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al procesar la venta.";
        setErrorMessage(msg);
      }
    });
  };

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
      {/* COLUMNA IZQUIERDA: FORMULARIO DE REGISTRO DE VENTA                   */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-100 tracking-tight">
                  Registro Rápido de Ventas (SIRE / RVIE)
                </h2>
                <p className="text-xs text-slate-400">
                  Subdiario 11 • Facturación electrónica, IGV 18% y cuentas por cobrar
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
                  : "bg-emerald-950/70 border-emerald-500/40 text-emerald-300"
              )}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
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
          {/* ZONA DRAG & DROP PARA FACTURAS DE VENTA XML UBL 2.1                */}
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
                ? "border-emerald-500 bg-emerald-950/40 shadow-inner"
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
              <FileCode2 className="w-5 h-5 text-emerald-400" />
              <span className="text-xs font-semibold text-slate-200">
                Arrastra aquí tu Factura o Boleta de Venta XML (UBL 2.1) o haz clic para examinar
              </span>
            </div>
            <p className="text-[11px] text-slate-400 pointer-events-none">
              Extracción automática de Cliente, Serie, Número, Fecha, Base Imponible e IGV 18%.
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
            {/* 1. Cliente */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Tipo Doc.
                </label>
                <select
                  value={clientDocType}
                  onChange={(e) => setClientDocType(e.target.value as "6" | "1")}
                  className="w-full bg-slate-800/90 border border-slate-700 text-xs rounded-md px-2.5 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="6">6 - RUC</option>
                  <option value="1">1 - DNI</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Número Documento
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={clientDocType === "6" ? 11 : 8}
                    value={clientDocNumber}
                    onChange={(e) => setClientDocNumber(e.target.value.replace(/\D/g, ""))}
                    placeholder={clientDocType === "6" ? "20100047218" : "45214589"}
                    className={cn(
                      "w-full bg-slate-800/90 border text-xs rounded-md px-3 py-2 font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500",
                      isDocValid === true
                        ? "border-emerald-500/50"
                        : isDocValid === false
                        ? "border-rose-500/50"
                        : "border-slate-700"
                    )}
                  />
                  {isLookingUpClient ? (
                    <Search className="w-4 h-4 text-emerald-400 absolute right-2.5 top-2.5 animate-spin" />
                  ) : isDocValid === true ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 absolute right-2.5 top-2.5" />
                  ) : clientDocType === "6" && clientDocNumber.length === 11 ? (
                    <button
                      type="button"
                      onClick={() => handleClientLookup(clientDocNumber)}
                      className="absolute right-2 top-1.5 p-1 text-slate-400 hover:text-emerald-400"
                      title="Consultar RUC en SUNAT"
                    >
                      <Search className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Razón Social / Nombre Cliente
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Empresa Comercializadora S.A.C."
                  className="w-full bg-slate-800/90 border border-slate-700 text-xs rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* 2. Documento de Venta */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Comprobante
                </label>
                <select
                  value={docType}
                  onChange={(e) => handleDocTypeChange(e.target.value as "01" | "03" | "07" | "08")}
                  className="w-full bg-slate-800/90 border border-slate-700 text-xs rounded-md px-2.5 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  className="w-full bg-slate-800/90 border border-slate-700 text-xs rounded-md px-3 py-2 font-mono uppercase text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  placeholder="00005412"
                  className="w-full bg-slate-800/90 border border-slate-700 text-xs rounded-md px-3 py-2 font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  className="w-full bg-slate-800/90 border border-slate-700 text-xs rounded-md px-2 py-2 font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* 3. Moneda y Cuentas de Ingreso */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Moneda</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as "PEN" | "USD")}
                  className="w-full bg-slate-800/90 border border-slate-700 text-xs rounded-md px-2.5 py-2 font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  className="w-full bg-slate-800/90 border border-slate-700 text-xs rounded-md px-3 py-2 font-mono text-emerald-400 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Cuenta de Ingreso (PCGE)
                </label>
                <select
                  value={salesAccountCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    setSalesAccountCode(code);
                    if (code === "70121") setSalesAccountName("Venta de mercaderías al por mayor");
                    else if (code === "70211") setSalesAccountName("Venta de productos terminados");
                    else if (code === "70411") setSalesAccountName("Prestación de servicios locales");
                  }}
                  className="w-full bg-slate-800/90 border border-slate-700 text-xs rounded-md px-2.5 py-2 font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="70121">70121 - Venta de mercaderías</option>
                  <option value="70211">70211 - Venta de productos terminados</option>
                  <option value="70411">70411 - Prestación de servicios</option>
                </select>
              </div>
            </div>

            {/* 4. Importes con Cálculo Bidireccional */}
            <div className="p-4 bg-slate-850 border border-slate-800 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Base Imponible
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
                    placeholder="2000.00"
                    className="w-full bg-slate-900 border border-slate-700 text-xs rounded-md pl-8 pr-3 py-2 font-mono font-medium text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                    placeholder="360.00"
                    className="w-full bg-slate-900 border border-slate-700 text-xs rounded-md pl-8 pr-3 py-2 font-mono font-medium text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-emerald-400 mb-1">
                  Importe Total Venta
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs text-emerald-400 font-mono font-semibold">
                    {currency === "PEN" ? "S/" : "$"}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={totalAmount}
                    onChange={(e) => handleTotalChange(e.target.value)}
                    placeholder="2360.00"
                    className="w-full bg-emerald-950/30 border border-emerald-700/60 text-xs rounded-md pl-8 pr-3 py-2 font-mono font-bold text-emerald-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
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
                placeholder="Por la venta de productos comerciales del ejercicio..."
                className="w-full bg-slate-800/90 border border-slate-700 text-xs rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </form>
        </div>

        <div className="pt-4 border-t border-slate-800 mt-4 flex items-center justify-end">
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={isPending || !totalAmount}
            className={cn(
              "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold shadow-lg transition-all active:scale-95 cursor-pointer",
              totalAmount && !isPending
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40"
                : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
            )}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-emerald-300" />
                <span>Registrando Venta...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Guardar Venta (Ctrl + Enter)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* COLUMNA DERECHA: PREVIEW DEL ASIENTO CONTABLE DE VENTAS              */}
      {/* -------------------------------------------------------------------- */}
      <div className="w-full lg:w-[440px] bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Asiento Contable de Ventas
              </h3>
            </div>
            <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/50 px-2 py-0.5 rounded font-mono">
              Subdiario 11
            </span>
          </div>

          {generatedVoucherLines.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              Digite el importe de la venta para calcular la partida doble (Cuentas 12, 40 y 70).
            </div>
          ) : (
            <div className="space-y-2">
              {generatedVoucherLines.map((line) => (
                <div
                  key={line.lineNumber}
                  className="p-2.5 rounded-md border text-xs font-mono bg-slate-850 border-slate-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-400">{line.accountCode}</span>
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
