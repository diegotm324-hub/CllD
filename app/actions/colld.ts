"use server";

import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { serializeDecimals } from "@/lib/utils/serialize";
import { initializeCompanyPCGE } from "@/lib/accounting/pcgeSeed";
import {
  ACTIVE_COMPANY_COOKIE,
  getActiveCompanyId,
  getOrCreateDefaultUser,
} from "@/lib/auth/activeCompany";

// ------------------------------------------------------------------------------
// 1. SELECTOR Y CAMBIO DE EMPRESA ACTIVA (COOKIE PERSISTENTE)
// ------------------------------------------------------------------------------

export async function switchActiveCompany(companyId: string) {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return { success: false, error: "Empresa no encontrada." };
    }

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 año
      sameSite: "lax",
      httpOnly: false, // Accesible por cliente si es necesario
    });

    revalidatePath("/", "layout");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/comprobantes");
    revalidatePath("/dashboard/libro-diario");
    revalidatePath("/dashboard/empresas");

    return { success: true, company: serializeDecimals(company) };
  } catch (error) {
    console.error("[COLLD ERROR switchActiveCompany]:", error);
    return { success: false, error: String(error) };
  }
}

// ------------------------------------------------------------------------------
// 2. DASHBOARD METRICS AISLADAS POR EMPRESA
// ------------------------------------------------------------------------------

export async function getColldDashboardMetrics(explicitCompanyId?: string) {
  try {
    const targetCompanyId = explicitCompanyId || (await getActiveCompanyId());

    if (!targetCompanyId) {
      return {
        success: true,
        data: {
          hasCompany: false,
          company: null,
          totalSales: 0,
          totalPurchases: 0,
          fiscalCreditIgv: 0,
          exchangeRate: { buy: 3.755, sell: 3.782, date: new Date().toISOString() },
          monthlyFlow: [],
        },
      };
    }

    const company = await prisma.company.findUnique({
      where: { id: targetCompanyId },
    });

    if (!company) {
      return {
        success: true,
        data: {
          hasCompany: false,
          company: null,
          totalSales: 0,
          totalPurchases: 0,
          fiscalCreditIgv: 0,
          exchangeRate: { buy: 3.755, sell: 3.782, date: new Date().toISOString() },
          monthlyFlow: [],
        },
      };
    }

    // Consultas aisladas por empresa usando el modelo Invoice
    const invoices = await prisma.invoice.findMany({
      where: { companyId: targetCompanyId },
      orderBy: { issueDate: "desc" },
    });

    let totalSales = 0;
    let totalPurchases = 0;
    let igvVentas = 0;
    let igvCompras = 0;

    for (const inv of invoices) {
      if (inv.operation === "VENTA") {
        totalSales += inv.subtotal;
        igvVentas += inv.igv;
      } else {
        totalPurchases += inv.subtotal;
        igvCompras += inv.igv;
      }
    }

    // Si no hay invoices, buscar en Transactions / Vouchers existentes
    if (totalSales === 0 && totalPurchases === 0) {
      const txs = await prisma.transaction.findMany({
        where: { companyId: targetCompanyId },
        include: { details: true },
      });

      for (const tx of txs) {
        for (const d of tx.details) {
          const credit = Number(d.credit || 0);
          const debit = Number(d.debit || 0);
          if (d.accountCode.startsWith("70")) totalSales += credit;
          if (d.accountCode.startsWith("60") || d.accountCode.startsWith("63")) totalPurchases += debit;
          if (d.accountCode.startsWith("4011") && credit > 0) igvVentas += credit;
          if (d.accountCode.startsWith("4011") && debit > 0) igvCompras += debit;
        }
      }
    }

    const netIgv = igvVentas - igvCompras;

    // Obtener Tipo de Cambio SUNAT del día
    const latestTc = await prisma.exchangeRate.findFirst({
      orderBy: { date: "desc" },
    });

    const buyRate = latestTc ? Number(latestTc.buyRate || latestTc.purchaseRate || 3.755) : 3.755;
    const sellRate = latestTc ? Number(latestTc.sellRate || latestTc.saleRate || 3.782) : 3.782;

    const data = {
      hasCompany: true,
      company: {
        id: company.id,
        ruc: company.ruc,
        businessName: company.businessName,
        commercialName: company.commercialName || company.tradeName,
        taxRegime: company.taxRegime,
        currency: company.currency,
      },
      totalSales,
      totalPurchases,
      fiscalCreditIgv: netIgv,
      exchangeRate: {
        buy: buyRate,
        sell: sellRate,
        date: latestTc ? latestTc.date.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      },
      monthlyFlow: [
        { month: "Jun", ventas: totalSales * 0.45, compras: totalPurchases * 0.4 },
        { month: "Jul", ventas: totalSales * 0.6, compras: totalPurchases * 0.55 },
        { month: "Ago", ventas: totalSales * 0.75, compras: totalPurchases * 0.7 },
        { month: "Set", ventas: totalSales * 0.7, compras: totalPurchases * 0.65 },
        { month: "Oct", ventas: totalSales * 0.85, compras: totalPurchases * 0.8 },
        { month: "Nov", ventas: totalSales, compras: totalPurchases },
      ],
    };

    return { success: true, data: serializeDecimals(data) };
  } catch (error) {
    console.error("[COLLD ERROR getColldDashboardMetrics]:", error);
    return { success: false, error: String(error) };
  }
}

// ------------------------------------------------------------------------------
// 3. COMPROBANTES DE PAGO (INVOICES)
// ------------------------------------------------------------------------------

export interface CreateInvoiceInput {
  operationType: "VENTA" | "COMPRA";
  docType: "01" | "03" | "07" | "08";
  docSeries: string;
  docNumber: string;
  partyRuc: string;
  partyName: string;
  date: string;
  currency: "PEN" | "USD";
  exchangeRate: number;
  baseAmount: number;
  generateAccountingEntry?: boolean;
}

export async function createColldComprobante(
  companyIdParam?: string,
  input?: CreateInvoiceInput
) {
  try {
    const targetCompanyId = companyIdParam || (await getActiveCompanyId());
    if (!targetCompanyId || !input) {
      return { success: false, error: "Empresa activa no identificada." };
    }

    const base = Number(input.baseAmount);
    const igv = Math.round(base * 0.18 * 100) / 100;
    const total = Math.round((base + igv) * 100) / 100;

    // 1. Guardar en el modelo oficial Invoice
    const invoice = await prisma.invoice.create({
      data: {
        companyId: targetCompanyId,
        type: input.docType,
        series: input.docSeries,
        number: input.docNumber,
        docRuc: input.partyRuc,
        docName: input.partyName,
        operation: input.operationType,
        issueDate: new Date(input.date),
        currency: input.currency,
        subtotal: base,
        igv: igv,
        total: total,
      },
    });

    // 2. Guardar en JournalEntry para el Libro Diario
    const glosa = `${input.operationType === "VENTA" ? "VENTA" : "COMPRA"} ${input.docType}-${input.docSeries}-${input.docNumber} - ${input.partyName}`;
    await prisma.journalEntry.create({
      data: {
        companyId: targetCompanyId,
        glosa,
        date: new Date(input.date),
        debitTotal: total,
        creditTotal: total,
      },
    });

    // 3. Guardar en Transactions (motor relacional compatible)
    const voucherNumber = `${input.operationType === "VENTA" ? "V" : "C"}-${Date.now().toString().slice(-6)}`;
    const tx = await prisma.transaction.create({
      data: {
        companyId: targetCompanyId,
        voucherNumber,
        date: new Date(input.date),
        glosa,
        currency: input.currency as any,
        exchangeRate: Number(input.exchangeRate) || 3.782,
        status: "REGISTRADO",
      },
    });

    if (input.operationType === "VENTA") {
      await prisma.transactionDetail.createMany({
        data: [
          {
            transactionId: tx.id,
            accountCode: "121",
            debit: total,
            credit: 0,
            docType: input.docType,
            docSeries: input.docSeries,
            docNumber: input.docNumber,
            partyRuc: input.partyRuc,
            partyName: input.partyName,
          },
          {
            transactionId: tx.id,
            accountCode: "40111",
            debit: 0,
            credit: igv,
            docType: input.docType,
            docSeries: input.docSeries,
            docNumber: input.docNumber,
            partyRuc: input.partyRuc,
            partyName: input.partyName,
          },
          {
            transactionId: tx.id,
            accountCode: "701",
            debit: 0,
            credit: base,
            docType: input.docType,
            docSeries: input.docSeries,
            docNumber: input.docNumber,
            partyRuc: input.partyRuc,
            partyName: input.partyName,
          },
        ],
      });
    } else {
      await prisma.transactionDetail.createMany({
        data: [
          {
            transactionId: tx.id,
            accountCode: "601",
            debit: base,
            credit: 0,
            docType: input.docType,
            docSeries: input.docSeries,
            docNumber: input.docNumber,
            partyRuc: input.partyRuc,
            partyName: input.partyName,
          },
          {
            transactionId: tx.id,
            accountCode: "40111",
            debit: igv,
            credit: 0,
            docType: input.docType,
            docSeries: input.docSeries,
            docNumber: input.docNumber,
            partyRuc: input.partyRuc,
            partyName: input.partyName,
          },
          {
            transactionId: tx.id,
            accountCode: "421",
            debit: 0,
            credit: total,
            docType: input.docType,
            docSeries: input.docSeries,
            docNumber: input.docNumber,
            partyRuc: input.partyRuc,
            partyName: input.partyName,
          },
        ],
      });
    }

    revalidatePath("/dashboard/comprobantes");
    revalidatePath("/dashboard/libro-diario");
    revalidatePath("/dashboard");

    return { success: true, invoiceId: invoice.id };
  } catch (error) {
    console.error("[COLLD ERROR createColldComprobante]:", error);
    return { success: false, error: String(error) };
  }
}

export async function getColldComprobantes(
  explicitCompanyId?: string,
  filters?: { date?: string; docType?: string; currency?: string }
) {
  try {
    const targetCompanyId = explicitCompanyId || (await getActiveCompanyId());
    if (!targetCompanyId) {
      return { success: true, data: [] };
    }

    // 1. Consultar Invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId: targetCompanyId,
        ...(filters?.currency && filters.currency !== "ALL" ? { currency: filters.currency } : {}),
      },
      orderBy: { issueDate: "desc" },
      take: 100,
    });

    if (invoices.length > 0) {
      const items = invoices.map((inv) => ({
        id: inv.id,
        voucherNumber: `${inv.series}-${inv.number}`,
        operationType: inv.operation,
        date: inv.issueDate.toISOString().split("T")[0],
        currency: inv.currency,
        exchangeRate: 3.782,
        docType: inv.type,
        docSeries: inv.series,
        docNumber: inv.number,
        partyRuc: inv.docRuc,
        partyName: inv.docName,
        baseAmount: inv.subtotal,
        igvAmount: inv.igv,
        totalAmount: inv.total,
        status: "REGISTRADO",
      }));
      return { success: true, data: serializeDecimals(items) };
    }

    // 2. Fallback a Transactions
    const txs = await prisma.transaction.findMany({
      where: { companyId: targetCompanyId },
      include: { details: true },
      orderBy: { date: "desc" },
      take: 100,
    });

    const fallbackItems = txs.map((tx) => {
      const isVenta = tx.details.some((d) => d.accountCode.startsWith("70") || d.accountCode.startsWith("12"));
      const party = tx.details.find((d) => d.partyName || d.partyRuc);
      const detailWithDoc = tx.details.find((d) => d.docNumber);

      const baseAmount = tx.details
        .filter((d) => d.accountCode.startsWith("70") || d.accountCode.startsWith("60") || d.accountCode.startsWith("63"))
        .reduce((sum, d) => sum + Number(d.credit || d.debit || 0), 0);

      const igvAmount = tx.details
        .filter((d) => d.accountCode.startsWith("4011"))
        .reduce((sum, d) => sum + Number(d.credit || d.debit || 0), 0);

      const totalAmount = tx.details
        .filter((d) => d.accountCode.startsWith("12") || d.accountCode.startsWith("42"))
        .reduce((sum, d) => sum + Number(d.debit || d.credit || 0), 0) || (baseAmount + igvAmount);

      return {
        id: tx.id,
        voucherNumber: tx.voucherNumber,
        operationType: isVenta ? "VENTA" : "COMPRA",
        date: tx.date.toISOString().split("T")[0],
        currency: tx.currency,
        exchangeRate: Number(tx.exchangeRate),
        docType: detailWithDoc?.docType || "01",
        docSeries: detailWithDoc?.docSeries || "F001",
        docNumber: detailWithDoc?.docNumber || tx.voucherNumber,
        partyRuc: party?.partyRuc || "20000000001",
        partyName: party?.partyName || tx.glosa,
        baseAmount,
        igvAmount,
        totalAmount,
        status: tx.status,
      };
    });

    return { success: true, data: serializeDecimals(fallbackItems) };
  } catch (error) {
    console.error("[COLLD ERROR getColldComprobantes]:", error);
    return { success: false, error: String(error), data: [] };
  }
}

// ------------------------------------------------------------------------------
// 4. LIBRO DIARIO Y ASIENTOS (JOURNAL ENTRIES)
// ------------------------------------------------------------------------------

export async function getColldLibroDiario(explicitCompanyId?: string) {
  try {
    const targetCompanyId = explicitCompanyId || (await getActiveCompanyId());
    if (!targetCompanyId) {
      return { success: true, data: [] };
    }

    const txs = await prisma.transaction.findMany({
      where: { companyId: targetCompanyId },
      include: { details: true },
      orderBy: { date: "desc" },
      take: 100,
    });

    const entries = txs.map((tx) => {
      const sumDebit = tx.details.reduce((acc, d) => acc + Number(d.debit || 0), 0);
      const sumCredit = tx.details.reduce((acc, d) => acc + Number(d.credit || 0), 0);
      const isBalanced = Math.abs(sumDebit - sumCredit) < 0.01;

      return {
        id: tx.id,
        voucherNumber: tx.voucherNumber,
        date: tx.date.toISOString().split("T")[0],
        glosa: tx.glosa,
        currency: tx.currency,
        exchangeRate: Number(tx.exchangeRate),
        status: tx.status,
        sumDebit,
        sumCredit,
        isBalanced,
        details: tx.details.map((d) => ({
          id: d.id,
          accountCode: d.accountCode,
          debit: Number(d.debit || 0),
          credit: Number(d.credit || 0),
          docType: d.docType,
          docSeries: d.docSeries,
          docNumber: d.docNumber,
          partyRuc: d.partyRuc,
          partyName: d.partyName,
        })),
      };
    });

    return { success: true, data: serializeDecimals(entries) };
  } catch (error) {
    console.error("[COLLD ERROR getColldLibroDiario]:", error);
    return { success: false, error: String(error), data: [] };
  }
}

export async function createColldManualAsiento(
  explicitCompanyId: string | undefined,
  data: {
    date: string;
    glosa: string;
    currency: "PEN" | "USD";
    exchangeRate: number;
    lines: Array<{
      accountCode: string;
      debit: number;
      credit: number;
      partyName?: string;
      partyRuc?: string;
    }>;
  }
) {
  try {
    const targetCompanyId = explicitCompanyId || (await getActiveCompanyId());
    if (!targetCompanyId) {
      return { success: false, error: "Empresa activa no identificada." };
    }

    const sumDebit = data.lines.reduce((acc, l) => acc + Number(l.debit || 0), 0);
    const sumCredit = data.lines.reduce((acc, l) => acc + Number(l.credit || 0), 0);

    if (Math.abs(sumDebit - sumCredit) >= 0.01) {
      return {
        success: false,
        error: `Desbalance: Debe (S/ ${sumDebit.toFixed(2)}) no es igual a Haber (S/ ${sumCredit.toFixed(2)}).`,
      };
    }

    // 1. Guardar en JournalEntry
    await prisma.journalEntry.create({
      data: {
        companyId: targetCompanyId,
        glosa: data.glosa,
        date: new Date(data.date),
        debitTotal: sumDebit,
        creditTotal: sumCredit,
      },
    });

    // 2. Guardar en Transaction y Details
    const voucherNumber = `D-${Date.now().toString().slice(-6)}`;
    const tx = await prisma.transaction.create({
      data: {
        companyId: targetCompanyId,
        voucherNumber,
        date: new Date(data.date),
        glosa: data.glosa,
        currency: data.currency as any,
        exchangeRate: Number(data.exchangeRate) || 3.782,
        status: "REGISTRADO",
      },
    });

    await prisma.transactionDetail.createMany({
      data: data.lines.map((l) => ({
        transactionId: tx.id,
        accountCode: l.accountCode,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
        partyRuc: l.partyRuc || null,
        partyName: l.partyName || null,
      })),
    });

    revalidatePath("/dashboard/libro-diario");
    revalidatePath("/dashboard");

    return { success: true, transactionId: tx.id };
  } catch (error) {
    console.error("[COLLD ERROR createColldManualAsiento]:", error);
    return { success: false, error: String(error) };
  }
}

// ------------------------------------------------------------------------------
// 5. GESTIÓN MULTI-TENANT DE EMPRESAS Y CREACIÓN
// ------------------------------------------------------------------------------

export async function getColldEmpresas() {
  try {
    const user = await getOrCreateDefaultUser();

    const companies = await prisma.company.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: {
            invoices: true,
            journalEntries: true,
            accounts: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // También retornar el activeCompanyId actual
    const activeId = await getActiveCompanyId();

    return {
      success: true,
      activeCompanyId: activeId,
      data: serializeDecimals(companies),
    };
  } catch (error) {
    console.error("[COLLD ERROR getColldEmpresas]:", error);
    return { success: false, error: String(error), data: [] };
  }
}

export async function createColldEmpresa(data: {
  ruc: string;
  businessName: string;
  commercialName?: string;
  taxRegime: "MYPE" | "ESPECIAL" | "GENERAL" | "MYPE_TRIBUTARIO" | "ESPECIAL_RER";
  address?: string;
  currency?: "PEN" | "USD";
}) {
  try {
    const cleanRuc = data.ruc.trim();
    if (!cleanRuc || cleanRuc.length !== 11) {
      return { success: false, error: "El RUC debe tener exactamente 11 dígitos numéricos." };
    }

    const user = await getOrCreateDefaultUser();

    // Normalizar Régimen
    let regime = "MYPE";
    if (data.taxRegime.includes("ESPECIAL")) regime = "Especial";
    if (data.taxRegime.includes("GENERAL")) regime = "General";

    // Crear Empresa asociada al Usuario
    const company = await prisma.company.create({
      data: {
        ruc: cleanRuc,
        businessName: data.businessName.trim(),
        commercialName: data.commercialName?.trim() || data.businessName.trim(),
        tradeName: data.commercialName?.trim() || data.businessName.trim(),
        address: data.address?.trim() || "DOMICILIO FISCAL NO REGISTRADO",
        legalAddress: data.address?.trim() || "DOMICILIO FISCAL NO REGISTRADO",
        taxRegime: regime,
        currency: data.currency || "PEN",
        userId: user.id,
        isActive: true,
      },
    });

    // Inicializar cuentas base del PCGE (101, 104, 121, 40111, 421, 601, 701)
    await initializeCompanyPCGE(company.id);

    // Establecer la nueva empresa como activa en la cookie
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_COMPANY_COOKIE, company.id, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });

    revalidatePath("/", "layout");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/empresas");

    return { success: true, company: serializeDecimals(company) };
  } catch (error: any) {
    console.error("[COLLD ERROR createColldEmpresa]:", error);
    if (error?.code === "P2002") {
      return { success: false, error: "Ya tienes una empresa registrada con este número de RUC." };
    }
    return { success: false, error: String(error) };
  }
}

export async function getColldAccounts(explicitCompanyId?: string) {
  try {
    const targetCompanyId = explicitCompanyId || (await getActiveCompanyId());
    if (!targetCompanyId) {
      return { success: true, data: [] };
    }

    const accounts = await prisma.accountPlan.findMany({
      where: { companyId: targetCompanyId },
      orderBy: { code: "asc" },
    });

    if (accounts.length === 0) {
      await initializeCompanyPCGE(targetCompanyId);
      const reloaded = await prisma.accountPlan.findMany({
        where: { companyId: targetCompanyId },
        orderBy: { code: "asc" },
      });
      return { success: true, data: serializeDecimals(reloaded) };
    }

    return { success: true, data: serializeDecimals(accounts) };
  } catch (error) {
    console.error("[COLLD ERROR getColldAccounts]:", error);
    return { success: false, error: String(error), data: [] };
  }
}
