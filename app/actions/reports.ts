"use server";

import prisma from "@/lib/prisma";
import Decimal from "decimal.js";
import {
  calculateTrialBalance,
  generatePleLibroDiario,
  generatePleLibroMayor,
  exportTrialBalanceToExcelBuffer,
  JournalEntryMovement,
  TrialBalanceSummary,
} from "@/lib/accounting/reports";
import {
  calculateExchangeDifference,
  ExchangeDifferenceCalculationResult,
} from "@/lib/accounting/exchangeDifference";
import { saveVoucherAction } from "./vouchers";
import { serializeDecimals } from "@/lib/utils/serialize";

// Movimientos de demostración representativos para periodos sin asientos registrados
const DEMO_MOVEMENTS: JournalEntryMovement[] = [
  // 1. Asiento de Apertura (Subdiario 01)
  {
    voucherId: "v-010001",
    voucherNumber: "010001",
    subdiarioCode: "01",
    subdiarioName: "Asiento de Apertura",
    date: "2026-03-01",
    lineNumber: 1,
    accountCode: "10411",
    accountName: "Cuentas corrientes operativas - BCP Soles",
    glossary: "Por la apertura del ejercicio comercial",
    currency: "PEN",
    exchangeRate: 3.755,
    debitPEN: 50000,
    creditPEN: 0,
    debitUSD: 13315.58,
    creditUSD: 0,
  },
  {
    voucherId: "v-010001",
    voucherNumber: "010001",
    subdiarioCode: "01",
    subdiarioName: "Asiento de Apertura",
    date: "2026-03-01",
    lineNumber: 2,
    accountCode: "10412",
    accountName: "Cuentas corrientes operativas - BCP Dólares",
    glossary: "Por la apertura del ejercicio comercial",
    currency: "USD",
    exchangeRate: 3.755,
    debitPEN: 37550, // $10,000 * 3.755
    creditPEN: 0,
    debitUSD: 10000,
    creditUSD: 0,
  },
  {
    voucherId: "v-010001",
    voucherNumber: "010001",
    subdiarioCode: "01",
    subdiarioName: "Asiento de Apertura",
    date: "2026-03-01",
    lineNumber: 3,
    accountCode: "50111",
    accountName: "Capital social - Acciones comunes",
    glossary: "Aporte de capital social según minuta",
    currency: "PEN",
    exchangeRate: 3.755,
    debitPEN: 0,
    creditPEN: 87550,
    debitUSD: 0,
    creditUSD: 23315.58,
  },

  // 2. Compra de Mercaderías (Subdiario 05)
  {
    voucherId: "v-050001",
    voucherNumber: "050001",
    subdiarioCode: "05",
    subdiarioName: "Registro de Compras",
    date: "2026-03-10",
    lineNumber: 1,
    accountCode: "60111",
    accountName: "Mercaderías - Manufacturadas",
    entityDocNumber: "20100047218",
    entityBusinessName: "DISTRIBUIDORA LIMA S.A.C.",
    docType: "01",
    docSeries: "F001",
    docNumber: "0004520",
    glossary: "Compra de mercaderías F/F001-4520",
    currency: "PEN",
    exchangeRate: 3.755,
    debitPEN: 10000,
    creditPEN: 0,
    debitUSD: 2663.12,
    creditUSD: 0,
  },
  {
    voucherId: "v-050001",
    voucherNumber: "050001",
    subdiarioCode: "05",
    subdiarioName: "Registro de Compras",
    date: "2026-03-10",
    lineNumber: 2,
    accountCode: "40111",
    accountName: "IGV - Cuenta propia 18%",
    entityDocNumber: "20100047218",
    glossary: "IGV 18% F/F001-4520",
    currency: "PEN",
    exchangeRate: 3.755,
    debitPEN: 1800,
    creditPEN: 0,
    debitUSD: 479.36,
    creditUSD: 0,
  },
  {
    voucherId: "v-050001",
    voucherNumber: "050001",
    subdiarioCode: "05",
    subdiarioName: "Registro de Compras",
    date: "2026-03-10",
    lineNumber: 3,
    accountCode: "42121",
    accountName: "Facturas por pagar - Emitidas",
    entityDocNumber: "20100047218",
    docType: "01",
    docSeries: "F001",
    docNumber: "0004520",
    glossary: "Provisión F/F001-4520",
    currency: "PEN",
    exchangeRate: 3.755,
    debitPEN: 0,
    creditPEN: 11800,
    debitUSD: 0,
    creditUSD: 3142.48,
  },

  // 3. Destino de Compras a Existencias (Clase 2 vs 61)
  {
    voucherId: "v-050001",
    voucherNumber: "050001",
    subdiarioCode: "05",
    subdiarioName: "Registro de Compras",
    date: "2026-03-10",
    lineNumber: 4,
    accountCode: "20111",
    accountName: "Mercaderías manufacturadas (Almacén)",
    glossary: "[Destino Existencias] Ingreso a almacén",
    currency: "PEN",
    exchangeRate: 3.755,
    debitPEN: 10000,
    creditPEN: 0,
    debitUSD: 2663.12,
    creditUSD: 0,
  },
  {
    voucherId: "v-050001",
    voucherNumber: "050001",
    subdiarioCode: "05",
    subdiarioName: "Registro de Compras",
    date: "2026-03-10",
    lineNumber: 5,
    accountCode: "61111",
    accountName: "Variación de existencias - Mercaderías",
    glossary: "[Destino Existencias] Variación almacén",
    currency: "PEN",
    exchangeRate: 3.755,
    debitPEN: 0,
    creditPEN: 10000,
    debitUSD: 0,
    creditUSD: 2663.12,
  },

  // 4. Venta de Mercaderías (Subdiario 11)
  {
    voucherId: "v-110001",
    voucherNumber: "110001",
    subdiarioCode: "11",
    subdiarioName: "Registro de Ventas",
    date: "2026-03-18",
    lineNumber: 1,
    accountCode: "12121",
    accountName: "Facturas por cobrar - Emitidas en cartera",
    entityDocNumber: "20543210981",
    entityBusinessName: "IMPORTACIONES GLOBALES S.A.",
    docType: "01",
    docSeries: "F001",
    docNumber: "0000150",
    glossary: "Venta de mercaderías F/F001-150",
    currency: "USD",
    exchangeRate: 3.755,
    debitPEN: 18775, // $5,000 * 3.755
    creditPEN: 0,
    debitUSD: 5000,
    creditUSD: 0,
  },
  {
    voucherId: "v-110001",
    voucherNumber: "110001",
    subdiarioCode: "11",
    subdiarioName: "Registro de Ventas",
    date: "2026-03-18",
    lineNumber: 2,
    accountCode: "40111",
    accountName: "IGV - Cuenta propia 18%",
    glossary: "IGV 18% F/F001-150",
    currency: "USD",
    exchangeRate: 3.755,
    debitPEN: 0,
    creditPEN: 2863.98,
    debitUSD: 0,
    creditUSD: 762.71,
  },
  {
    voucherId: "v-110001",
    voucherNumber: "110001",
    subdiarioCode: "11",
    subdiarioName: "Registro de Ventas",
    date: "2026-03-18",
    lineNumber: 3,
    accountCode: "70121",
    accountName: "Venta de mercaderías al por mayor",
    glossary: "Venta F/F001-150",
    currency: "USD",
    exchangeRate: 3.755,
    debitPEN: 0,
    creditPEN: 15911.02,
    debitUSD: 0,
    creditUSD: 4237.29,
  },

  // 5. Costo de Ventas (Subdiario 34)
  {
    voucherId: "v-340001",
    voucherNumber: "340001",
    subdiarioCode: "34",
    subdiarioName: "Costo de Ventas",
    date: "2026-03-31",
    lineNumber: 1,
    accountCode: "69111",
    accountName: "Costo de ventas - Mercaderías manufacturadas",
    glossary: "Costo de ventas del mes de marzo",
    currency: "PEN",
    exchangeRate: 3.755,
    debitPEN: 6000,
    creditPEN: 0,
    debitUSD: 1597.87,
    creditUSD: 0,
  },
  {
    voucherId: "v-340001",
    voucherNumber: "340001",
    subdiarioCode: "34",
    subdiarioName: "Costo de Ventas",
    date: "2026-03-31",
    lineNumber: 2,
    accountCode: "20111",
    accountName: "Mercaderías manufacturadas (Almacén)",
    glossary: "Salida por costo de ventas",
    currency: "PEN",
    exchangeRate: 3.755,
    debitPEN: 0,
    creditPEN: 6000,
    debitUSD: 0,
    creditUSD: 1597.87,
  },

  // 6. Gasto Administrativo con Destino (Subdiario 05)
  {
    voucherId: "v-050002",
    voucherNumber: "050002",
    subdiarioCode: "05",
    subdiarioName: "Registro de Compras",
    date: "2026-03-22",
    lineNumber: 1,
    accountCode: "63211",
    accountName: "Asesoría contable y tributaria",
    glossary: "Servicios profesionales de auditoría",
    currency: "PEN",
    exchangeRate: 3.755,
    debitPEN: 2000,
    creditPEN: 0,
    debitUSD: 532.62,
    creditUSD: 0,
  },
  {
    voucherId: "v-050002",
    voucherNumber: "050002",
    subdiarioCode: "05",
    subdiarioName: "Registro de Compras",
    date: "2026-03-22",
    lineNumber: 2,
    accountCode: "40111",
    accountName: "IGV - Cuenta propia 18%",
    glossary: "IGV 18% servicios de auditoría",
    currency: "PEN",
    exchangeRate: 3.755,
    debitPEN: 360,
    creditPEN: 0,
    debitUSD: 95.87,
    creditUSD: 0,
  },
  {
    voucherId: "v-050002",
    voucherNumber: "050002",
    subdiarioCode: "05",
    subdiarioName: "Registro de Compras",
    date: "2026-03-22",
    lineNumber: 3,
    accountCode: "42121",
    accountName: "Facturas por pagar - Emitidas",
    glossary: "Provisión honorarios auditoría",
    currency: "PEN",
    exchangeRate: 3.755,
    debitPEN: 0,
    creditPEN: 2360,
    debitUSD: 0,
    creditUSD: 628.49,
  },
  {
    voucherId: "v-050002",
    voucherNumber: "050002",
    subdiarioCode: "05",
    subdiarioName: "Registro de Compras",
    date: "2026-03-22",
    lineNumber: 4,
    accountCode: "94111",
    accountName: "Gastos de Administración",
    glossary: "[Destino] Gastos de administración",
    currency: "PEN",
    exchangeRate: 3.755,
    debitPEN: 2000,
    creditPEN: 0,
    debitUSD: 532.62,
    creditUSD: 0,
  },
  {
    voucherId: "v-050002",
    voucherNumber: "050002",
    subdiarioCode: "05",
    subdiarioName: "Registro de Compras",
    date: "2026-03-22",
    lineNumber: 5,
    accountCode: "79111",
    accountName: "Cargas imputables a cuentas de costos y gastos",
    glossary: "[Destino 79] Imputación gastos",
    currency: "PEN",
    exchangeRate: 3.755,
    debitPEN: 0,
    creditPEN: 2000,
    debitUSD: 0,
    creditUSD: 532.62,
  },
];

/**
 * Obtiene los datos integrados del periodo para Libro Diario, Mayor,
 * Balance de Comprobación y evaluación de Diferencia de Cambio.
 */
export async function getReportDataAction(
  year: number = 2026,
  month: number = 3,
  closingPurchaseTc: number = 3.76,
  closingSaleTc: number = 3.768
) {
  try {
    // 1. Consultar base de datos
    let movements: JournalEntryMovement[] = [];

    const dbVouchers = await prisma.voucher.findMany({
      where: {
        fiscalPeriod: { year, month },
        status: { not: "ANULADO" },
      },
      include: {
        subdiario: true,
        items: {
          include: {
            account: true,
            entity: true,
          },
          orderBy: { lineNumber: "asc" },
        },
      },
      orderBy: [{ date: "asc" }, { voucherNumber: "asc" }],
    });

    if (dbVouchers.length > 0) {
      for (const v of dbVouchers) {
        for (const it of v.items) {
          movements.push({
            voucherId: v.id,
            voucherNumber: v.voucherNumber,
            subdiarioCode: v.subdiario.code,
            subdiarioName: v.subdiario.name,
            date: v.date.toISOString().split("T")[0],
            lineNumber: it.lineNumber,
            accountCode: it.account.code,
            accountName: it.account.name,
            entityDocType: it.entity?.docType,
            entityDocNumber: it.entity?.docNumber,
            entityBusinessName: it.entity?.businessName,
            docType: it.docType,
            docSeries: it.docSeries,
            docNumber: it.docNumber,
            docDate: it.docDate?.toISOString().split("T")[0],
            glossary: it.glossary,
            currency: v.currency as "PEN" | "USD",
            exchangeRate: v.exchangeRate.toNumber(),
            debitPEN: it.debitPEN.toNumber(),
            creditPEN: it.creditPEN.toNumber(),
            debitUSD: it.debitUSD.toNumber(),
            creditUSD: it.creditUSD.toNumber(),
          });
        }
      }
    } else {
      // Usar movimientos demo contables si no hay datos en la DB
      movements = DEMO_MOVEMENTS;
    }

    // 2. Calcular Balance de Comprobación de 10 Columnas
    const trialBalance = calculateTrialBalance(movements);

    // 3. Preparar saldos de cuentas monetarias para Diferencia de Cambio
    const accountBalancesForExchange = trialBalance.rows.map((r) => {
      // Calcular débitos y créditos en USD a partir de los movimientos
      const filtered = movements.filter((m) => m.accountCode === r.accountCode);
      const dUSD = filtered.reduce((acc, it) => acc + (it.debitUSD || 0), 0);
      const cUSD = filtered.reduce((acc, it) => acc + (it.creditUSD || 0), 0);

      return {
        accountCode: r.accountCode,
        accountName: r.accountName,
        debitPEN: r.debitSum,
        creditPEN: r.creditSum,
        debitUSD: dUSD,
        creditUSD: cUSD,
      };
    });

    // 4. Calcular previsualización de Ajuste por Diferencia de Cambio
    const closingDate = `${year}-${String(month).padStart(2, "0")}-31`;
    const exchangeDiff = calculateExchangeDifference(
      accountBalancesForExchange,
      closingPurchaseTc,
      closingSaleTc,
      closingDate
    );

    return serializeDecimals({
      success: true,
      movements,
      trialBalance,
      exchangeDiff,
    });
  } catch (err: unknown) {
    console.error("Error en getReportDataAction:", err);
    return serializeDecimals({
      success: false,
      error: err instanceof Error ? err.message : "Error al consultar reportes contables.",
      movements: DEMO_MOVEMENTS,
      trialBalance: calculateTrialBalance(DEMO_MOVEMENTS),
      exchangeDiff: calculateExchangeDifference(
        DEMO_MOVEMENTS.map((m) => ({
          accountCode: m.accountCode,
          accountName: m.accountName,
          debitPEN: m.debitPEN,
          creditPEN: m.creditPEN,
          debitUSD: m.debitUSD,
          creditUSD: m.creditUSD,
        })),
        closingPurchaseTc,
        closingSaleTc,
        `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`
      ),
    });
  }
}

/**
 * Ejecuta el asiento formal de Cierre por Diferencia de Cambio en la base de datos (Subdiario 35).
 */
export async function executeExchangeDifferenceClosingAction(params: {
  companyRuc: string;
  year: number;
  month: number;
  closingPurchaseRate: number;
  closingSaleRate: number;
  lines: {
    lineNumber: number;
    accountCode: string;
    accountName: string;
    glossary: string;
    debitPEN: number;
    creditPEN: number;
  }[];
}) {
  try {
    const lastDay = new Date(params.year, params.month, 0).getDate();
    const closingDate = `${params.year}-${String(params.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const res = await saveVoucherAction({
      companyRuc: params.companyRuc,
      subdiarioCode: "35", // 35 = Diferencia de Cambio
      date: closingDate,
      currency: "PEN",
      exchangeRate: params.closingSaleRate,
      glossary: `CIERRE MENSUAL DIFERENCIA DE CAMBIO TC COMPRA ${params.closingPurchaseRate.toFixed(3)} / TC VENTA ${params.closingSaleRate.toFixed(3)}`,
      originModule: "DIFERENCIA_CAMBIO",
      items: params.lines.map((l) => ({
        lineNumber: l.lineNumber,
        accountCode: l.accountCode,
        accountName: l.accountName,
        glossary: l.glossary,
        debitPEN: l.debitPEN,
        creditPEN: l.creditPEN,
        debitUSD: 0,
        creditUSD: 0,
        isAutoDestination: false,
      })),
    });

    return serializeDecimals(res);
  } catch (err: unknown) {
    console.error("Error al registrar cierre de diferencia de cambio:", err);
    return serializeDecimals({
      success: false,
      error: err instanceof Error ? err.message : "Error al registrar asiento de diferencia de cambio.",
    });
  }
}

/**
 * Exporta el Balance de Comprobación a formato Excel (.xlsx) y devuelve el buffer codificado en base64.
 */
export async function exportTrialBalanceExcelAction(
  companyName: string,
  companyRuc: string,
  periodDesc: string,
  trialBalance: TrialBalanceSummary
) {
  try {
    const buffer = await exportTrialBalanceToExcelBuffer(
      companyName,
      companyRuc,
      periodDesc,
      trialBalance
    );

    return serializeDecimals({
      success: true,
      base64: buffer.toString("base64"),
      fileName: `Balance_Comprobacion_${companyRuc}_${periodDesc.replace(/\s+/g, "_")}.xlsx`,
    });
  } catch (err: unknown) {
    console.error("Error al exportar Excel:", err);
    return serializeDecimals({
      success: false,
      error: err instanceof Error ? err.message : "Error al exportar a Excel.",
    });
  }
}
