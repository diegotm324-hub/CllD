// ==============================================================================
// ContablePro - Motor de Reportes Financieros y Tributarios (SUNAT / PCGE)
// Balance de Comprobación (10/12 Columnas), Libro Diario PLE 5.1 y Mayor PLE 6.1
// Exportación nativa a Excel profesional (.xlsx) con ExcelJS
// ==============================================================================

import Decimal from "decimal.js";
import ExcelJS from "exceljs";

// ------------------------------------------------------------------------------
// TIPOS Y ESTRUCTURAS DE DATOS
// ------------------------------------------------------------------------------

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  level: "ELEMENTO" | "CUENTA" | "SUBCUENTA" | "DIVISIONARIA" | "SUBDIVISIONARIA";

  // 1 & 2. Sumas del Mayor
  debitSum: number;
  creditSum: number;

  // 3 & 4. Saldos
  debitBalance: number;
  creditBalance: number;

  // 5 & 6. Transferencias y Ajustes (Clase 9 y 79)
  transferDebit: number;
  transferCredit: number;

  // 7 & 8. Situación Financiera / Inventario (Cuentas 1 a 5)
  inventoryAsset: number;
  inventoryLiability: number;

  // 9 & 10. Resultados por Naturaleza (Cuentas 6 y 7, excepto 79/Clase 9)
  natureLoss: number;
  natureGain: number;

  // 11 & 12. Resultados por Función (Clase 9, 69, 67, 7)
  functionLoss: number;
  functionGain: number;
}

export interface TrialBalanceSummary {
  rows: TrialBalanceRow[];

  // Totales
  totals: {
    debitSum: number;
    creditSum: number;
    debitBalance: number;
    creditBalance: number;
    transferDebit: number;
    transferCredit: number;
    inventoryAsset: number;
    inventoryLiability: number;
    natureLoss: number;
    natureGain: number;
    functionLoss: number;
    functionGain: number;
  };

  // Cuadre del Resultado del Ejercicio (Utilidad o Pérdida)
  result: {
    inventoryProfit: number;   // Activo - Pasivo
    natureProfit: number;      // Ganancia - Pérdida
    functionProfit: number;    // Ganancia - Pérdida
    isBalanced: boolean;       // Coincidencia exacta de los 3 métodos
    difference: number;
  };
}

export interface JournalEntryMovement {
  voucherId: string;
  voucherNumber: string;
  subdiarioCode: string;
  subdiarioName: string;
  date: string;
  lineNumber: number;
  accountCode: string;
  accountName: string;
  entityDocType?: string | null;
  entityDocNumber?: string | null;
  entityBusinessName?: string | null;
  docType?: string | null;
  docSeries?: string | null;
  docNumber?: string | null;
  docDate?: string | null;
  glossary: string;
  currency: "PEN" | "USD";
  exchangeRate: number;
  debitPEN: number;
  creditPEN: number;
  debitUSD: number;
  creditUSD: number;
}

// ------------------------------------------------------------------------------
// 1. CÁLCULO DEL BALANCE DE COMPROBACIÓN (HOJA DE TRABAJO DE 10/12 COLUMNAS)
// ------------------------------------------------------------------------------

/**
 * Procesa todos los movimientos contables del periodo y genera la Hoja de Trabajo
 * oficial de Balance de Comprobación con validación estricta de la utilidad/pérdida
 * cuadrando entre Situación Financiera, Naturaleza y Función.
 */
export function calculateTrialBalance(
  movements: JournalEntryMovement[],
  accountsCatalog?: Map<string, { code: string; name: string }>
): TrialBalanceSummary {
  // 1. Acumular débitos y créditos por código de cuenta
  const mapSums = new Map<
    string,
    {
      accountCode: string;
      accountName: string;
      debitSum: Decimal;
      creditSum: Decimal;
    }
  >();

  for (const m of movements) {
    const code = m.accountCode.trim();
    const existing = mapSums.get(code);

    const dPEN = new Decimal(m.debitPEN || 0);
    const cPEN = new Decimal(m.creditPEN || 0);

    if (existing) {
      existing.debitSum = existing.debitSum.plus(dPEN);
      existing.creditSum = existing.creditSum.plus(cPEN);
    } else {
      let name = m.accountName;
      if (!name && accountsCatalog?.has(code)) {
        name = accountsCatalog.get(code)!.name;
      }
      mapSums.set(code, {
        accountCode: code,
        accountName: name || `Cuenta ${code}`,
        debitSum: dPEN,
        creditSum: cPEN,
      });
    }
  }

  // 2. Ordenar cuentas numéricamente según el PCGE
  const sortedCodes = Array.from(mapSums.keys()).sort((a, b) => a.localeCompare(b));

  const rows: TrialBalanceRow[] = [];

  let totDebitSum = new Decimal(0);
  let totCreditSum = new Decimal(0);
  let totDebitBal = new Decimal(0);
  let totCreditBal = new Decimal(0);
  let totTransDebit = new Decimal(0);
  let totTransCredit = new Decimal(0);
  let totInvAsset = new Decimal(0);
  let totInvLiab = new Decimal(0);
  let totNatLoss = new Decimal(0);
  let totNatGain = new Decimal(0);
  let totFuncLoss = new Decimal(0);
  let totFuncGain = new Decimal(0);

  for (const code of sortedCodes) {
    const item = mapSums.get(code)!;
    const debitSum = item.debitSum;
    const creditSum = item.creditSum;

    // Saldos (Deudor / Acreedor)
    let debitBal = new Decimal(0);
    let creditBal = new Decimal(0);

    if (debitSum.gt(creditSum)) {
      debitBal = debitSum.minus(creditSum);
    } else if (creditSum.gt(debitSum)) {
      creditBal = creditSum.minus(debitSum);
    }

    // Identificar elemento PCGE
    const element = code.charAt(0);
    const prefix2 = code.substring(0, 2);

    let transDebit = new Decimal(0);
    let transCredit = new Decimal(0);
    let invAsset = new Decimal(0);
    let invLiab = new Decimal(0);
    let natLoss = new Decimal(0);
    let natGain = new Decimal(0);
    let funcLoss = new Decimal(0);
    let funcGain = new Decimal(0);

    // Ajustes por Transferencia (Clase 9 vs 79)
    if (element === "9") {
      // Gastos por función se transfieren en el haber para cerrar
      transCredit = debitBal;
    } else if (prefix2 === "79") {
      // Cargas imputables a costos y gastos se transfieren en el debe
      transDebit = creditBal;
    }

    // Distribución a Inventario / Balance (Elementos 1, 2, 3, 4, 5)
    if (["1", "2", "3"].includes(element)) {
      // Cuentas de evaluación y depreciación acumulada (19, 29, 39) tienen naturaleza acreedora
      if (["19", "29", "39"].includes(prefix2)) {
        invLiab = creditBal;
      } else {
        invAsset = debitBal;
      }
    } else if (["4", "5"].includes(element)) {
      invLiab = creditBal;
    }

    // Distribución a Resultados por Naturaleza (Cuentas 6 y 7, excepto 69 y 79)
    if (element === "6") {
      natLoss = debitBal;
    } else if (element === "7" && prefix2 !== "79") {
      natGain = creditBal;
    }

    // Distribución a Resultados por Función (Clase 9, 69 Costo de ventas, 67 Financieros, y Clase 7)
    if (element === "9" || prefix2 === "69" || prefix2 === "67") {
      funcLoss = debitBal;
    } else if (element === "7" && prefix2 !== "79") {
      funcGain = creditBal;
    }

    // Nivel de desagregación
    let level: TrialBalanceRow["level"] = "SUBDIVISIONARIA";
    if (code.length === 1) level = "ELEMENTO";
    else if (code.length === 2) level = "CUENTA";
    else if (code.length === 3) level = "SUBCUENTA";
    else if (code.length === 4) level = "DIVISIONARIA";

    rows.push({
      accountCode: code,
      accountName: item.accountName,
      level,
      debitSum: debitSum.toNumber(),
      creditSum: creditSum.toNumber(),
      debitBalance: debitBal.toNumber(),
      creditBalance: creditBal.toNumber(),
      transferDebit: transDebit.toNumber(),
      transferCredit: transCredit.toNumber(),
      inventoryAsset: invAsset.toNumber(),
      inventoryLiability: invLiab.toNumber(),
      natureLoss: natLoss.toNumber(),
      natureGain: natGain.toNumber(),
      functionLoss: funcLoss.toNumber(),
      functionGain: funcGain.toNumber(),
    });

    totDebitSum = totDebitSum.plus(debitSum);
    totCreditSum = totCreditSum.plus(creditSum);
    totDebitBal = totDebitBal.plus(debitBal);
    totCreditBal = totCreditBal.plus(creditBal);
    totTransDebit = totTransDebit.plus(transDebit);
    totTransCredit = totTransCredit.plus(transCredit);
    totInvAsset = totInvAsset.plus(invAsset);
    totInvLiab = totInvLiab.plus(invLiab);
    totNatLoss = totNatLoss.plus(natLoss);
    totNatGain = totNatGain.plus(natGain);
    totFuncLoss = totFuncLoss.plus(funcLoss);
    totFuncGain = totFuncGain.plus(funcGain);
  }

  // Cálculo de resultados del ejercicio
  const inventoryProfit = totInvAsset.minus(totInvLiab).toNumber();
  const natureProfit = totNatGain.minus(totNatLoss).toNumber();
  const functionProfit = totFuncGain.minus(totFuncLoss).toNumber();

  const diff1 = Math.abs(inventoryProfit - natureProfit);
  const diff2 = Math.abs(natureProfit - functionProfit);
  const isBalanced = diff1 <= 0.05 && diff2 <= 0.05;

  return {
    rows,
    totals: {
      debitSum: totDebitSum.toNumber(),
      creditSum: totCreditSum.toNumber(),
      debitBalance: totDebitBal.toNumber(),
      creditBalance: totCreditBal.toNumber(),
      transferDebit: totTransDebit.toNumber(),
      transferCredit: totTransCredit.toNumber(),
      inventoryAsset: totInvAsset.toNumber(),
      inventoryLiability: totInvLiab.toNumber(),
      natureLoss: totNatLoss.toNumber(),
      natureGain: totNatGain.toNumber(),
      functionLoss: totFuncLoss.toNumber(),
      functionGain: totFuncGain.toNumber(),
    },
    result: {
      inventoryProfit,
      natureProfit,
      functionProfit,
      isBalanced,
      difference: Math.max(diff1, diff2),
    },
  };
}

// ------------------------------------------------------------------------------
// 2. GENERADOR LIBRO DIARIO PLE 5.1 (SUNAT)
// ------------------------------------------------------------------------------

/**
 * Genera el archivo plano oficial del Libro Diario Electrónico (PLE 5.1).
 * Formato SUNAT: LE{RUC}{YYYY}{MM}00050100001111.txt
 */
export function generatePleLibroDiario(
  companyRuc: string,
  year: number,
  month: number,
  movements: JournalEntryMovement[]
): { fileName: string; content: string } {
  const mm = String(month).padStart(2, "0");
  const fileName = `LE${companyRuc}${year}${mm}00050100001111.txt`;

  const lines = movements.map((m, idx) => {
    const fields = [
      `${year}${mm}00`,                                   // 1: Periodo (YYYYMM00)
      m.voucherNumber || `ASIENTO_${idx + 1}`,             // 2: CUO (Código Único de Operación)
      `M${String(m.lineNumber).padStart(6, "0")}`,         // 3: Correlativo del Asiento
      m.accountCode,                                       // 4: Código Cuenta PCGE
      "",                                                  // 5: Unidad de Operación
      "",                                                  // 6: Centro de Costos
      m.currency === "USD" ? "USD" : "PEN",                // 7: Moneda origen
      m.entityDocType || "6",                              // 8: Tipo Doc Identidad
      m.entityDocNumber || "",                             // 9: Nro Doc Identidad
      m.docType ? m.docType.replace("FACTURA_", "") : "00",// 10: Tipo Comprobante Pago
      m.docSeries || "",                                   // 11: Serie Comprobante
      m.docNumber || "",                                   // 12: Número Comprobante
      formatPleDate(m.date),                               // 13: Fecha Contable
      m.docDate ? formatPleDate(m.docDate) : "",           // 14: Fecha Vencimiento
      formatPleDate(m.date),                               // 15: Fecha Operación
      m.glossary || "Operación regular",                   // 16: Glosa principal
      "",                                                  // 17: Glosa referencial
      m.debitPEN.toFixed(2),                               // 18: Debe en Soles
      m.creditPEN.toFixed(2),                              // 19: Haber en Soles
      "",                                                  // 20: Dato estructurado
      "1",                                                 // 21: Estado de operación (1 = Regular)
    ];

    return fields.join("|") + "|";
  });

  return {
    fileName,
    content: lines.join("\r\n"),
  };
}

// ------------------------------------------------------------------------------
// 3. GENERADOR LIBRO MAYOR PLE 6.1 (SUNAT)
// ------------------------------------------------------------------------------

/**
 * Genera el archivo plano oficial del Libro Mayor Electrónico (PLE 6.1).
 * Formato SUNAT: LE{RUC}{YYYY}{MM}00060100001111.txt
 */
export function generatePleLibroMayor(
  companyRuc: string,
  year: number,
  month: number,
  movements: JournalEntryMovement[]
): { fileName: string; content: string } {
  const mm = String(month).padStart(2, "0");
  const fileName = `LE${companyRuc}${year}${mm}00060100001111.txt`;

  const lines = movements.map((m, idx) => {
    const fields = [
      `${year}${mm}00`,
      m.voucherNumber || `ASIENTO_${idx + 1}`,
      `M${String(m.lineNumber).padStart(6, "0")}`,
      m.accountCode,
      formatPleDate(m.date),
      m.glossary || "Movimiento del mayor",
      m.debitPEN.toFixed(2),
      m.creditPEN.toFixed(2),
      "1", // Estado
    ];

    return fields.join("|") + "|";
  });

  return {
    fileName,
    content: lines.join("\r\n"),
  };
}

// ------------------------------------------------------------------------------
// 4. EXPORTACIÓN PROFESIONAL A EXCEL (.XLSX) CON EXCELJS
// ------------------------------------------------------------------------------

/**
 * Genera un archivo Excel (.xlsx) estilizado del Balance de Comprobación de 10 Columnas.
 */
export async function exportTrialBalanceToExcelBuffer(
  companyName: string,
  companyRuc: string,
  periodDesc: string,
  summary: TrialBalanceSummary
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ContablePro ERP";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Balance de Comprobación", {
    views: [{ showGridLines: true }],
  });

  // 1. Título y Cabecera de la Empresa
  worksheet.mergeCells("A1:L1");
  worksheet.getCell("A1").value = companyName.toUpperCase();
  worksheet.getCell("A1").font = { name: "Arial", size: 14, bold: true, color: { argb: "FF1E293B" } };

  worksheet.mergeCells("A2:L2");
  worksheet.getCell("A2").value = `RUC: ${companyRuc} • HOJA DE TRABAJO - BALANCE DE COMPROBACIÓN (${periodDesc})`;
  worksheet.getCell("A2").font = { name: "Arial", size: 10, italic: true, color: { argb: "FF64748B" } };

  worksheet.addRow([]); // Espaciado

  // 2. Encabezados Agrupados (Fila 4 y 5)
  worksheet.mergeCells("A4:B4");
  worksheet.getCell("A4").value = "CUENTA CONTABLE";
  worksheet.mergeCells("C4:D4");
  worksheet.getCell("C4").value = "SUMAS DEL MAYOR";
  worksheet.mergeCells("E4:F4");
  worksheet.getCell("E4").value = "SALDOS";
  worksheet.mergeCells("G4:H4");
  worksheet.getCell("G4").value = "TRANSFERENCIAS";
  worksheet.mergeCells("I4:J4");
  worksheet.getCell("I4").value = "SITUACIÓN FINANCIERA";
  worksheet.mergeCells("K4:L4");
  worksheet.getCell("K4").value = "RESULTADOS (NATURALEZA)";

  const subHeaderRow = worksheet.addRow([
    "CÓDIGO",
    "DENOMINACIÓN",
    "DEBE",
    "HABER",
    "DEUDOR",
    "ACREEDOR",
    "DEBE",
    "HABER",
    "ACTIVO",
    "PASIVO",
    "PÉRDIDA",
    "GANANCIA",
  ]);

  // Estilos de Cabecera
  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };

  ["A4", "C4", "E4", "G4", "I4", "K4"].forEach((cellRef) => {
    const cell = worksheet.getCell(cellRef);
    cell.fill = headerFill;
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  subHeaderRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" },
    };
    cell.font = { name: "Arial", size: 8, bold: true, color: { argb: "FFE2E8F0" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  // 3. Filas de Cuentas Contables
  summary.rows.forEach((r, idx) => {
    const isLevelGroup = r.accountCode.length <= 2;
    const row = worksheet.addRow([
      r.accountCode,
      r.accountName,
      r.debitSum || null,
      r.creditSum || null,
      r.debitBalance || null,
      r.creditBalance || null,
      r.transferDebit || null,
      r.transferCredit || null,
      r.inventoryAsset || null,
      r.inventoryLiability || null,
      r.natureLoss || null,
      r.natureGain || null,
    ]);

    row.font = {
      name: "Arial",
      size: 9,
      bold: isLevelGroup,
      color: { argb: isLevelGroup ? "FF0F172A" : "FF334155" },
    };

    if (idx % 2 === 1 && !isLevelGroup) {
      row.eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      });
    }

    // Formato moneda
    for (let col = 3; col <= 12; col++) {
      row.getCell(col).numFmt = "#,##0.00;(#,##0.00);\"-\"";
    }
  });

  // 4. Fila de Totales
  const t = summary.totals;
  const totRow = worksheet.addRow([
    "TOTALES",
    "",
    t.debitSum,
    t.creditSum,
    t.debitBalance,
    t.creditBalance,
    t.transferDebit,
    t.transferCredit,
    t.inventoryAsset,
    t.inventoryLiability,
    t.natureLoss,
    t.natureGain,
  ]);

  totRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF0F172A" } };
    cell.border = { top: { style: "thin" }, bottom: { style: "double" } };
  });

  for (let col = 3; col <= 12; col++) {
    totRow.getCell(col).numFmt = "#,##0.00;(#,##0.00);\"-\"";
  }

  // 5. Fila de Utilidad / Pérdida del Ejercicio
  const res = summary.result;
  const isProfit = res.inventoryProfit >= 0;
  const absProfit = Math.abs(res.inventoryProfit);

  const resRow = worksheet.addRow([
    isProfit ? "UTILIDAD NETA DEL EJERCICIO" : "PÉRDIDA NETA DEL EJERCICIO",
    "",
    null,
    null,
    null,
    null,
    null,
    null,
    isProfit ? null : absProfit,
    isProfit ? absProfit : null,
    isProfit ? absProfit : null,
    isProfit ? null : absProfit,
  ]);

  resRow.eachCell((cell) => {
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: isProfit ? "FF047857" : "FFBE123C" } };
  });

  for (let col = 3; col <= 12; col++) {
    resRow.getCell(col).numFmt = "#,##0.00;(#,##0.00);\"-\"";
  }

  // Anchos de Columna
  worksheet.getColumn(1).width = 12;
  worksheet.getColumn(2).width = 36;
  for (let col = 3; col <= 12; col++) {
    worksheet.getColumn(col).width = 15;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function formatPleDate(val: string): string {
  if (!val) return "";
  const datePart = val.split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [y, m, d] = datePart.split("-");
    return `${d}/${m}/${y}`;
  }
  return val;
}
