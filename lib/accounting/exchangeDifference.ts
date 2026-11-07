// ==============================================================================
// ContablePro - Módulo de Ajuste por Diferencia de Cambio (NIC 21 / SUNAT)
// Regla: TC Venta SUNAT para Activos y TC Compra SUNAT para Pasivos en USD
// Cuentas de Cierre: 77611 (Ganancia) y 67611 (Pérdida)
// ==============================================================================

import Decimal from "decimal.js";
import { VoucherLineInput, validateDoubleEntry } from "./validator";

export interface MonetaryAccountBalance {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: "ACTIVO" | "PASIVO";
  balanceUSD: number;           // Saldo neto en Dólares
  recordedBalancePEN: number;   // Saldo neto en Soles registrado históricamente
  closingExchangeRate: number;  // TC aplicable (Venta para Activos, Compra para Pasivos)
  adjustedBalancePEN: number;   // balanceUSD * closingExchangeRate
  differencePEN: number;        // adjustedBalancePEN - recordedBalancePEN
  adjustmentType: "GANANCIA" | "PERDIDA" | "SIN_AJUSTE";
  gainPEN: number;
  lossPEN: number;
}

export interface ExchangeDifferenceCalculationResult {
  closingDate: string;
  closingPurchaseRate: number; // TC Compra SUNAT
  closingSaleRate: number;     // TC Venta SUNAT
  accounts: MonetaryAccountBalance[];
  totalGainPEN: number;
  totalLossPEN: number;
  netAdjustmentPEN: number;
  generatedVoucherLines: VoucherLineInput[];
  isBalanced: boolean;
}

/**
 * Analiza saldos de cuentas monetarias en moneda extranjera (10, 12, 16, 42, 46)
 * y genera las líneas de regularización por diferencia de cambio al cierre del periodo.
 */
export function calculateExchangeDifference(
  balances: {
    accountId?: string;
    accountCode: string;
    accountName: string;
    debitPEN: number;
    creditPEN: number;
    debitUSD: number;
    creditUSD: number;
  }[],
  closingPurchaseRate: number,
  closingSaleRate: number,
  closingDate: string
): ExchangeDifferenceCalculationResult {
  const purchaseTc = new Decimal(closingPurchaseRate);
  const saleTc = new Decimal(closingSaleRate);

  const evaluatedAccounts: MonetaryAccountBalance[] = [];
  const voucherLines: VoucherLineInput[] = [];

  let nextLine = 1;
  let totalGain = new Decimal(0);
  let totalLoss = new Decimal(0);

  // Cuentas monetarias reguladas por SUNAT / NIC 21
  for (const b of balances) {
    const code = b.accountCode.trim();
    const prefix2 = code.substring(0, 2);

    const isAsset = ["10", "12", "16"].includes(prefix2);
    const isLiability = ["42", "46"].includes(prefix2);

    if (!isAsset && !isLiability) {
      continue;
    }

    const dUSD = new Decimal(b.debitUSD || 0);
    const cUSD = new Decimal(b.creditUSD || 0);
    const dPEN = new Decimal(b.debitPEN || 0);
    const cPEN = new Decimal(b.creditPEN || 0);

    // 1. Caso Activos Monetarios (10, 12, 16) -> Criterio: TC VENTA SUNAT
    if (isAsset) {
      const netUSD = dUSD.minus(cUSD);
      const netPEN = dPEN.minus(cPEN);

      if (netUSD.isZero() && netPEN.isZero()) continue;

      const adjustedPEN = netUSD.times(saleTc).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const diffPEN = adjustedPEN.minus(netPEN).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      let adjType: MonetaryAccountBalance["adjustmentType"] = "SIN_AJUSTE";
      let gain = new Decimal(0);
      let loss = new Decimal(0);

      if (diffPEN.gt(0)) {
        adjType = "GANANCIA";
        gain = diffPEN;
        totalGain = totalGain.plus(gain);

        // Línea 1: Cargo a la Cuenta de Activo
        voucherLines.push({
          lineNumber: nextLine++,
          accountId: b.accountId || `acc-${code}`,
          accountCode: code,
          accountName: b.accountName,
          glossary: `Ajuste Ganancia Dif. Cambio TC ${saleTc.toFixed(3)}`,
          debitPEN: gain.toNumber(),
          creditPEN: 0,
          debitUSD: 0,
          creditUSD: 0,
          isAutoDestination: false,
        });

        // Línea 2: Abono a la Cuenta 77611 (Ganancia por Diferencia de Cambio)
        voucherLines.push({
          lineNumber: nextLine++,
          accountId: "acc-77611",
          accountCode: "77611",
          accountName: "Ganancia por diferencia de cambio",
          glossary: `Ganancia Dif. Cambio Cta ${code}`,
          debitPEN: 0,
          creditPEN: gain.toNumber(),
          debitUSD: 0,
          creditUSD: 0,
          isAutoDestination: false,
        });
      } else if (diffPEN.lt(0)) {
        adjType = "PERDIDA";
        loss = diffPEN.abs();
        totalLoss = totalLoss.plus(loss);

        // Línea 1: Cargo a la Cuenta 67611 (Pérdida por Diferencia de Cambio)
        voucherLines.push({
          lineNumber: nextLine++,
          accountId: "acc-67611",
          accountCode: "67611",
          accountName: "Pérdida por diferencia de cambio",
          glossary: `Pérdida Dif. Cambio Cta ${code}`,
          debitPEN: loss.toNumber(),
          creditPEN: 0,
          debitUSD: 0,
          creditUSD: 0,
          isAutoDestination: false,
        });

        // Línea 2: Abono a la Cuenta de Activo
        voucherLines.push({
          lineNumber: nextLine++,
          accountId: b.accountId || `acc-${code}`,
          accountCode: code,
          accountName: b.accountName,
          glossary: `Ajuste Pérdida Dif. Cambio TC ${saleTc.toFixed(3)}`,
          debitPEN: 0,
          creditPEN: loss.toNumber(),
          debitUSD: 0,
          creditUSD: 0,
          isAutoDestination: false,
        });
      }

      evaluatedAccounts.push({
        accountId: b.accountId || `acc-${code}`,
        accountCode: code,
        accountName: b.accountName,
        accountType: "ACTIVO",
        balanceUSD: netUSD.toNumber(),
        recordedBalancePEN: netPEN.toNumber(),
        closingExchangeRate: saleTc.toNumber(),
        adjustedBalancePEN: adjustedPEN.toNumber(),
        differencePEN: diffPEN.toNumber(),
        adjustmentType: adjType,
        gainPEN: gain.toNumber(),
        lossPEN: loss.toNumber(),
      });
    }

    // 2. Caso Pasivos Monetarios (42, 46) -> Criterio: TC COMPRA SUNAT
    if (isLiability) {
      const netUSD = cUSD.minus(dUSD); // Saldo acreedor en USD
      const netPEN = cPEN.minus(dPEN); // Saldo acreedor en PEN

      if (netUSD.isZero() && netPEN.isZero()) continue;

      const adjustedPEN = netUSD.times(purchaseTc).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      // Para pasivos: si el saldo ajustado es mayor que el registrado, la deuda creció (pérdida)
      const diffPEN = adjustedPEN.minus(netPEN).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      let adjType: MonetaryAccountBalance["adjustmentType"] = "SIN_AJUSTE";
      let gain = new Decimal(0);
      let loss = new Decimal(0);

      if (diffPEN.gt(0)) {
        // La deuda en Soles aumentó -> Pérdida por Diferencia de Cambio
        adjType = "PERDIDA";
        loss = diffPEN;
        totalLoss = totalLoss.plus(loss);

        // Línea 1: Cargo a 67611
        voucherLines.push({
          lineNumber: nextLine++,
          accountId: "acc-67611",
          accountCode: "67611",
          accountName: "Pérdida por diferencia de cambio",
          glossary: `Pérdida Dif. Cambio Pasivo Cta ${code}`,
          debitPEN: loss.toNumber(),
          creditPEN: 0,
          debitUSD: 0,
          creditUSD: 0,
          isAutoDestination: false,
        });

        // Línea 2: Abono al Pasivo
        voucherLines.push({
          lineNumber: nextLine++,
          accountId: b.accountId || `acc-${code}`,
          accountCode: code,
          accountName: b.accountName,
          glossary: `Ajuste Pasivo Dif. Cambio TC ${purchaseTc.toFixed(3)}`,
          debitPEN: 0,
          creditPEN: loss.toNumber(),
          debitUSD: 0,
          creditUSD: 0,
          isAutoDestination: false,
        });
      } else if (diffPEN.lt(0)) {
        // La deuda en Soles disminuyó -> Ganancia por Diferencia de Cambio
        adjType = "GANANCIA";
        gain = diffPEN.abs();
        totalGain = totalGain.plus(gain);

        // Línea 1: Cargo al Pasivo
        voucherLines.push({
          lineNumber: nextLine++,
          accountId: b.accountId || `acc-${code}`,
          accountCode: code,
          accountName: b.accountName,
          glossary: `Ajuste Pasivo Dif. Cambio TC ${purchaseTc.toFixed(3)}`,
          debitPEN: gain.toNumber(),
          creditPEN: 0,
          debitUSD: 0,
          creditUSD: 0,
          isAutoDestination: false,
        });

        // Línea 2: Abono a 77611
        voucherLines.push({
          lineNumber: nextLine++,
          accountId: "acc-77611",
          accountCode: "77611",
          accountName: "Ganancia por diferencia de cambio",
          glossary: `Ganancia Dif. Cambio Pasivo Cta ${code}`,
          debitPEN: 0,
          creditPEN: gain.toNumber(),
          debitUSD: 0,
          creditUSD: 0,
          isAutoDestination: false,
        });
      }

      evaluatedAccounts.push({
        accountId: b.accountId || `acc-${code}`,
        accountCode: code,
        accountName: b.accountName,
        accountType: "PASIVO",
        balanceUSD: netUSD.toNumber(),
        recordedBalancePEN: netPEN.toNumber(),
        closingExchangeRate: purchaseTc.toNumber(),
        adjustedBalancePEN: adjustedPEN.toNumber(),
        differencePEN: diffPEN.toNumber(),
        adjustmentType: adjType,
        gainPEN: gain.toNumber(),
        lossPEN: loss.toNumber(),
      });
    }
  }

  // Renumerar correlativamente
  const finalVoucherLines = voucherLines.map((l, idx) => ({ ...l, lineNumber: idx + 1 }));
  const valCheck = validateDoubleEntry(finalVoucherLines);

  return {
    closingDate,
    closingPurchaseRate,
    closingSaleRate,
    accounts: evaluatedAccounts,
    totalGainPEN: totalGain.toNumber(),
    totalLossPEN: totalLoss.toNumber(),
    netAdjustmentPEN: totalGain.minus(totalLoss).toNumber(),
    generatedVoucherLines: finalVoucherLines,
    isBalanced: valCheck.isBalanced,
  };
}
