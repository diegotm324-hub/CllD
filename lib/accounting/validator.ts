// ==============================================================================
// ContablePro - Motor de Validación y Cálculo Contable / Tributario Peruano
// Implementación estricta con Decimal.js (sin pérdida de precisión IEEE-754)
// Normas: PCGE Vigente, Módulo 11 SUNAT, Partida Doble Bimoneda y Amarres Clase 6
// ==============================================================================

import Decimal from "decimal.js";

// Configuración global de precisión para operaciones financieras de alta exactitud
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export const TOLERANCE = new Decimal("0.0001");

// ------------------------------------------------------------------------------
// INTERFACES TIPADAS ESTRICTAMENTE
// ------------------------------------------------------------------------------

export interface VoucherLineInput {
  id?: string;
  lineNumber: number;
  accountId: string;
  accountCode: string;
  accountName?: string;
  entityId?: string | null;
  entityDocNumber?: string | null;
  costCenterId?: string | null;
  costCenterCode?: string | null;
  docType?: string | null;
  docSeries?: string | null;
  docNumber?: string | null;
  docDate?: Date | string | null;
  docDueDate?: Date | string | null;
  glossary: string;
  debitPEN: number | string | Decimal;
  creditPEN: number | string | Decimal;
  debitUSD: number | string | Decimal;
  creditUSD: number | string | Decimal;
  isAutoDestination?: boolean;
  originalItemId?: string | null;
}

export interface AccountDestinationConfig {
  id: string;
  code: string;
  name: string;
  level?: string;
  allowsMovement: boolean;
  requiresEntity: boolean;
  requiresCostCenter: boolean;
  requiresDocRef: boolean;
  hasAutomaticDestination: boolean;
  destinationDebitAccountId?: string | null;
  destinationDebitAccountCode?: string | null;
  destinationDebitAccountName?: string | null;
  destinationCreditAccountId?: string | null;
  destinationCreditAccountCode?: string | null;
  destinationCreditAccountName?: string | null;
}

export interface DoubleEntryValidationResult {
  isBalanced: boolean;
  isBalancedPEN: boolean;
  isBalancedUSD: boolean;
  totalDebitPEN: Decimal;
  totalCreditPEN: Decimal;
  diffPEN: Decimal;
  totalDebitUSD: Decimal;
  totalCreditUSD: Decimal;
  diffUSD: Decimal;
  tolerance: Decimal;
  errors: string[];
  lineErrors: { lineNumber: number; message: string }[];
}

export interface RucValidationResult {
  isValid: boolean;
  ruc: string;
  entityType: "PERSONA_NATURAL" | "PERSONA_JURIDICA" | "OTRO" | "INVALID";
  error?: string;
}

export interface DestinationGenerationResult {
  lines: VoucherLineInput[];
  generatedCount: number;
  warnings: string[];
}

// ------------------------------------------------------------------------------
// 1. VALIDACIÓN DE RUC PERUANO (ALGORITMO OFICIAL MÓDULO 11 DE SUNAT)
// ------------------------------------------------------------------------------

/**
 * Valida un número de RUC peruano según el algoritmo oficial de SUNAT (Módulo 11).
 * Factores de ponderación: [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] aplicados a los 10 primeros dígitos.
 */
export function validateRUC(ruc: string): RucValidationResult {
  const cleanRuc = ruc.trim();

  if (!/^\d{11}$/.test(cleanRuc)) {
    return {
      isValid: false,
      ruc: cleanRuc,
      entityType: "INVALID",
      error: "El RUC debe contener exactamente 11 dígitos numéricos.",
    };
  }

  const prefix = cleanRuc.substring(0, 2);
  let entityType: RucValidationResult["entityType"] = "OTRO";

  if (prefix === "10") {
    entityType = "PERSONA_NATURAL";
  } else if (prefix === "20") {
    entityType = "PERSONA_JURIDICA";
  } else if (["15", "17"].includes(prefix)) {
    entityType = "PERSONA_NATURAL";
  } else {
    return {
      isValid: false,
      ruc: cleanRuc,
      entityType: "INVALID",
      error: `Prefijo "${prefix}" no válido para RUC en SUNAT (debe iniciar con 10, 20, 15 o 17).`,
    };
  }

  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;

  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanRuc.charAt(i), 10) * weights[i];
  }

  const remainder = sum % 11;
  const complement = 11 - remainder;

  let expectedCheckDigit: number;
  if (complement === 10) {
    expectedCheckDigit = 0;
  } else if (complement === 11) {
    expectedCheckDigit = 1;
  } else {
    expectedCheckDigit = complement;
  }

  const actualCheckDigit = parseInt(cleanRuc.charAt(10), 10);

  if (actualCheckDigit !== expectedCheckDigit) {
    return {
      isValid: false,
      ruc: cleanRuc,
      entityType,
      error: `Dígito verificador inválido. Se esperaba ${expectedCheckDigit}, pero se obtuvo ${actualCheckDigit}.`,
    };
  }

  return {
    isValid: true,
    ruc: cleanRuc,
    entityType,
  };
}

// ------------------------------------------------------------------------------
// HELPER: PARSEO SEGURO DE DECIMAL (EVITA EXCEPCIONES EN EDICIÓN EN TIEMPO REAL)
// ------------------------------------------------------------------------------

export function safeDecimal(val: Decimal.Value | null | undefined): Decimal {
  if (val === null || val === undefined) return new Decimal(0);
  if (typeof val === "number") return isNaN(val) ? new Decimal(0) : new Decimal(val);
  if (typeof val === "string") {
    const cleaned = val.replace(/,/g, "").trim();
    if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") return new Decimal(0);
    try {
      return new Decimal(cleaned);
    } catch {
      return new Decimal(0);
    }
  }
  if (val instanceof Decimal) return val;
  try {
    return new Decimal(val as unknown as Decimal.Value);
  } catch {
    return new Decimal(0);
  }
}

// ------------------------------------------------------------------------------
// 2. VALIDACIÓN DE PARTIDA DOBLE BIMONEDA CON DECIMAL.JS
// ------------------------------------------------------------------------------

/**
 * Valida la integridad estricta de partida doble en ambas monedas (PEN y USD).
 * Tolerancia máxima permitida para redondeo de centavos: 0.0001.
 * Realiza además validaciones a nivel de cada línea contable.
 */
export function validateDoubleEntry(
  items: VoucherLineInput[],
  accountsMap?: Map<string, AccountDestinationConfig>
): DoubleEntryValidationResult {
  let totalDebitPEN = new Decimal(0);
  let totalCreditPEN = new Decimal(0);
  let totalDebitUSD = new Decimal(0);
  let totalCreditUSD = new Decimal(0);

  const errors: string[] = [];
  const lineErrors: { lineNumber: number; message: string }[] = [];

  if (!items || items.length === 0) {
    errors.push("El voucher debe contener al menos 2 líneas para cumplir la partida doble.");
    return {
      isBalanced: false,
      isBalancedPEN: false,
      isBalancedUSD: false,
      totalDebitPEN,
      totalCreditPEN,
      diffPEN: new Decimal(0),
      totalDebitUSD,
      totalCreditUSD,
      diffUSD: new Decimal(0),
      tolerance: TOLERANCE,
      errors,
      lineErrors,
    };
  }

  // Iteración sobre cada línea garantizando operaciones con Decimal
  items.forEach((item, index) => {
    const lineNum = item.lineNumber || index + 1;

    const debitPEN = safeDecimal(item.debitPEN);
    const creditPEN = safeDecimal(item.creditPEN);
    const debitUSD = safeDecimal(item.debitUSD);
    const creditUSD = safeDecimal(item.creditUSD);

    // Validación: un movimiento no puede tener importes negativos
    if (debitPEN.isNegative() || creditPEN.isNegative() || debitUSD.isNegative() || creditUSD.isNegative()) {
      lineErrors.push({
        lineNumber: lineNum,
        message: "Los importes no pueden ser negativos.",
      });
    }

    // Validación: no debe haber débito y crédito simultáneo en la misma línea
    if ((debitPEN.gt(0) && creditPEN.gt(0)) || (debitUSD.gt(0) && creditUSD.gt(0))) {
      lineErrors.push({
        lineNumber: lineNum,
        message: "Una línea no puede contener importe en el Debe y en el Haber simultáneamente.",
      });
    }

    // Validación: debe tener algún movimiento
    if (debitPEN.isZero() && creditPEN.isZero() && debitUSD.isZero() && creditUSD.isZero()) {
      lineErrors.push({
        lineNumber: lineNum,
        message: "La línea no tiene importes monetarios asignados (Debe y Haber en cero).",
      });
    }

    // Validación de reglas de imputación contable si se provee el catálogo
    if (accountsMap) {
      const accountConfig = accountsMap.get(item.accountId) || accountsMap.get(item.accountCode);
      if (accountConfig) {
        if (!accountConfig.allowsMovement) {
          lineErrors.push({
            lineNumber: lineNum,
            message: `La cuenta ${item.accountCode} es una cuenta de nivel superior/agrupación y no permite imputación directa. Utilice la divisionaria correspondiente.`,
          });
        }
        if (accountConfig.requiresEntity && !item.entityId && !item.entityDocNumber) {
          lineErrors.push({
            lineNumber: lineNum,
            message: `La cuenta ${item.accountCode} exige un Anexo/Entidad (RUC/DNI) asociado.`,
          });
        }
        if (accountConfig.requiresCostCenter && !item.costCenterId && !item.costCenterCode) {
          lineErrors.push({
            lineNumber: lineNum,
            message: `La cuenta ${item.accountCode} exige la asignación de un Centro de Costo.`,
          });
        }
        if (accountConfig.requiresDocRef && (!item.docType || !item.docSeries || !item.docNumber)) {
          lineErrors.push({
            lineNumber: lineNum,
            message: `La cuenta ${item.accountCode} exige registrar Tipo de Documento, Serie y Correlativo.`,
          });
        }
      }
    }

    totalDebitPEN = totalDebitPEN.plus(debitPEN);
    totalCreditPEN = totalCreditPEN.plus(creditPEN);
    totalDebitUSD = totalDebitUSD.plus(debitUSD);
    totalCreditUSD = totalCreditUSD.plus(creditUSD);
  });

  const diffPEN = totalDebitPEN.minus(totalCreditPEN).abs();
  const diffUSD = totalDebitUSD.minus(totalCreditUSD).abs();

  const isBalancedPEN = diffPEN.lte(TOLERANCE);
  const isBalancedUSD = diffUSD.lte(TOLERANCE);
  const isBalanced = isBalancedPEN && isBalancedUSD && lineErrors.length === 0;

  if (!isBalancedPEN) {
    errors.push(
      `Descuadre en Soles (PEN): Total Debe S/ ${totalDebitPEN.toFixed(2)} vs Total Haber S/ ${totalCreditPEN.toFixed(2)} (Diferencia: S/ ${diffPEN.toFixed(4)}).`
    );
  }

  if (!isBalancedUSD) {
    errors.push(
      `Descuadre en Dólares (USD): Total Debe $ ${totalDebitUSD.toFixed(2)} vs Total Haber $ ${totalCreditUSD.toFixed(2)} (Diferencia: $ ${diffUSD.toFixed(4)}).`
    );
  }

  return {
    isBalanced,
    isBalancedPEN,
    isBalancedUSD,
    totalDebitPEN,
    totalCreditPEN,
    diffPEN,
    totalDebitUSD,
    totalCreditUSD,
    diffUSD,
    tolerance: TOLERANCE,
    errors,
    lineErrors,
  };
}

// ------------------------------------------------------------------------------
// 3. AMARRES AUTOMÁTICOS POR DESTINO (CLASE 6 -> CLASE 9 vs 79)
// ------------------------------------------------------------------------------

/**
 * Regla Fundamental del PCGE Peruano:
 * Todo gasto por naturaleza (cuentas de la Clase 6, con excepción de la cuenta 69
 * de Costo de Ventas que traslada mercaderías/productos vía cuentas 20/21)
 * debe generar automáticamente el asiento reflejo en la Clase 9 con abono a la
 * cuenta 791 (Cargas imputables a cuentas de costos y gastos) o 792.
 *
 * Esta función:
 * 1. Remueve destinos generados previamente (para permitir recálculo dinámico en caliente).
 * 2. Analiza cada línea de gasto de la Clase 6.
 * 3. Genera las líneas de amarre en la Clase 9 y Clase 79 manteniendo los mismos importes
 *    en PEN y USD, asociando referencias de auditoría.
 */
export function generateAutoDestinations(
  items: VoucherLineInput[],
  accountsMap: Map<string, AccountDestinationConfig>
): DestinationGenerationResult {
  const warnings: string[] = [];
  
  // 1. Filtrar cualquier línea que haya sido autogenerada previamente para evitar duplicidades
  const baseLines = items.filter((item) => !item.isAutoDestination);
  const destinationLines: VoucherLineInput[] = [];

  let nextLineNumber = baseLines.length + 1;

  for (const line of baseLines) {
    const code = line.accountCode.trim();

    // Solo aplica a cuentas que inicien con 6, excepto la 69 (Costo de Ventas)
    if (!code.startsWith("6") || code.startsWith("69")) {
      continue;
    }

    // Buscar configuración de destino de la cuenta de gasto
    const accountConfig = accountsMap.get(line.accountId) || accountsMap.get(code);

    if (!accountConfig) {
      warnings.push(
        `Línea ${line.lineNumber} (Cuenta ${code}): No se encontró configuración de catálogo para determinar el destino.`
      );
      continue;
    }

    if (!accountConfig.hasAutomaticDestination) {
      // La cuenta no tiene habilitado amarre automático
      continue;
    }

    const debitDestId = accountConfig.destinationDebitAccountId;
    const debitDestCode = accountConfig.destinationDebitAccountCode;
    const creditDestId = accountConfig.destinationCreditAccountId;
    const creditDestCode = accountConfig.destinationCreditAccountCode;

    if (!debitDestId || !creditDestId || !debitDestCode || !creditDestCode) {
      warnings.push(
        `Línea ${line.lineNumber} (Cuenta ${code}): Tiene activado el amarre pero carece de Cuenta Destino Debe (Clase 9) o Haber (Clase 79).`
      );
      continue;
    }

    const debitPEN = new Decimal(line.debitPEN || 0);
    const creditPEN = new Decimal(line.creditPEN || 0);
    const debitUSD = new Decimal(line.debitUSD || 0);
    const creditUSD = new Decimal(line.creditUSD || 0);

    const netPEN = debitPEN.minus(creditPEN);
    const netUSD = debitUSD.minus(creditUSD);

    if (netPEN.isZero() && netUSD.isZero()) {
      continue;
    }

    const lineIdRef = line.id || `line-${line.lineNumber}`;

    // Caso Habitual: Débito en Clase 6 (Gasto registrado) -> Destino: Debe Clase 9, Haber Clase 79
    if (netPEN.gt(0) || netUSD.gt(0)) {
      const amountPEN = netPEN.abs();
      const amountUSD = netUSD.abs();

      // Línea 1: Cargo a la Clase 9 (Función: Administración, Ventas, Producción)
      destinationLines.push({
        lineNumber: nextLineNumber++,
        accountId: debitDestId,
        accountCode: debitDestCode,
        accountName: accountConfig.destinationDebitAccountName || `Destino Clase 9 (${debitDestCode})`,
        entityId: line.entityId,
        entityDocNumber: line.entityDocNumber,
        costCenterId: line.costCenterId,
        costCenterCode: line.costCenterCode,
        docType: line.docType,
        docSeries: line.docSeries,
        docNumber: line.docNumber,
        docDate: line.docDate,
        glossary: `[Destino] ${line.glossary || `Gasto Cta ${code}`}`,
        debitPEN: amountPEN.toFixed(2),
        creditPEN: "0.00",
        debitUSD: amountUSD.toFixed(2),
        creditUSD: "0.00",
        isAutoDestination: true,
        originalItemId: lineIdRef,
      });

      // Línea 2: Abono a la Clase 79 (Cargas Imputables a Cuentas de Costos y Gastos)
      destinationLines.push({
        lineNumber: nextLineNumber++,
        accountId: creditDestId,
        accountCode: creditDestCode,
        accountName: accountConfig.destinationCreditAccountName || `Contrapartida 79 (${creditDestCode})`,
        costCenterId: line.costCenterId,
        costCenterCode: line.costCenterCode,
        docType: line.docType,
        docSeries: line.docSeries,
        docNumber: line.docNumber,
        docDate: line.docDate,
        glossary: `[Destino 79] ${line.glossary || `Gasto Cta ${code}`}`,
        debitPEN: "0.00",
        creditPEN: amountPEN.toFixed(2),
        debitUSD: "0.00",
        creditUSD: amountUSD.toFixed(2),
        isAutoDestination: true,
        originalItemId: lineIdRef,
      });
    } else {
      // Caso Extorno / Reversión: Crédito en Clase 6 -> Reversión de destino: Cargo a 79, Abono a Clase 9
      const amountPEN = netPEN.abs();
      const amountUSD = netUSD.abs();

      destinationLines.push({
        lineNumber: nextLineNumber++,
        accountId: creditDestId,
        accountCode: creditDestCode,
        accountName: accountConfig.destinationCreditAccountName || `Extorno Destino 79 (${creditDestCode})`,
        costCenterId: line.costCenterId,
        costCenterCode: line.costCenterCode,
        docType: line.docType,
        docSeries: line.docSeries,
        docNumber: line.docNumber,
        docDate: line.docDate,
        glossary: `[Extorno Destino 79] ${line.glossary || `Extorno Cta ${code}`}`,
        debitPEN: amountPEN.toFixed(2),
        creditPEN: "0.00",
        debitUSD: amountUSD.toFixed(2),
        creditUSD: "0.00",
        isAutoDestination: true,
        originalItemId: lineIdRef,
      });

      destinationLines.push({
        lineNumber: nextLineNumber++,
        accountId: debitDestId,
        accountCode: debitDestCode,
        accountName: accountConfig.destinationDebitAccountName || `Extorno Clase 9 (${debitDestCode})`,
        entityId: line.entityId,
        entityDocNumber: line.entityDocNumber,
        costCenterId: line.costCenterId,
        costCenterCode: line.costCenterCode,
        docType: line.docType,
        docSeries: line.docSeries,
        docNumber: line.docNumber,
        docDate: line.docDate,
        glossary: `[Extorno Destino] ${line.glossary || `Extorno Cta ${code}`}`,
        debitPEN: "0.00",
        creditPEN: amountPEN.toFixed(2),
        debitUSD: "0.00",
        creditUSD: amountUSD.toFixed(2),
        isAutoDestination: true,
        originalItemId: lineIdRef,
      });
    }
  }

  // Combinar líneas base y líneas de amarre con renumeración secuencial estricta
  const combined = [...baseLines, ...destinationLines].map((item, idx) => ({
    ...item,
    lineNumber: idx + 1,
  }));

  return {
    lines: combined,
    generatedCount: destinationLines.length,
    warnings,
  };
}

// ------------------------------------------------------------------------------
// 4. CÁLCULO MONETARIO Y TIPO DE CAMBIO
// ------------------------------------------------------------------------------

/**
 * Convierte un importe de PEN a USD o viceversa asegurando redondeo contable a 2 decimales.
 */
export function convertCurrency(
  amount: Decimal.Value,
  exchangeRate: Decimal.Value,
  direction: "PEN_TO_USD" | "USD_TO_PEN"
): Decimal {
  const amt = new Decimal(amount || 0);
  const tc = new Decimal(exchangeRate || 1);

  if (tc.isZero()) return new Decimal(0);

  if (direction === "PEN_TO_USD") {
    return amt.dividedBy(tc).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  } else {
    return amt.times(tc).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }
}
