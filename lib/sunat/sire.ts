// ==============================================================================
// ContablePro - Módulo SUNAT SIRE (RVIE y RCE) y PLE 5.2
// Parser de Archivos de Propuesta (TXT/CSV) y Generador de Estructuras Oficiales
// Normativa: R.S. N° 000112-2021/SUNAT, 000040-2022 y modificatorias vigentes
// ==============================================================================

import Decimal from "decimal.js";
import { VoucherLineInput, generateAutoDestinations, AccountDestinationConfig } from "../accounting/validator";

// ------------------------------------------------------------------------------
// TIPOS Y ESTRUCTURAS DE DATOS SIRE
// ------------------------------------------------------------------------------

export interface SirePurchaseRecord {
  carSunat?: string;               // Código de Anotación de Registro (27 caracteres)
  period: string;                 // YYYYMM (ej: "202603")
  supplierDocType: string;        // Tabla 2 (6 = RUC, 1 = DNI)
  supplierDocNumber: string;      // RUC / DNI
  supplierName: string;           // Razón Social Proveedor
  docType: string;                // Tabla 10 (01 Factura, 03 Boleta, 07 NC, 08 ND)
  docSeries: string;              // F001, E001
  docNumber: string;              // 00012345
  issueDate: string;              // YYYY-MM-DD
  dueDate?: string;               // YYYY-MM-DD
  baseAmountGravada: number;      // Base imponible que da derecho a crédito fiscal
  igvAmount: number;              // IGV / IPM 18%
  baseAmountNoGravada: number;    // Adquisiciones gravadas sin crédito fiscal
  exoneratedAmount: number;       // Adquisiciones no gravadas / exoneradas
  iscAmount: number;              // Impuesto Selectivo al Consumo
  icbperAmount: number;           // Impuesto bolsas plásticas
  otherTaxes: number;             // Otros tributos / cargos
  totalAmount: number;            // Importe Total
  currency: "PEN" | "USD";        // Moneda
  exchangeRate: number;           // Tipo de Cambio
  refDocType?: string;            // Para NC / ND
  refDocSeries?: string;
  refDocNumber?: string;
  refDocDate?: string;
  detractionNumber?: string;      // Nro Constancia SPOT
  detractionDate?: string;
  isSubjectToRetention?: boolean;
}

export interface SireSaleRecord {
  carSunat?: string;               // Código de Anotación de Registro
  period: string;                 // YYYYMM
  clientDocType: string;          // 6 = RUC, 1 = DNI
  clientDocNumber: string;        // RUC / DNI cliente
  clientName: string;             // Razón Social / Nombre cliente
  docType: string;                // 01, 03, 07, 08
  docSeries: string;              // F001, B001
  docNumber: string;              // 00001234
  issueDate: string;              // YYYY-MM-DD
  dueDate?: string;               // YYYY-MM-DD
  exportAmount: number;           // Facturado exportación
  baseAmountGravada: number;      // Base imponible gravada
  discountBaseAmount: number;     // Descuento de base imponible
  igvAmount: number;              // IGV 18%
  discountIgvAmount: number;      // Descuento de IGV
  exoneratedAmount: number;       // Exonerado
  inafectoAmount: number;         // Inafecto
  iscAmount: number;              // ISC
  icbperAmount: number;           // ICBPER
  otherTaxes: number;             // Otros cargos
  totalAmount: number;            // Importe Total
  currency: "PEN" | "USD";
  exchangeRate: number;
  refDocType?: string;
  refDocSeries?: string;
  refDocNumber?: string;
  refDocDate?: string;
  state: number;                  // 1 = Activo, 2 = Anulado
}

export interface SireParseResult<T> {
  success: boolean;
  records: T[];
  totalRecords: number;
  totalAmountSum: number;
  totalIgvSum: number;
  errors: string[];
}

export interface ConvertedVoucherDraft {
  originType: "PURCHASE" | "SALE";
  subdiarioCode: string;          // "05" para compras, "11" para ventas
  date: string;
  currency: "PEN" | "USD";
  exchangeRate: number;
  glossary: string;
  supplierOrClient: {
    docType: string;
    docNumber: string;
    name: string;
  };
  document: {
    docType: string;
    docSeries: string;
    docNumber: string;
    issueDate: string;
    dueDate?: string;
  };
  amounts: {
    base: number;
    igv: number;
    total: number;
  };
  lines: VoucherLineInput[];
}

// ------------------------------------------------------------------------------
// 1. PARSER DE PROPUESTA SIRE COMPRAS (RCE)
// ------------------------------------------------------------------------------

/**
 * Parsea el contenido de texto plano (.txt o .csv) descargado del portal SUNAT SIRE RCE.
 * Soporta tanto separador por pleca "|" oficial como delimitado por comas "," o punto y coma ";".
 */
export function parseSirePurchasesFile(fileContent: string): SireParseResult<SirePurchaseRecord> {
  const records: SirePurchaseRecord[] = [];
  const errors: string[] = [];

  const lines = fileContent.split(/\r?\n/).filter((l) => l.trim().length > 0);

  let totalAmountSum = new Decimal(0);
  let totalIgvSum = new Decimal(0);

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];

    // Detectar separador (pleca | o coma , o punto y coma ;)
    let cols: string[] = [];
    if (rawLine.includes("|")) {
      cols = rawLine.split("|");
    } else if (rawLine.includes(";")) {
      cols = rawLine.split(";");
    } else {
      cols = rawLine.split(",");
    }

    // Saltar encabezados si la línea inicial contiene texto no numérico en campos clave
    if (idx === 0 && (cols[0]?.toLowerCase().includes("ruc") || cols[0]?.toLowerCase().includes("periodo"))) {
      continue;
    }

    // Un registro de compras SIRE oficial tiene al menos 25 columnas
    if (cols.length < 15) {
      errors.push(`Línea ${idx + 1}: Longitud insuficiente de columnas (${cols.length}). Ignorada.`);
      continue;
    }

    try {
      // Mapeo estándar de columnas SUNAT RCE (Anexo 8 Propuesta / Reemplazo):
      // Col 0: RUC generador
      // Col 1: Razón social generador
      // Col 2: Periodo (YYYYMM00)
      // Col 3: CAR SUNAT
      // Col 4: Fecha de emisión (DD/MM/YYYY o YYYY-MM-DD)
      // Col 5: Fecha de vencimiento
      // Col 6: Tipo de comprobante (Tabla 10)
      // Col 7: Serie
      // Col 8: Año DUA / vacio
      // Col 9: Número comprobante
      // Col 10: Número final
      // Col 11: Tipo documento proveedor (6 = RUC, 1 = DNI)
      // Col 12: Número documento proveedor
      // Col 13: Razón social proveedor
      // Col 14: Base imponible gravada (Destino 1)
      // Col 15: IGV / IPM (Destino 1)
      // Col 16: Base Destino 2
      // Col 17: IGV Destino 2
      // Col 18: Base Destino 3
      // Col 19: IGV Destino 3
      // Col 20: No gravadas / Exonerado
      // Col 21: ISC
      // Col 22: ICBPER
      // Col 23: Otros tributos
      // Col 24: Total
      // Col 25: Moneda (PEN/USD)
      // Col 26: Tipo de cambio

      const period = parseCleanText(cols[2] || cols[0]);
      const carSunat = parseCleanText(cols[3]);
      const issueDate = parseSunatDate(cols[4]);
      const dueDate = cols[5] ? parseSunatDate(cols[5]) : undefined;
      const docType = parseCleanText(cols[6]).padStart(2, "0");
      const docSeries = parseCleanText(cols[7]).toUpperCase();
      const docNumber = parseCleanText(cols[9] || cols[8]);
      const supplierDocType = parseCleanText(cols[11] || "6");
      const supplierDocNumber = parseCleanText(cols[12]);
      const supplierName = parseCleanText(cols[13]);

      const baseGravada = parseNumeric(cols[14]);
      const igv = parseNumeric(cols[15]);
      const baseNoGravada = parseNumeric(cols[16]) + parseNumeric(cols[18]);
      const exonerada = parseNumeric(cols[20]);
      const isc = parseNumeric(cols[21]);
      const icbper = parseNumeric(cols[22]);
      const otherTaxes = parseNumeric(cols[23]);
      const total = parseNumeric(cols[24]);

      const rawCurrency = parseCleanText(cols[25]).toUpperCase();
      const currency: "PEN" | "USD" = rawCurrency === "USD" || rawCurrency === "DOL" ? "USD" : "PEN";
      const exchangeRate = parseNumeric(cols[26]) || 1;

      // Documentos de referencia para Notas de Crédito / Débito
      const refDocDate = cols[27] ? parseSunatDate(cols[27]) : undefined;
      const refDocType = cols[28] ? parseCleanText(cols[28]).padStart(2, "0") : undefined;
      const refDocSeries = cols[29] ? parseCleanText(cols[29]) : undefined;
      const refDocNumber = cols[31] || cols[30] ? parseCleanText(cols[31] || cols[30]) : undefined;

      const record: SirePurchaseRecord = {
        carSunat,
        period: period.substring(0, 6),
        supplierDocType,
        supplierDocNumber,
        supplierName,
        docType,
        docSeries,
        docNumber,
        issueDate,
        dueDate,
        baseAmountGravada: baseGravada,
        igvAmount: igv,
        baseAmountNoGravada: baseNoGravada,
        exoneratedAmount: exonerada,
        iscAmount: isc,
        icbperAmount: icbper,
        otherTaxes,
        totalAmount: total,
        currency,
        exchangeRate,
        refDocDate,
        refDocType,
        refDocSeries,
        refDocNumber,
      };

      records.push(record);
      totalAmountSum = totalAmountSum.plus(new Decimal(total));
      totalIgvSum = totalIgvSum.plus(new Decimal(igv));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error de formato";
      errors.push(`Línea ${idx + 1}: ${msg}`);
    }
  }

  return {
    success: records.length > 0,
    records,
    totalRecords: records.length,
    totalAmountSum: totalAmountSum.toNumber(),
    totalIgvSum: totalIgvSum.toNumber(),
    errors,
  };
}

// ------------------------------------------------------------------------------
// 2. PARSER DE PROPUESTA SIRE VENTAS (RVIE)
// ------------------------------------------------------------------------------

/**
 * Parsea el archivo de propuesta del Registro de Ventas e Ingresos Electrónico (RVIE).
 */
export function parseSireSalesFile(fileContent: string): SireParseResult<SireSaleRecord> {
  const records: SireSaleRecord[] = [];
  const errors: string[] = [];

  const lines = fileContent.split(/\r?\n/).filter((l) => l.trim().length > 0);

  let totalAmountSum = new Decimal(0);
  let totalIgvSum = new Decimal(0);

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];

    let cols: string[] = [];
    if (rawLine.includes("|")) {
      cols = rawLine.split("|");
    } else if (rawLine.includes(";")) {
      cols = rawLine.split(";");
    } else {
      cols = rawLine.split(",");
    }

    if (idx === 0 && (cols[0]?.toLowerCase().includes("ruc") || cols[0]?.toLowerCase().includes("periodo"))) {
      continue;
    }

    if (cols.length < 15) {
      errors.push(`Línea ${idx + 1}: Longitud insuficiente de columnas (${cols.length}). Ignorada.`);
      continue;
    }

    try {
      // Estructura RVIE:
      // Col 0: RUC generador
      // Col 1: Razón Social
      // Col 2: Periodo (YYYYMM00)
      // Col 3: CAR SUNAT
      // Col 4: Fecha de emisión
      // Col 5: Fecha de vencimiento
      // Col 6: Tipo de comprobante
      // Col 7: Serie
      // Col 8: Número
      // Col 9: Número final
      // Col 10: Tipo documento cliente
      // Col 11: Número documento cliente
      // Col 12: Razón social cliente
      // Col 13: Exportación
      // Col 14: Base imponible gravada
      // Col 15: Descuento base
      // Col 16: IGV / IPM
      // Col 17: Descuento IGV
      // Col 18: Exonerada
      // Col 19: Inafecta
      // Col 20: ISC
      // Col 21: Base bolsas
      // Col 22: ICBPER
      // Col 23: Otros tributos
      // Col 24: Importe total
      // Col 25: Moneda
      // Col 26: Tipo de cambio

      const period = parseCleanText(cols[2] || cols[0]);
      const carSunat = parseCleanText(cols[3]);
      const issueDate = parseSunatDate(cols[4]);
      const dueDate = cols[5] ? parseSunatDate(cols[5]) : undefined;
      const docType = parseCleanText(cols[6]).padStart(2, "0");
      const docSeries = parseCleanText(cols[7]).toUpperCase();
      const docNumber = parseCleanText(cols[8]);

      const clientDocType = parseCleanText(cols[10] || "6");
      const clientDocNumber = parseCleanText(cols[11]);
      const clientName = parseCleanText(cols[12]);

      const exportAmount = parseNumeric(cols[13]);
      const baseGravada = parseNumeric(cols[14]);
      const discountBase = parseNumeric(cols[15]);
      const igv = parseNumeric(cols[16]);
      const discountIgv = parseNumeric(cols[17]);
      const exonerada = parseNumeric(cols[18]);
      const inafecta = parseNumeric(cols[19]);
      const isc = parseNumeric(cols[20]);
      const icbper = parseNumeric(cols[22]);
      const otherTaxes = parseNumeric(cols[23]);
      const total = parseNumeric(cols[24]);

      const rawCurrency = parseCleanText(cols[25]).toUpperCase();
      const currency: "PEN" | "USD" = rawCurrency === "USD" || rawCurrency === "DOL" ? "USD" : "PEN";
      const exchangeRate = parseNumeric(cols[26]) || 1;

      const record: SireSaleRecord = {
        carSunat,
        period: period.substring(0, 6),
        clientDocType,
        clientDocNumber,
        clientName,
        docType,
        docSeries,
        docNumber,
        issueDate,
        dueDate,
        exportAmount,
        baseAmountGravada: baseGravada,
        discountBaseAmount: discountBase,
        igvAmount: igv,
        discountIgvAmount: discountIgv,
        exoneratedAmount: exonerada,
        inafectoAmount: inafecta,
        iscAmount: isc,
        icbperAmount: icbper,
        otherTaxes,
        totalAmount: total,
        currency,
        exchangeRate,
        state: 1,
      };

      records.push(record);
      totalAmountSum = totalAmountSum.plus(new Decimal(total));
      totalIgvSum = totalIgvSum.plus(new Decimal(igv));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error de formato";
      errors.push(`Línea ${idx + 1}: ${msg}`);
    }
  }

  return {
    success: records.length > 0,
    records,
    totalRecords: records.length,
    totalAmountSum: totalAmountSum.toNumber(),
    totalIgvSum: totalIgvSum.toNumber(),
    errors,
  };
}

// ------------------------------------------------------------------------------
// 3. CONVERSIÓN DE PROPUESTA SIRE A BORRADOR DE ASIENTO CONTABLE (PCGE)
// ------------------------------------------------------------------------------

/**
 * Convierte un registro de compra SIRE en un asiento contable formal:
 * - Cuenta 60111 (Mercaderías) o 63111 (Servicios): Cargo por la Base Imponible
 * - Cuenta 40111 (IGV Cuenta Propia 18%): Cargo por el IGV
 * - Cuenta 42121 (Facturas por Pagar Emitidas): Abono por el Total
 * Si se incluye la configuración de catálogo, genera automáticamente el amarre
 * de Clase 9 y 791.
 */
export function convertSirePurchaseToVoucher(
  record: SirePurchaseRecord,
  accountsCatalog?: Map<string, AccountDestinationConfig>
): ConvertedVoucherDraft {
  const isUSD = record.currency === "USD";
  const tc = new Decimal(record.exchangeRate || 3.75);

  const basePEN = isUSD
    ? new Decimal(record.baseAmountGravada).times(tc).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    : new Decimal(record.baseAmountGravada);
  const baseUSD = isUSD
    ? new Decimal(record.baseAmountGravada)
    : new Decimal(record.baseAmountGravada).dividedBy(tc).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const igvPEN = isUSD
    ? new Decimal(record.igvAmount).times(tc).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    : new Decimal(record.igvAmount);
  const igvUSD = isUSD
    ? new Decimal(record.igvAmount)
    : new Decimal(record.igvAmount).dividedBy(tc).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const totalPEN = isUSD
    ? new Decimal(record.totalAmount).times(tc).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    : new Decimal(record.totalAmount);
  const totalUSD = isUSD
    ? new Decimal(record.totalAmount)
    : new Decimal(record.totalAmount).dividedBy(tc).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const isCreditNote = record.docType === "07";
  const baseGlossary = `${isCreditNote ? "N/CRÉDITO" : "COMPRA"} ${record.docSeries}-${record.docNumber} ${record.supplierName}`;

  // Para Nota de Crédito (Tipo 07) se invierten Débitos y Créditos
  const baseItems: VoucherLineInput[] = [
    {
      lineNumber: 1,
      accountId: "acc-60111",
      accountCode: "60111",
      accountName: "Mercaderías - Manufacturadas",
      entityDocNumber: record.supplierDocNumber,
      docType: `FACTURA_${record.docType}`,
      docSeries: record.docSeries,
      docNumber: record.docNumber,
      docDate: record.issueDate,
      docDueDate: record.dueDate,
      glossary: `Base imponible ${baseGlossary}`,
      debitPEN: isCreditNote ? new Decimal(0) : basePEN,
      creditPEN: isCreditNote ? basePEN : new Decimal(0),
      debitUSD: isCreditNote ? new Decimal(0) : baseUSD,
      creditUSD: isCreditNote ? baseUSD : new Decimal(0),
      isAutoDestination: false,
    },
    {
      lineNumber: 2,
      accountId: "acc-40111",
      accountCode: "40111",
      accountName: "IGV - Cuenta propia 18%",
      entityDocNumber: record.supplierDocNumber,
      docType: `FACTURA_${record.docType}`,
      docSeries: record.docSeries,
      docNumber: record.docNumber,
      docDate: record.issueDate,
      glossary: `IGV 18% ${baseGlossary}`,
      debitPEN: isCreditNote ? new Decimal(0) : igvPEN,
      creditPEN: isCreditNote ? igvPEN : new Decimal(0),
      debitUSD: isCreditNote ? new Decimal(0) : igvUSD,
      creditUSD: isCreditNote ? igvUSD : new Decimal(0),
      isAutoDestination: false,
    },
    {
      lineNumber: 3,
      accountId: "acc-42121",
      accountCode: "42121",
      accountName: "Facturas por pagar - Emitidas de proveedores",
      entityDocNumber: record.supplierDocNumber,
      docType: `FACTURA_${record.docType}`,
      docSeries: record.docSeries,
      docNumber: record.docNumber,
      docDate: record.issueDate,
      docDueDate: record.dueDate,
      glossary: `Total ${baseGlossary}`,
      debitPEN: isCreditNote ? totalPEN : new Decimal(0),
      creditPEN: isCreditNote ? new Decimal(0) : totalPEN,
      debitUSD: isCreditNote ? totalUSD : new Decimal(0),
      creditUSD: isCreditNote ? new Decimal(0) : totalUSD,
      isAutoDestination: false,
    },
  ];

  let finalLines = baseItems;
  if (accountsCatalog) {
    const destResult = generateAutoDestinations(baseItems, accountsCatalog);
    finalLines = destResult.lines;
  }

  return {
    originType: "PURCHASE",
    subdiarioCode: "05",
    date: record.issueDate,
    currency: record.currency,
    exchangeRate: record.exchangeRate,
    glossary: baseGlossary,
    supplierOrClient: {
      docType: record.supplierDocType,
      docNumber: record.supplierDocNumber,
      name: record.supplierName,
    },
    document: {
      docType: record.docType,
      docSeries: record.docSeries,
      docNumber: record.docNumber,
      issueDate: record.issueDate,
      dueDate: record.dueDate,
    },
    amounts: {
      base: record.baseAmountGravada,
      igv: record.igvAmount,
      total: record.totalAmount,
    },
    lines: finalLines,
  };
}

/**
 * Convierte un registro de venta SIRE en un asiento contable formal:
 * - Cuenta 12121 (Facturas por cobrar en cartera): Cargo por el Total
 * - Cuenta 40111 (IGV Cuenta Propia 18%): Abono por el IGV
 * - Cuenta 70121 (Venta de Mercaderías): Abono por la Base Imponible
 */
export function convertSireSaleToVoucher(record: SireSaleRecord): ConvertedVoucherDraft {
  const isUSD = record.currency === "USD";
  const tc = new Decimal(record.exchangeRate || 3.75);

  const basePEN = isUSD
    ? new Decimal(record.baseAmountGravada).times(tc).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    : new Decimal(record.baseAmountGravada);
  const baseUSD = isUSD
    ? new Decimal(record.baseAmountGravada)
    : new Decimal(record.baseAmountGravada).dividedBy(tc).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const igvPEN = isUSD
    ? new Decimal(record.igvAmount).times(tc).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    : new Decimal(record.igvAmount);
  const igvUSD = isUSD
    ? new Decimal(record.igvAmount)
    : new Decimal(record.igvAmount).dividedBy(tc).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const totalPEN = isUSD
    ? new Decimal(record.totalAmount).times(tc).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    : new Decimal(record.totalAmount);
  const totalUSD = isUSD
    ? new Decimal(record.totalAmount)
    : new Decimal(record.totalAmount).dividedBy(tc).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const isCreditNote = record.docType === "07";
  const baseGlossary = `${isCreditNote ? "N/CRÉDITO VTA" : "VENTA"} ${record.docSeries}-${record.docNumber} ${record.clientName}`;

  const lines: VoucherLineInput[] = [
    {
      lineNumber: 1,
      accountId: "acc-12121",
      accountCode: "12121",
      accountName: "Facturas por cobrar - Emitidas en cartera",
      entityDocNumber: record.clientDocNumber,
      docType: `FACTURA_${record.docType}`,
      docSeries: record.docSeries,
      docNumber: record.docNumber,
      docDate: record.issueDate,
      docDueDate: record.dueDate,
      glossary: `Total ${baseGlossary}`,
      debitPEN: isCreditNote ? new Decimal(0) : totalPEN,
      creditPEN: isCreditNote ? totalPEN : new Decimal(0),
      debitUSD: isCreditNote ? new Decimal(0) : totalUSD,
      creditUSD: isCreditNote ? totalUSD : new Decimal(0),
      isAutoDestination: false,
    },
    {
      lineNumber: 2,
      accountId: "acc-40111",
      accountCode: "40111",
      accountName: "IGV - Cuenta propia 18%",
      entityDocNumber: record.clientDocNumber,
      docType: `FACTURA_${record.docType}`,
      docSeries: record.docSeries,
      docNumber: record.docNumber,
      docDate: record.issueDate,
      glossary: `IGV 18% ${baseGlossary}`,
      debitPEN: isCreditNote ? igvPEN : new Decimal(0),
      creditPEN: isCreditNote ? new Decimal(0) : igvPEN,
      debitUSD: isCreditNote ? igvUSD : new Decimal(0),
      creditUSD: isCreditNote ? new Decimal(0) : igvUSD,
      isAutoDestination: false,
    },
    {
      lineNumber: 3,
      accountId: "acc-70111",
      accountCode: "70111",
      accountName: "Ventas de mercaderías al por mayor",
      entityDocNumber: record.clientDocNumber,
      docType: `FACTURA_${record.docType}`,
      docSeries: record.docSeries,
      docNumber: record.docNumber,
      docDate: record.issueDate,
      glossary: `Ingreso ${baseGlossary}`,
      debitPEN: isCreditNote ? basePEN : new Decimal(0),
      creditPEN: isCreditNote ? new Decimal(0) : basePEN,
      debitUSD: isCreditNote ? baseUSD : new Decimal(0),
      creditUSD: isCreditNote ? new Decimal(0) : baseUSD,
      isAutoDestination: false,
    },
  ];

  return {
    originType: "SALE",
    subdiarioCode: "11",
    date: record.issueDate,
    currency: record.currency,
    exchangeRate: record.exchangeRate,
    glossary: baseGlossary,
    supplierOrClient: {
      docType: record.clientDocType,
      docNumber: record.clientDocNumber,
      name: record.clientName,
    },
    document: {
      docType: record.docType,
      docSeries: record.docSeries,
      docNumber: record.docNumber,
      issueDate: record.issueDate,
      dueDate: record.dueDate,
    },
    amounts: {
      base: record.baseAmountGravada,
      igv: record.igvAmount,
      total: record.totalAmount,
    },
    lines,
  };
}

// ------------------------------------------------------------------------------
// 4. GENERADOR DE ESTRUCTURAS OFICIALES SIRE (TXT / REEMPLAZO PROPUESTA)
// ------------------------------------------------------------------------------

/**
 * Genera el archivo plano (.txt) oficial de Reemplazo de la Propuesta de Compras (RCE - Anexo 11).
 * Nombre estándar de archivo SUNAT:
 * LE{RUC}{YYYY}{MM}00080400021111.txt
 */
export function generateSirePurchasesExport(
  companyRuc: string,
  year: number,
  month: number,
  records: SirePurchaseRecord[]
): { fileName: string; content: string } {
  const mm = String(month).padStart(2, "0");
  const fileName = `LE${companyRuc}${year}${mm}00080400021111.txt`;

  const lines = records.map((rec) => {
    const fields = [
      companyRuc,
      rec.period ? `${rec.period}00` : `${year}${mm}00`,
      rec.carSunat || "",
      formatDateSunatOutput(rec.issueDate),
      rec.dueDate ? formatDateSunatOutput(rec.dueDate) : "",
      rec.docType.padStart(2, "0"),
      rec.docSeries,
      "", // Año DUA
      rec.docNumber,
      "", // Nro Final
      rec.supplierDocType || "6",
      rec.supplierDocNumber,
      rec.supplierName,
      rec.baseAmountGravada.toFixed(2),
      rec.igvAmount.toFixed(2),
      rec.baseAmountNoGravada ? rec.baseAmountNoGravada.toFixed(2) : "0.00",
      "0.00", // IGV Destino 2
      "0.00", // Base Destino 3
      "0.00", // IGV Destino 3
      rec.exoneratedAmount ? rec.exoneratedAmount.toFixed(2) : "0.00",
      rec.iscAmount ? rec.iscAmount.toFixed(2) : "0.00",
      rec.icbperAmount ? rec.icbperAmount.toFixed(2) : "0.00",
      rec.otherTaxes ? rec.otherTaxes.toFixed(2) : "0.00",
      rec.totalAmount.toFixed(2),
      rec.currency,
      rec.currency === "USD" ? rec.exchangeRate.toFixed(3) : "",
      rec.refDocDate ? formatDateSunatOutput(rec.refDocDate) : "",
      rec.refDocType || "",
      rec.refDocSeries || "",
      "", // Dependencia Aduanera
      rec.refDocNumber || "",
      rec.detractionDate ? formatDateSunatOutput(rec.detractionDate) : "",
      rec.detractionNumber || "",
      rec.isSubjectToRetention ? "1" : "",
      "", // Clasificación
      "", // Contrato
      "", // Error 1
      "", // Error 2
      "", // Error 3
      "", // Error 4
      "1", // Medio de pago
      "1", // Estado (1 = Activo)
    ];

    return fields.join("|") + "|";
  });

  return {
    fileName,
    content: lines.join("\r\n"),
  };
}

/**
 * Genera el archivo plano (.txt) oficial de Reemplazo de la Propuesta de Ventas (RVIE - Anexo 3).
 * Nombre estándar de archivo SUNAT:
 * LE{RUC}{YYYY}{MM}00140400021111.txt
 */
export function generateSireSalesExport(
  companyRuc: string,
  year: number,
  month: number,
  records: SireSaleRecord[]
): { fileName: string; content: string } {
  const mm = String(month).padStart(2, "0");
  const fileName = `LE${companyRuc}${year}${mm}00140400021111.txt`;

  const lines = records.map((rec) => {
    const fields = [
      companyRuc,
      rec.period ? `${rec.period}00` : `${year}${mm}00`,
      rec.carSunat || "",
      formatDateSunatOutput(rec.issueDate),
      rec.dueDate ? formatDateSunatOutput(rec.dueDate) : "",
      rec.docType.padStart(2, "0"),
      rec.docSeries,
      rec.docNumber,
      "", // Nro Final
      rec.clientDocType || "6",
      rec.clientDocNumber,
      rec.clientName,
      rec.exportAmount ? rec.exportAmount.toFixed(2) : "0.00",
      rec.baseAmountGravada.toFixed(2),
      rec.discountBaseAmount ? rec.discountBaseAmount.toFixed(2) : "0.00",
      rec.igvAmount.toFixed(2),
      rec.discountIgvAmount ? rec.discountIgvAmount.toFixed(2) : "0.00",
      rec.exoneratedAmount ? rec.exoneratedAmount.toFixed(2) : "0.00",
      rec.inafectoAmount ? rec.inafectoAmount.toFixed(2) : "0.00",
      rec.iscAmount ? rec.iscAmount.toFixed(2) : "0.00",
      "0.00", // Base ICBPER
      rec.icbperAmount ? rec.icbperAmount.toFixed(2) : "0.00",
      rec.otherTaxes ? rec.otherTaxes.toFixed(2) : "0.00",
      rec.totalAmount.toFixed(2),
      rec.currency,
      rec.currency === "USD" ? rec.exchangeRate.toFixed(3) : "",
      rec.refDocDate ? formatDateSunatOutput(rec.refDocDate) : "",
      rec.refDocType || "",
      rec.refDocSeries || "",
      rec.refDocNumber || "",
      "", // Contrato
      "", // Error 1
      "1", // Medio pago
      rec.state.toString(), // 1 = Activo, 2 = Anulado
    ];

    return fields.join("|") + "|";
  });

  return {
    fileName,
    content: lines.join("\r\n"),
  };
}

// ------------------------------------------------------------------------------
// HELPERS DE PARSEO Y FORMATEO
// ------------------------------------------------------------------------------

function parseCleanText(val: string | undefined): string {
  if (!val) return "";
  return val.replace(/^["']|["']$/g, "").trim();
}

function parseNumeric(val: string | undefined): number {
  if (!val) return 0;
  const clean = val.replace(/^["']|["']$/g, "").replace(/\s+/g, "").replace(/,/g, ".");
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

function parseSunatDate(val: string | undefined): string {
  if (!val) return new Date().toISOString().split("T")[0];
  const clean = parseCleanText(val);

  // Formato DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split("/");
    return `${y}-${m}-${d}`;
  }

  // Formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // Formato DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split("-");
    return `${y}-${m}-${d}`;
  }

  return clean;
}

function formatDateSunatOutput(val: string | undefined): string {
  if (!val) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split("-");
    return `${d}/${m}/${y}`;
  }
  return val;
}
