"use client";

// ==============================================================================
// ContablePro - Centro de Operaciones SUNAT SIRE (SireHub)
// Dualidad de trabajo: Drag & Drop de ZIP/TXT (100% Confiable) o Sincronización en la Nube
// ==============================================================================

import React, { useState, useEffect, useRef } from "react";
import JSZip from "jszip";
import {
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Database,
  CloudDownload,
  RefreshCw,
  Wifi,
  WifiOff,
  ShieldCheck,
  AlertCircle,
  FileText,
  FileArchive,
  ArrowRight,
  Settings,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  parseSirePurchasesFile,
  parseSireSalesFile,
  convertSirePurchaseToVoucher,
  convertSireSaleToVoucher,
  generateSirePurchasesExport,
  generateSireSalesExport,
  SirePurchaseRecord,
  SireSaleRecord,
} from "@/lib/sunat/sire";
import { saveVoucherAction } from "@/app/actions/vouchers";
import { getSunatStatusAction, syncSireProposalAction } from "@/app/actions/sire";
import { SunatConfigStatus } from "@/lib/sunat/auth";
import { SunatConfigModal } from "@/components/settings/SunatConfigModal";

// Muestras preconfiguradas para demostración inmediata
const SAMPLE_RCE_RAW = `10746979636|CONTRIBUYENTE RUC 10746979636 (SCABCASH)|20260300|1074697963601F00100004520202603|15/03/2026|15/04/2026|01|F001||00004520||6|20100047218|DISTRIBUIDORA LIMA S.A.C.|1000.00|180.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|1180.00|PEN||||||||||||||||1|1|
10746979636|CONTRIBUYENTE RUC 10746979636 (SCABCASH)|20260300|1074697963601F00200008912202603|18/03/2026|18/04/2026|01|F002||00008912||6|20543210981|SERVICIOS Y LOGISTICA GLOBAL S.R.L.|2500.00|450.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|2950.00|PEN||||||||||||||||1|1|
10746979636|CONTRIBUYENTE RUC 10746979636 (SCABCASH)|20260300|1074697963603B00100001245202603|20/03/2026|20/03/2026|03|B001||00001245||1|45892134|COMERCIAL LOS ANDES|350.00|63.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|413.00|PEN||||||||||||||||1|1|`;

const SAMPLE_RVIE_RAW = `10746979636|CONTRIBUYENTE RUC 10746979636 (SCABCASH)|20260300|1074697963601F00100001234202603|10/03/2026||01|F001|00001234||6|20543210981|CLIENTE MAYORISTA S.A.C.|0.00|1500.00|0.00|270.00|0.00|0.00|0.00|0.00|0.00|0.00|1770.00|PEN|3.755|||||1|
10746979636|CONTRIBUYENTE RUC 10746979636 (SCABCASH)|20260300|1074697963603B00100000567202603|12/03/2026||03|B001|00000567||1|10458921|CLIENTE CONSUMIDOR FINAL|0.00|200.00|0.00|36.00|0.00|0.00|0.00|0.00|0.00|0.00|236.00|PEN|3.755|||||1|`;

export interface SireHubProps {
  companyRuc?: string;
  companyName?: string;
  year?: number;
  month?: number;
}

export function SireHub({
  companyRuc = "10746979636",
  companyName = "CONTRIBUYENTE RUC 10746979636 (SCABCASH)",
  year = 2026,
  month = 3,
}: SireHubProps) {
  const [activeModule, setActiveModule] = useState<"PURCHASES" | "SALES">("PURCHASES");
  const [parsedPurchases, setParsedPurchases] = useState<SirePurchaseRecord[]>([]);
  const [parsedSales, setParsedSales] = useState<SireSaleRecord[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [batchSuccessCount, setBatchSuccessCount] = useState<number | null>(null);

  // Estados de conexión en vivo y modal de configuración
  const [sunatStatus, setSunatStatus] = useState<SunatConfigStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState("");
  const [syncFeedback, setSyncFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Estado para el Drag & Drop visual
  const [isDragging, setIsDragging] = useState(false);
  const [lastUploadedName, setLastUploadedName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar estado de configuración de SUNAT
  const refreshSunatStatus = async () => {
    try {
      const res = await getSunatStatusAction();
      setSunatStatus(res);
    } catch {
      setSunatStatus({
        isConfigured: false,
        env: "beta",
        ruc: companyRuc,
        username: "",
        message: "Modo Offline activo.",
      });
    }
  };

  useEffect(() => {
    refreshSunatStatus();
  }, [companyRuc]);

  // Procesador universal de contenido de texto (.txt / .csv / dentro de .zip)
  const processRawText = (text: string, filename: string) => {
    setLastUploadedName(filename);
    setSyncFeedback(null);
    setBatchSuccessCount(null);

    if (activeModule === "PURCHASES") {
      const res = parseSirePurchasesFile(text);
      setParsedPurchases(res.records);
      setParseErrors(res.errors);
      if (res.records.length > 0) {
        setSyncFeedback({
          type: "success",
          message: `¡Archivo ${filename} procesado con éxito! Se cargaron ${res.records.length} comprobantes de compras (RCE).`,
        });
      } else {
        setSyncFeedback({
          type: "error",
          message: "No se encontraron comprobantes válidos en el archivo seleccionado.",
        });
      }
    } else {
      const res = parseSireSalesFile(text);
      setParsedSales(res.records);
      setParseErrors(res.errors);
      if (res.records.length > 0) {
        setSyncFeedback({
          type: "success",
          message: `¡Archivo ${filename} procesado con éxito! Se cargaron ${res.records.length} comprobantes de ventas (RVIE).`,
        });
      } else {
        setSyncFeedback({
          type: "error",
          message: "No se encontraron comprobantes válidos en el archivo seleccionado.",
        });
      }
    }
  };

  // Manejador de archivo (admite .zip, .txt, .csv)
  const handleFileUniversal = async (file: File) => {
    try {
      const isZip = file.name.toLowerCase().endsWith(".zip");

      if (isZip) {
        const zip = await JSZip.loadAsync(file);
        // Buscar el archivo plano dentro del ZIP
        const innerFileName = Object.keys(zip.files).find(
          (name) => !zip.files[name].dir && (name.endsWith(".txt") || name.endsWith(".csv"))
        );

        if (!innerFileName) {
          setSyncFeedback({
            type: "error",
            message: "El archivo ZIP de SUNAT no contiene ningún archivo .txt o .csv legible.",
          });
          return;
        }

        const innerContent = await zip.files[innerFileName].async("text");
        processRawText(innerContent, file.name);
      } else {
        const text = await file.text();
        processRawText(text, file.name);
      }
    } catch (err: unknown) {
      console.error("Error al procesar archivo SIRE:", err);
      setSyncFeedback({
        type: "error",
        message: "No se pudo leer el archivo. Asegúrese de que sea un archivo ZIP o TXT válido descargado de SUNAT.",
      });
    }
  };

  // Eventos de Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await handleFileUniversal(file);
    }
  };

  // Manejador de Sincronización en Vivo (Opción B: Clave SOL)
  const handleLiveSync = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    setBatchSuccessCount(null);

    try {
      setSyncStatusText("Conectando con SUNAT...");
      await new Promise((resolve) => setTimeout(resolve, 500));

      setSyncStatusText(
        activeModule === "PURCHASES"
          ? "Descargando propuesta RCE (Compras)..."
          : "Descargando propuesta RVIE (Ventas)..."
      );

      const res = await syncSireProposalAction({
        companyRuc,
        year,
        month,
        moduleType: activeModule,
        forceDemoOnFailure: false,
      });

      if (res.success && res.records && res.records.length > 0) {
        if (activeModule === "PURCHASES") {
          setParsedPurchases(res.records as SirePurchaseRecord[]);
        } else {
          setParsedSales(res.records as SireSaleRecord[]);
        }
        setLastUploadedName("Sincronización en Vivo SUNAT");
        setSyncFeedback({
          type: "success",
          message: `Sincronización exitosa: Se obtuvieron ${res.records.length} comprobantes de la propuesta oficial desde SUNAT.`,
        });
      } else {
        setSyncFeedback({
          type: "error",
          message:
            res.message ||
            "Credenciales SOL no configuradas o servicio SUNAT no disponible, usando modo manual/archivo",
        });
      }
    } catch {
      setSyncFeedback({
        type: "error",
        message: "Credenciales SOL no configuradas o servicio SUNAT no disponible, usando modo manual/archivo",
      });
    } finally {
      setIsSyncing(false);
      setSyncStatusText("");
    }
  };

  // Cargar datos demo de prueba
  const handleLoadSample = () => {
    if (activeModule === "PURCHASES") {
      processRawText(SAMPLE_RCE_RAW, "Demo_RCE_SUNAT.txt");
    } else {
      processRawText(SAMPLE_RVIE_RAW, "Demo_RVIE_SUNAT.txt");
    }
  };

  // Generar Asientos Contables en Lote
  const handleBatchGenerateVouchers = async () => {
    setIsProcessingBatch(true);
    let successCount = 0;

    try {
      if (activeModule === "PURCHASES") {
        for (const record of parsedPurchases) {
          const draft = convertSirePurchaseToVoucher(record);
          const res = await saveVoucherAction({
            companyRuc,
            subdiarioCode: draft.subdiarioCode,
            date: draft.date,
            currency: draft.currency,
            exchangeRate: draft.exchangeRate,
            glossary: draft.glossary,
            originModule: "SIRE_COMPRAS",
            items: draft.lines.map((l) => ({
              lineNumber: l.lineNumber,
              accountCode: l.accountCode,
              accountName: l.accountName,
              entityDocNumber: l.entityDocNumber,
              entityBusinessName: draft.supplierOrClient.name,
              docType: l.docType,
              docSeries: l.docSeries,
              docNumber: l.docNumber,
              docDate: l.docDate,
              glossary: l.glossary,
              debitPEN: Number(l.debitPEN || 0),
              creditPEN: Number(l.creditPEN || 0),
              debitUSD: Number(l.debitUSD || 0),
              creditUSD: Number(l.creditUSD || 0),
              isAutoDestination: l.isAutoDestination,
            })),
          });
          if (res.success) successCount++;
        }
      } else {
        for (const record of parsedSales) {
          const draft = convertSireSaleToVoucher(record);
          const res = await saveVoucherAction({
            companyRuc,
            subdiarioCode: draft.subdiarioCode,
            date: draft.date,
            currency: draft.currency,
            exchangeRate: draft.exchangeRate,
            glossary: draft.glossary,
            originModule: "SIRE_VENTAS",
            items: draft.lines.map((l) => ({
              lineNumber: l.lineNumber,
              accountCode: l.accountCode,
              accountName: l.accountName,
              entityDocNumber: l.entityDocNumber,
              entityBusinessName: draft.supplierOrClient.name,
              docType: l.docType,
              docSeries: l.docSeries,
              docNumber: l.docNumber,
              docDate: l.docDate,
              glossary: l.glossary,
              debitPEN: Number(l.debitPEN || 0),
              creditPEN: Number(l.creditPEN || 0),
              debitUSD: Number(l.debitUSD || 0),
              creditUSD: Number(l.creditUSD || 0),
              isAutoDestination: l.isAutoDestination,
            })),
          });
          if (res.success) successCount++;
        }
      }
      setBatchSuccessCount(successCount);
    } catch (err) {
      console.error("Error en procesamiento de asientos:", err);
    } finally {
      setIsProcessingBatch(false);
    }
  };

  // Descarga de TXT SUNAT
  const handleDownloadSireExport = () => {
    let fileName = "";
    let content = "";

    if (activeModule === "PURCHASES") {
      const exp = generateSirePurchasesExport(companyRuc, year, month, parsedPurchases);
      fileName = exp.fileName;
      content = exp.content;
    } else {
      const exp = generateSireSalesExport(companyRuc, year, month, parsedSales);
      fileName = exp.fileName;
      content = exp.content;
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const currentRecords = activeModule === "PURCHASES" ? parsedPurchases : parsedSales;
  const totalBase = currentRecords.reduce((acc, it) => acc + (it.baseAmountGravada || 0), 0);
  const totalIgv = currentRecords.reduce((acc, it) => acc + (it.igvAmount || 0), 0);
  const totalImporte = currentRecords.reduce((acc, it) => acc + (it.totalAmount || 0), 0);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 p-6 overflow-y-auto">
      {/* Modal de Configuración SUNAT */}
      <SunatConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        currentRuc={companyRuc}
        onSuccess={refreshSunatStatus}
      />

      {/* -------------------------------------------------------------------- */}
      {/* CABECERA PRINCIPAL: TÍTULO, SELECTOR DE LIBRO Y ESTADO SUNAT        */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-mono px-2 py-0.5 rounded">
              SIRE & PLE 5.2
            </span>

            {/* Badge de Estado SUNAT */}
            {sunatStatus?.isConfigured ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                <Wifi className="w-3 h-3 text-emerald-400 animate-pulse" />
                SUNAT: En línea ({sunatStatus.env.toUpperCase()})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-900 text-slate-400 border border-slate-800">
                <WifiOff className="w-3 h-3 text-slate-500" />
                SUNAT: Modo Manual
              </span>
            )}

            <h2 className="text-lg font-bold text-slate-100 tracking-tight">
              Módulo de Propuestas SUNAT SIRE
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Periodo: {year}-{String(month).padStart(2, "0")} • Genera automáticamente tus asientos contables a partir de las propuestas oficiales del SIRE.
          </p>
        </div>

        {/* Selector de Compras RCE / Ventas RVIE */}
        <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl shadow-inner">
          <button
            type="button"
            onClick={() => {
              setActiveModule("PURCHASES");
              setBatchSuccessCount(null);
              setSyncFeedback(null);
            }}
            className={cn(
              "px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
              activeModule === "PURCHASES"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            Compras (RCE Anexo 8)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveModule("SALES");
              setBatchSuccessCount(null);
              setSyncFeedback(null);
            }}
            className={cn(
              "px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
              activeModule === "SALES"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            Ventas (RVIE Anexo 2)
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* BANNER DE NOTIFICACIONES Y ALERTAS                                   */}
      {/* -------------------------------------------------------------------- */}
      {syncFeedback && (
        <div
          className={cn(
            "mb-5 p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200",
            syncFeedback.type === "success"
              ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
              : "bg-amber-950/60 border-amber-500/40 text-amber-200"
          )}
        >
          <div className="flex items-center gap-2.5">
            {syncFeedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>{syncFeedback.message}</span>
          </div>

          {syncFeedback.type === "error" && (
            <button
              type="button"
              onClick={handleLoadSample}
              className="text-[11px] underline font-semibold hover:text-white cursor-pointer shrink-0"
            >
              Cargar datos de prueba
            </button>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* DUALIDAD DE TRABAJO: OPCIÓN A (DRAG & DROP) VS OPCIÓN B (NUBE)       */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6">
        {/* OPCIÓN A: DRAG & DROP RECOMENDADO Y 100% CONFIABLE (7 COLUMNAS) */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "lg:col-span-8 border-2 border-dashed rounded-2xl p-6 transition-all flex flex-col justify-between relative overflow-hidden",
            isDragging
              ? "border-indigo-400 bg-indigo-950/30 shadow-xl shadow-indigo-600/20 scale-[1.01]"
              : "border-slate-700 bg-gradient-to-br from-slate-900/90 to-slate-900/40 hover:border-slate-600"
          )}
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-full inline-flex items-center gap-1 mb-2">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Opción A (Recomendada y 100% confiable)
              </span>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <FileArchive className="w-4 h-4 text-indigo-400" />
                Arrastra aquí tu reporte o archivo ZIP del SIRE descargado de SUNAT
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Al soltar tu archivo .zip, .txt o .csv, el sistema lo leerá al instante, mostrará el resumen de comprobantes y podrás generar los asientos contables con un solo clic.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-800/70">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-all shadow-md shadow-indigo-900/40 cursor-pointer active:scale-95"
            >
              <Upload className="w-4 h-4" />
              Examinar archivo (.zip / .txt / .csv)
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,.txt,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUniversal(file);
              }}
              className="hidden"
            />

            <button
              type="button"
              onClick={handleLoadSample}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-750 text-indigo-300 text-xs font-medium rounded-lg border border-slate-700 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Cargar Ejemplo Demo {activeModule === "PURCHASES" ? "RCE" : "RVIE"}
            </button>

            {lastUploadedName && (
              <span className="text-[11px] font-mono text-slate-400 ml-auto truncate max-w-xs">
                📄 {lastUploadedName}
              </span>
            )}
          </div>
        </div>

        {/* OPCIÓN B: SINCRONIZACIÓN AUTOMÁTICA EN LA NUBE (5 COLUMNAS) */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-950/60 border border-indigo-800/40 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                <CloudDownload className="w-3 h-3 text-indigo-400" />
                Opción B (Automática en la Nube)
              </span>

              <button
                type="button"
                onClick={() => setIsConfigModalOpen(true)}
                title="Configurar Clave SOL de la empresa"
                className="text-slate-400 hover:text-indigo-300 p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Clave SOL</span>
              </button>
            </div>

            <h3 className="text-xs font-bold text-slate-200 mb-1">
              Sincronizar directo con Clave SOL
            </h3>
            <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
              Consulta en vivo los servidores de SUNAT para descargar la propuesta sin entrar al portal fiscal.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={handleLiveSync}
              disabled={isSyncing}
              className={cn(
                "w-full inline-flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer",
                isSyncing
                  ? "bg-indigo-950 text-indigo-300 border border-indigo-800 cursor-wait"
                  : "bg-slate-800 hover:bg-slate-750 text-slate-100 border border-slate-700 active:scale-95"
              )}
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span>{syncStatusText || "Conectando..."}</span>
                </>
              ) : (
                <>
                  <CloudDownload className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Sincronizar directo con SUNAT</span>
                </>
              )}
            </button>

            {!sunatStatus?.isConfigured && (
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(true)}
                className="w-full text-center text-[10px] text-indigo-400 hover:text-indigo-300 underline font-medium cursor-pointer"
              >
                ¿Aún no guardas tu Clave SOL? Configúrala en 1 minuto aquí
              </button>
            )}
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* PANEL DE TOTALES Y BOTÓN PARA GENERAR ASIENTOS CONTABLES              */}
      {/* -------------------------------------------------------------------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
            <div>
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Comprobantes</span>
              <div className="text-lg font-bold font-mono text-slate-100">{currentRecords.length}</div>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Base Imponible</span>
              <div className="text-lg font-bold font-mono text-slate-200">S/ {totalBase.toFixed(2)}</div>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 uppercase font-semibold">IGV (18%)</span>
              <div className="text-lg font-bold font-mono text-slate-200">S/ {totalIgv.toFixed(2)}</div>
            </div>
            <div>
              <span className="text-[11px] text-indigo-300 uppercase font-bold">Importe Total</span>
              <div className="text-lg font-bold font-mono text-indigo-300">S/ {totalImporte.toFixed(2)}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBatchGenerateVouchers}
              disabled={isProcessingBatch || currentRecords.length === 0}
              className={cn(
                "inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl shadow-lg transition-all",
                currentRecords.length > 0 && !isProcessingBatch
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white cursor-pointer shadow-emerald-950/40 ring-1 ring-white/20 active:scale-95"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              )}
            >
              <Database className="w-4 h-4" />
              {isProcessingBatch ? "Generando Asientos..." : "Generar Asientos Contables"}
            </button>

            <button
              type="button"
              onClick={handleDownloadSireExport}
              disabled={currentRecords.length === 0}
              className={cn(
                "inline-flex items-center gap-1.5 py-2.5 px-3.5 text-xs font-semibold rounded-xl border transition-all",
                currentRecords.length > 0
                  ? "bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700 cursor-pointer"
                  : "bg-slate-850 text-slate-600 border-slate-800 cursor-not-allowed"
              )}
              title="Descarga el archivo TXT para el reemplazo de la propuesta en SUNAT"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              Descargar TXT
            </button>
          </div>
        </div>

        {batchSuccessCount !== null && (
          <div className="mt-4 p-3 bg-emerald-950/70 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Se crearon {batchSuccessCount} asientos contables con éxito en el subdiario correspondiente con partida doble y amarres PCGE equilibrados.
            </span>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* GRILLA DE FACTURAS Y DETALLE DEL SIRE                                */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-xl min-h-[300px]">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-850 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-slate-200">
              Resumen de Comprobantes ({currentRecords.length})
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {activeModule === "PURCHASES" ? "RCE Compras (Anexo 8)" : "RVIE Ventas (Anexo 2)"}
          </span>
        </div>

        <div className="flex-1 overflow-auto">
          {currentRecords.length === 0 ? (
            <div className="py-20 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
              <FolderOpen className="w-10 h-10 text-slate-750" />
              <span className="font-medium text-slate-400">No hay comprobantes cargados en este periodo.</span>
              <span className="text-slate-500">
                Arrastra tu archivo ZIP del SIRE o haz clic en &quot;Cargar Ejemplo Demo&quot; para probar el flujo.
              </span>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3">Comprobante</th>
                  <th className="py-2.5 px-3">RUC / DNI</th>
                  <th className="py-2.5 px-3">Razón Social</th>
                  <th className="py-2.5 px-3 text-right">Base Imp. (S/)</th>
                  <th className="py-2.5 px-3 text-right">IGV (S/)</th>
                  <th className="py-2.5 px-3 text-right">Total (S/)</th>
                  <th className="py-2.5 px-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                {currentRecords.map((r, i) => {
                  const docNum = "supplierDocNumber" in r ? r.supplierDocNumber : r.clientDocNumber;
                  const name = "supplierName" in r ? r.supplierName : r.clientName;
                  return (
                    <tr key={i} className="hover:bg-slate-850/50 transition-colors">
                      <td className="py-2 px-3 text-slate-500">{i + 1}</td>
                      <td className="py-2 px-3 text-slate-300">{r.issueDate}</td>
                      <td className="py-2 px-3 text-indigo-400 font-bold">{r.docType}</td>
                      <td className="py-2 px-3 text-slate-200">
                        {r.docSeries}-{r.docNumber}
                      </td>
                      <td className="py-2 px-3 text-slate-300">{docNum}</td>
                      <td className="py-2 px-3 text-slate-300 truncate max-w-[200px] font-sans">
                        {name}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-200">
                        {r.baseAmountGravada.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-400">
                        {r.igvAmount.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-400 font-bold">
                        {r.totalAmount.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/40 px-1.5 py-0.5 rounded font-sans">
                          Válido
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
