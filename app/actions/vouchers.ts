"use server";

import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import prisma from "@/lib/prisma";
import {
  CurrencyCode,
  ExchangeRateType,
  PeriodStatus,
  SunatComprobanteType,
  VoucherStatus,
} from "@prisma/client";
import {
  validateDoubleEntry,
  VoucherLineInput,
  TOLERANCE,
} from "@/lib/accounting/validator";
import { serializeDecimals } from "@/lib/utils/serialize";

// ------------------------------------------------------------------------------
// INTERFACES TIPADAS ESTRICTAMENTE PARA SERVER ACTIONS
// ------------------------------------------------------------------------------

export interface SaveVoucherItemInput {
  id?: string;
  lineNumber: number;
  accountId?: string;
  accountCode: string;
  accountName?: string;
  entityId?: string | null;
  entityDocNumber?: string | null;
  entityBusinessName?: string | null;
  costCenterId?: string | null;
  costCenterCode?: string | null;
  docType?: SunatComprobanteType | string | null;
  docSeries?: string | null;
  docNumber?: string | null;
  docDate?: string | Date | null;
  docDueDate?: string | Date | null;
  glossary: string;
  debitPEN: number | string;
  creditPEN: number | string;
  debitUSD: number | string;
  creditUSD: number | string;
  isAutoDestination?: boolean;
  originalItemId?: string | null;
}

export interface SaveVoucherInput {
  id?: string;
  companyId?: string;
  companyRuc?: string;
  periodId?: string;
  subdiarioId?: string;
  subdiarioCode: string;
  voucherNumber?: string;
  date: string; // "YYYY-MM-DD"
  currency: "PEN" | "USD";
  exchangeRate: number | string;
  exchangeRateType?: "COMPRA" | "VENTA" | "ESPECIAL";
  glossary: string;
  status?: "BORRADOR" | "REGISTRADO" | "ANULADO";
  originModule?: string;
  items: SaveVoucherItemInput[];
}

export interface SaveVoucherResult {
  success: boolean;
  voucherId?: string;
  voucherNumber?: string;
  error?: string;
  errors?: string[];
  lineErrors?: { lineNumber: number; message: string }[];
}

// ------------------------------------------------------------------------------
// SERVER ACTION: REGISTRO / ACTUALIZACIÓN ATÓMICA DE VOUCHERS (ACID)
// ------------------------------------------------------------------------------

export async function saveVoucherAction(data: SaveVoucherInput): Promise<SaveVoucherResult> {
  try {
    // 1. Validación inicial de datos requeridos
    if (!data.items || data.items.length === 0) {
      return {
        success: false,
        error: "El voucher debe contener al menos dos líneas para cumplir la partida doble.",
      };
    }

    if (!data.subdiarioCode) {
      return {
        success: false,
        error: "Debe especificar el código de subdiario contable (ej: '01', '05', '11').",
      };
    }

    const voucherDate = new Date(data.date);
    if (isNaN(voucherDate.getTime())) {
      return {
        success: false,
        error: "La fecha del voucher no tiene un formato válido.",
      };
    }

    // 2. Validación de Partida Doble en el Servidor con Decimal.js (Tolerancia 0.0001)
    const normalizedLines: VoucherLineInput[] = data.items.map((it, idx) => ({
      ...it,
      lineNumber: it.lineNumber || idx + 1,
      accountId: it.accountId || "",
      accountCode: it.accountCode,
      glossary: it.glossary,
      debitPEN: new Decimal(it.debitPEN || 0),
      creditPEN: new Decimal(it.creditPEN || 0),
      debitUSD: new Decimal(it.debitUSD || 0),
      creditUSD: new Decimal(it.creditUSD || 0),
    }));

    const balanceCheck = validateDoubleEntry(normalizedLines);
    if (!balanceCheck.isBalanced) {
      return {
        success: false,
        error: "Violación de Partida Doble: El asiento no está balanceado estrictamente en Soles o Dólares.",
        errors: balanceCheck.errors,
        lineErrors: balanceCheck.lineErrors,
      };
    }

    // 3. Ejecución dentro de una Transacción ACID atómica
    const result = await prisma.$transaction(async (tx) => {
      // 3.1 Identificar o validar la Empresa
      let targetCompany = null;
      if (data.companyId) {
        targetCompany = await tx.company.findUnique({
          where: { id: data.companyId },
        });
      } else if (data.companyRuc) {
        targetCompany = await tx.company.findUnique({
          where: { ruc: data.companyRuc },
        });
      }

      if (!targetCompany) {
        // En caso de primer uso, asegurar una empresa por defecto
        targetCompany = await tx.company.findFirst();
        if (!targetCompany) {
          const solRuc = (process.env.SUNAT_RUC || "").trim() || "10746979636";
          const solUser = (process.env.SUNAT_USUARIO_SOL || "").trim() || "SCABCASH";
          const isJuridica = solRuc.startsWith("20");
          targetCompany = await tx.company.create({
            data: {
              ruc: data.companyRuc || solRuc,
              businessName: isJuridica ? `EMPRESA RUC ${solRuc}` : `CONTRIBUYENTE RUC ${solRuc} (${solUser})`,
              legalAddress: "DOMICILIO FISCAL DECLARADO ANTE SUNAT",
              taxRegime: isJuridica ? "MYPE_TRIBUTARIO" : "ESPECIAL_RER",
              isSireObligated: true,
            },
          });
        }
      }

      const companyId = targetCompany.id;

      // 3.2 Identificar y validar Periodo Fiscal (Año y Mes)
      const year = voucherDate.getFullYear();
      const month = voucherDate.getMonth() + 1;

      let period = null;
      if (data.periodId) {
        period = await tx.fiscalPeriod.findUnique({
          where: { id: data.periodId },
        });
      } else {
        period = await tx.fiscalPeriod.findUnique({
          where: {
            companyId_year_month: {
              companyId,
              year,
              month,
            },
          },
        });

        // Crear periodo si aún no existe
        if (!period) {
          period = await tx.fiscalPeriod.create({
            data: {
              companyId,
              year,
              month,
              status: PeriodStatus.ABIERTO,
            },
          });
        }
      }

      if (!period) {
        throw new Error(`No se encontró el periodo fiscal ${year}-${String(month).padStart(2, "0")}.`);
      }

      // Regla de Negocio: Bloqueo estricto si el periodo está cerrado
      if (period.status === PeriodStatus.CERRADO) {
        throw new Error(
          `Operación rechazada: El periodo contable ${year}-${String(month).padStart(2, "0")} se encuentra CERRADO.`
        );
      }
      if (period.status === PeriodStatus.BLOQUEADO) {
        throw new Error(
          `Operación rechazada: El periodo contable ${year}-${String(month).padStart(2, "0")} está BLOQUEADO para auditoría / SIRE.`
        );
      }

      // 3.3 Identificar o crear Subdiario
      let subdiario = null;
      if (data.subdiarioId) {
        subdiario = await tx.subdiario.findUnique({
          where: { id: data.subdiarioId },
        });
      } else {
        subdiario = await tx.subdiario.findUnique({
          where: {
            companyId_code: {
              companyId,
              code: data.subdiarioCode,
            },
          },
        });

        if (!subdiario) {
          const namesMap: Record<string, string> = {
            "01": "Asiento de Apertura",
            "05": "Libro Diario General",
            "06": "Compras No Domiciliados",
            "11": "Registro de Compras",
            "14": "Caja Chica",
            "21": "Registro de Ventas e Ingresos",
            "31": "Caja y Bancos - Ingresos",
            "34": "Caja y Bancos - Egresos",
            "35": "Cierre y Ajuste por TC",
          };
          subdiario = await tx.subdiario.create({
            data: {
              companyId,
              code: data.subdiarioCode,
              name: namesMap[data.subdiarioCode] || `Subdiario ${data.subdiarioCode}`,
              currentCorrelative: 0,
            },
          });
        }
      }

      if (!subdiario) {
        throw new Error(`No se pudo encontrar ni crear el subdiario ${data.subdiarioCode}.`);
      }

      // 3.4 Asignación de Correlativo (Autonumeración consecutiva)
      let finalVoucherNumber = data.voucherNumber?.trim();
      if (!finalVoucherNumber) {
        const nextCorrelative = subdiario.currentCorrelative + 1;
        await tx.subdiario.update({
          where: { id: subdiario.id },
          data: { currentCorrelative: nextCorrelative },
        });
        finalVoucherNumber = `${data.subdiarioCode}${String(nextCorrelative).padStart(4, "0")}`;
      }

      // 3.5 Resolver cuentas y entidades para cada ítem
      const resolvedItemsData = [];

      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];

        // Resolver Cuenta
        let accountId = item.accountId;
        if (!accountId) {
          let acc = await tx.account.findUnique({
            where: {
              companyId_code: {
                companyId,
                code: item.accountCode.trim(),
              },
            },
          });

          if (!acc) {
            // Si la cuenta no existe en el catálogo, auto-crearla para no truncar la operación
            acc = await tx.account.create({
              data: {
                companyId,
                code: item.accountCode.trim(),
                name: item.accountName || `Cuenta ${item.accountCode}`,
                level: "SUBDIVISIONARIA",
                nature: item.accountCode.startsWith("1") ||
                  item.accountCode.startsWith("2") ||
                  item.accountCode.startsWith("3") ||
                  item.accountCode.startsWith("6") ||
                  item.accountCode.startsWith("9")
                    ? "DEUDORA"
                    : "ACREEDORA",
                allowsMovement: true,
                requiresEntity: ["12", "14", "16", "42", "44", "46"].some((p) =>
                  item.accountCode.startsWith(p)
                ),
                requiresCostCenter: item.accountCode.startsWith("6") || item.accountCode.startsWith("9"),
              },
            });
          }
          accountId = acc.id;
        }

        // Resolver Entidad / Anexo si se especificó docNumber
        let entityId = item.entityId;
        if (!entityId && item.entityDocNumber) {
          const docNum = item.entityDocNumber.trim();
          let entity = await tx.entity.findFirst({
            where: {
              companyId,
              docNumber: docNum,
            },
          });

          if (!entity) {
            const isRuc = docNum.length === 11;
            entity = await tx.entity.create({
              data: {
                companyId,
                docType: isRuc ? "RUC_6" : "DNI_1",
                docNumber: docNum,
                businessName: item.entityBusinessName || `Entidad ${docNum}`,
                sunatState: "ACTIVO",
                sunatCondition: "HABIDO",
              },
            });
          }
          entityId = entity.id;
        }

        // Normalizar tipo de comprobante SUNAT
        let sunatDocType: SunatComprobanteType | null = null;
        if (item.docType) {
          if (Object.values(SunatComprobanteType).includes(item.docType as SunatComprobanteType)) {
            sunatDocType = item.docType as SunatComprobanteType;
          }
        }

        resolvedItemsData.push({
          lineNumber: item.lineNumber || i + 1,
          accountId,
          entityId: entityId || null,
          costCenterId: item.costCenterId || null,
          docType: sunatDocType,
          docSeries: item.docSeries?.trim() || null,
          docNumber: item.docNumber?.trim() || null,
          docDate: item.docDate ? new Date(item.docDate) : null,
          docDueDate: item.docDueDate ? new Date(item.docDueDate) : null,
          glossary: item.glossary || data.glossary,
          debitPEN: new Decimal(item.debitPEN || 0),
          creditPEN: new Decimal(item.creditPEN || 0),
          debitUSD: new Decimal(item.debitUSD || 0),
          creditUSD: new Decimal(item.creditUSD || 0),
          isAutoDestination: Boolean(item.isAutoDestination),
        });
      }

      // 3.6 Crear o actualizar cabecera Voucher y sus ítems
      let voucher;
      const voucherPayload = {
        companyId,
        periodId: period.id,
        subdiarioId: subdiario.id,
        voucherNumber: finalVoucherNumber,
        date: voucherDate,
        currency: (data.currency as CurrencyCode) || CurrencyCode.PEN,
        exchangeRate: new Decimal(data.exchangeRate || 3.75),
        exchangeRateType: (data.exchangeRateType as ExchangeRateType) || ExchangeRateType.VENTA,
        glossary: data.glossary,
        status: (data.status as VoucherStatus) || VoucherStatus.REGISTRADO,
        totalDebitPEN: balanceCheck.totalDebitPEN,
        totalCreditPEN: balanceCheck.totalCreditPEN,
        totalDebitUSD: balanceCheck.totalDebitUSD,
        totalCreditUSD: balanceCheck.totalCreditUSD,
        isBalanced: true,
        hasAutomaticDestination: data.items.some((it) => it.isAutoDestination),
        originModule: data.originModule || "MANUAL",
      };

      if (data.id) {
        // Actualizar: eliminar ítems existentes y recrear para garantizar consistencia atómica
        await tx.voucherItem.deleteMany({
          where: { voucherId: data.id },
        });

        voucher = await tx.voucher.update({
          where: { id: data.id },
          data: {
            ...voucherPayload,
            items: {
              create: resolvedItemsData,
            },
          },
        });
      } else {
        // Inserción Atómica
        voucher = await tx.voucher.create({
          data: {
            ...voucherPayload,
            items: {
              create: resolvedItemsData,
            },
          },
        });
      }

      return {
        voucherId: voucher.id,
        voucherNumber: voucher.voucherNumber,
      };
    });

    revalidatePath("/");
    revalidatePath("/vouchers");

    return serializeDecimals({
      success: true,
      voucherId: result.voucherId,
      voucherNumber: result.voucherNumber,
    });
  } catch (error: unknown) {
    console.error("Error en saveVoucherAction:", error);
    const message = error instanceof Error ? error.message : "Error inesperado al guardar el asiento contable.";
    return serializeDecimals({
      success: false,
      error: message,
    });
  }
}

// ------------------------------------------------------------------------------
// SERVER ACTION: OBTENER VOUCHERS RECIENTES
// ------------------------------------------------------------------------------

export async function getRecentVouchersAction(companyRuc?: string) {
  try {
    const vouchers = await prisma.voucher.findMany({
      where: companyRuc ? { company: { ruc: companyRuc } } : undefined,
      include: {
        subdiario: true,
        fiscalPeriod: true,
        items: {
          include: {
            account: true,
            entity: true,
          },
          orderBy: { lineNumber: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return serializeDecimals({
      success: true,
      data: vouchers.map((v) => ({
        ...v,
        totalDebitPEN: v.totalDebitPEN.toNumber(),
        totalCreditPEN: v.totalCreditPEN.toNumber(),
        totalDebitUSD: v.totalDebitUSD.toNumber(),
        totalCreditUSD: v.totalCreditUSD.toNumber(),
        exchangeRate: v.exchangeRate.toNumber(),
        items: v.items.map((it) => ({
          ...it,
          debitPEN: it.debitPEN.toNumber(),
          creditPEN: it.creditPEN.toNumber(),
          debitUSD: it.debitUSD.toNumber(),
          creditUSD: it.creditUSD.toNumber(),
        })),
      })),
    });
  } catch (err) {
    console.error("Error al obtener vouchers:", err);
    return serializeDecimals({ success: false, data: [] });
  }
}
