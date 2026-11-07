import prisma from "@/lib/prisma";

export interface StandardPCGEAccount {
  code: string;
  name: string;
  level: number;
  nature: "DEUDORA" | "ACREEDORA";
}

export const DEFAULT_PCGE_ACCOUNTS: StandardPCGEAccount[] = [
  { code: "101", name: "Caja", level: 3, nature: "DEUDORA" },
  { code: "104", name: "Cuentas Corrientes en Instituciones Financieras", level: 3, nature: "DEUDORA" },
  { code: "121", name: "Facturas, Boletas y Otros Comprobantes por Cobrar", level: 3, nature: "DEUDORA" },
  { code: "40111", name: "IGV - Cuenta Propia", level: 5, nature: "ACREEDORA" },
  { code: "4017", name: "Impuesto a la Renta", level: 4, nature: "ACREEDORA" },
  { code: "421", name: "Facturas, Boletas y Otros Comprobantes por Pagar", level: 3, nature: "ACREEDORA" },
  { code: "6011", name: "Mercaderías", level: 4, nature: "DEUDORA" },
  { code: "6111", name: "Variación de Existencias - Mercaderías", level: 4, nature: "ACREEDORA" },
  { code: "6911", name: "Costo de Ventas - Mercaderías", level: 4, nature: "DEUDORA" },
  { code: "70111", name: "Ventas - Mercaderías", level: 5, nature: "ACREEDORA" },
];

/**
 * Inicializa automáticamente el Plan Contable (PCGE) oficial para una empresa.
 * Inserta las cuentas básicas tanto en AccountPlan como en Account para total compatibilidad.
 */
export async function initializeCompanyPCGE(companyId: string) {
  try {
    for (const acc of DEFAULT_PCGE_ACCOUNTS) {
      // 1. Registro en AccountPlan
      await prisma.accountPlan.upsert({
        where: {
          companyId_code: {
            companyId,
            code: acc.code,
          },
        },
        update: {
          name: acc.name,
          level: acc.level,
          nature: acc.nature,
        },
        create: {
          companyId,
          code: acc.code,
          name: acc.name,
          level: acc.level,
          nature: acc.nature,
        },
      });

      // 2. Registro en Account (compatibilidad con motor previo)
      await prisma.account.upsert({
        where: {
          companyId_code: {
            companyId,
            code: acc.code,
          },
        },
        update: {
          name: acc.name,
        },
        create: {
          companyId,
          code: acc.code,
          name: acc.name,
          level: acc.level === 3 ? "SUBCUENTA" : acc.level === 4 ? "DIVISIONARIA" : "SUBDIVISIONARIA",
          nature: acc.nature,
          allowsMovement: true,
          currency: "BOTH",
        },
      });
    }

    return { success: true, count: DEFAULT_PCGE_ACCOUNTS.length };
  } catch (error) {
    console.error(`[PCGE SEED ERROR] Error inicializando PCGE para empresa ${companyId}:`, error);
    return { success: false, error: String(error) };
  }
}
