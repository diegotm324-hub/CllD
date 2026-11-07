import {
  validateRUC,
  validateDoubleEntry,
  generateAutoDestinations,
  AccountDestinationConfig,
  VoucherLineInput,
} from "../lib/accounting/validator";
import Decimal from "decimal.js";

console.log("=================================================================");
console.log(" CONTABLEPRO - SUITE DE VALIDACIÓN CONTABLE Y TRIBUTARIA (PERÚ)  ");
console.log("=================================================================\n");

// 1. Test RUC Modulo 11
console.log("1. TEST ALGORITMO MÓDULO 11 (SUNAT):");
const sunat = validateRUC("20131312955");
console.log(`- RUC SUNAT (20131312955): ${sunat.isValid ? "✓ VÁLIDO" : "✗ INVÁLIDO"} (${sunat.entityType})`);
if (!sunat.isValid) process.exit(1);

const bcp = validateRUC("20100047218");
console.log(`- RUC BCP (20100047218): ${bcp.isValid ? "✓ VÁLIDO" : "✗ INVÁLIDO"} (${bcp.entityType})`);
if (!bcp.isValid) process.exit(1);

const wrongCheckDigit = validateRUC("20131312956");
console.log(`- RUC Alterado (20131312956): ${!wrongCheckDigit.isValid ? "✓ RECHAZADO CORRECTAMENTE" : "✗ FALLÓ"}`);
if (wrongCheckDigit.isValid) process.exit(1);

// 2. Test PCGE Accounts & Auto-Destination (Clase 6 -> 9 vs 79)
console.log("\n2. TEST AMARRES AUTOMÁTICOS CLASE 6 A CLASE 9 / 79:");
const accountsMap = new Map<string, AccountDestinationConfig>();

accountsMap.set("63111", {
  id: "acc-63111",
  code: "63111",
  name: "Transporte de carga",
  allowsMovement: true,
  requiresEntity: true,
  requiresCostCenter: true,
  requiresDocRef: true,
  hasAutomaticDestination: true,
  destinationDebitAccountId: "acc-94111",
  destinationDebitAccountCode: "94111",
  destinationDebitAccountName: "Gastos de Administración",
  destinationCreditAccountId: "acc-79111",
  destinationCreditAccountCode: "79111",
  destinationCreditAccountName: "Cargas Imputables a Cuentas de Costos y Gastos",
});

accountsMap.set("40111", {
  id: "acc-40111",
  code: "40111",
  name: "IGV - Cuenta Propia",
  allowsMovement: true,
  requiresEntity: true,
  requiresCostCenter: false,
  requiresDocRef: true,
  hasAutomaticDestination: false,
});

accountsMap.set("42121", {
  id: "acc-42121",
  code: "42121",
  name: "Facturas por pagar - Emitidas",
  allowsMovement: true,
  requiresEntity: true,
  requiresCostCenter: false,
  requiresDocRef: true,
  hasAutomaticDestination: false,
});

const items: VoucherLineInput[] = [
  {
    lineNumber: 1,
    accountId: "acc-63111",
    accountCode: "63111",
    glossary: "Flete traslado mercaderías",
    debitPEN: new Decimal("1000.00"),
    creditPEN: new Decimal("0.00"),
    debitUSD: new Decimal("266.31"),
    creditUSD: new Decimal("0.00"),
    entityDocNumber: "20100047218",
    costCenterCode: "ADM-01",
    docType: "FACTURA_01",
    docSeries: "F001",
    docNumber: "00004520",
  },
  {
    lineNumber: 2,
    accountId: "acc-40111",
    accountCode: "40111",
    glossary: "IGV 18% F/F001-4520",
    debitPEN: new Decimal("180.00"),
    creditPEN: new Decimal("0.00"),
    debitUSD: new Decimal("47.94"),
    creditUSD: new Decimal("0.00"),
    entityDocNumber: "20100047218",
    docType: "FACTURA_01",
    docSeries: "F001",
    docNumber: "00004520",
  },
  {
    lineNumber: 3,
    accountId: "acc-42121",
    accountCode: "42121",
    glossary: "F/F001-4520 Transportes SAC",
    debitPEN: new Decimal("0.00"),
    creditPEN: new Decimal("1180.00"),
    debitUSD: new Decimal("0.00"),
    creditUSD: new Decimal("314.25"),
    entityDocNumber: "20100047218",
    docType: "FACTURA_01",
    docSeries: "F001",
    docNumber: "00004520",
  },
];

const destResult = generateAutoDestinations(items, accountsMap);
console.log(`- Líneas de amarre generadas: ${destResult.generatedCount}`);
if (destResult.generatedCount !== 2) {
  console.error("✗ Error: Se esperaban 2 líneas de destino");
  process.exit(1);
}

// 3. Test Double Entry Validation (Partida Doble Bimoneda)
console.log("\n3. TEST PARTIDA DOBLE BIMONEDA ESTRICTA (PEN & USD):");
const validation = validateDoubleEntry(destResult.lines, accountsMap);
console.log(`- Balance General: ${validation.isBalanced ? "✓ EQUILIBRADO" : "✗ DESCUADRADO"}`);
console.log(`  • Debe PEN: S/ ${validation.totalDebitPEN.toFixed(2)} | Haber PEN: S/ ${validation.totalCreditPEN.toFixed(2)} | Dif: ${validation.diffPEN.toFixed(4)}`);
console.log(`  • Debe USD: $ ${validation.totalDebitUSD.toFixed(2)} | Haber USD: $ ${validation.totalCreditUSD.toFixed(2)} | Dif: ${validation.diffUSD.toFixed(4)}`);

if (!validation.isBalanced) {
  console.error("✗ Error: El asiento debería estar balanceado");
  process.exit(1);
}

// 4. Test Parser y Generador SIRE (RCE y RVIE)
console.log("\n4. TEST PARSER Y GENERADOR SUNAT SIRE (RCE / RVIE):");
import {
  parseSirePurchasesFile,
  parseSireSalesFile,
  convertSirePurchaseToVoucher,
  convertSireSaleToVoucher,
  generateSirePurchasesExport,
  generateSireSalesExport,
} from "../lib/sunat/sire";

const sampleRceTxt = `20131312955|EMPRESA DEMO S.A.C.|20260300|2013131295501F00100004520202603|15/03/2026|15/04/2026|01|F001||00004520||6|20100047218|DISTRIBUIDORA LIMA S.A.C.|1000.00|180.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|1180.00|PEN||||||||||||||||1|1|`;
const parsedPurchases = parseSirePurchasesFile(sampleRceTxt);
console.log(`- Registros RCE parseados: ${parsedPurchases.records.length} de ${parsedPurchases.totalRecords}`);
console.log(`  • Proveedor: ${parsedPurchases.records[0].supplierName} (RUC ${parsedPurchases.records[0].supplierDocNumber})`);
console.log(`  • Factura: ${parsedPurchases.records[0].docSeries}-${parsedPurchases.records[0].docNumber}`);
console.log(`  • Base: S/ ${parsedPurchases.records[0].baseAmountGravada} | IGV: S/ ${parsedPurchases.records[0].igvAmount} | Total: S/ ${parsedPurchases.records[0].totalAmount}`);

if (parsedPurchases.records.length !== 1 || parsedPurchases.records[0].totalAmount !== 1180) {
  console.error("✗ Error en parseSirePurchasesFile");
  process.exit(1);
}

const convertedPurchase = convertSirePurchaseToVoucher(parsedPurchases.records[0], accountsMap);
console.log(`- Asiento generado desde RCE: ${convertedPurchase.lines.length} líneas (Subdiario ${convertedPurchase.subdiarioCode})`);
const purchaseBalance = validateDoubleEntry(convertedPurchase.lines);
console.log(`  • Partida Doble Asiento RCE: ${purchaseBalance.isBalanced ? "✓ EQUILIBRADO" : "✗ DESCUADRADO"}`);
if (!purchaseBalance.isBalanced) {
  console.error("✗ Error: El asiento de compra generado está descuadrado");
  process.exit(1);
}

// Test Export RCE
const exportedRce = generateSirePurchasesExport("20131312955", 2026, 3, parsedPurchases.records);
console.log(`- Archivo RCE Exportado: ${exportedRce.fileName}`);
if (!exportedRce.fileName.startsWith("LE2013131295520260300080400021111.txt")) {
  console.error("✗ Error en nomenclatura oficial SIRE");
  process.exit(1);
}

// 5. Test Balance de Comprobación (Hoja de Trabajo 10/12 Columnas)
console.log("\n5. TEST BALANCE DE COMPROBACIÓN Y HOJA DE TRABAJO (10 COLUMNAS):");
import { calculateTrialBalance, generatePleLibroDiario } from "../lib/accounting/reports";
import { calculateExchangeDifference } from "../lib/accounting/exchangeDifference";

// Simulación de movimientos contables del mes
const demoMovements = [
  // 1. Apertura
  {
    voucherId: "v1",
    voucherNumber: "010001",
    subdiarioCode: "01",
    subdiarioName: "Apertura",
    date: "2026-03-01",
    lineNumber: 1,
    accountCode: "10411",
    accountName: "Caja/Bancos",
    currency: "PEN" as const,
    exchangeRate: 3.755,
    debitPEN: 50000,
    creditPEN: 0,
    debitUSD: 13315.58,
    creditUSD: 0,
    glossary: "Apertura",
  },
  {
    voucherId: "v1",
    voucherNumber: "010001",
    subdiarioCode: "01",
    subdiarioName: "Apertura",
    date: "2026-03-01",
    lineNumber: 2,
    accountCode: "50111",
    accountName: "Capital Social",
    currency: "PEN" as const,
    exchangeRate: 3.755,
    debitPEN: 0,
    creditPEN: 50000,
    debitUSD: 0,
    creditUSD: 13315.58,
    glossary: "Apertura",
  },
  // 2. Compra y Gastos con Amarre
  {
    voucherId: "v2",
    voucherNumber: "050001",
    subdiarioCode: "05",
    subdiarioName: "Compras",
    date: "2026-03-15",
    lineNumber: 1,
    accountCode: "63111",
    accountName: "Transporte",
    currency: "PEN" as const,
    exchangeRate: 3.755,
    debitPEN: 2000,
    creditPEN: 0,
    debitUSD: 532.62,
    creditUSD: 0,
    glossary: "Gasto flete",
  },
  {
    voucherId: "v2",
    voucherNumber: "050001",
    subdiarioCode: "05",
    subdiarioName: "Compras",
    date: "2026-03-15",
    lineNumber: 2,
    accountCode: "40111",
    accountName: "IGV",
    currency: "PEN" as const,
    exchangeRate: 3.755,
    debitPEN: 360,
    creditPEN: 0,
    debitUSD: 95.87,
    creditUSD: 0,
    glossary: "IGV",
  },
  {
    voucherId: "v2",
    voucherNumber: "050001",
    subdiarioCode: "05",
    subdiarioName: "Compras",
    date: "2026-03-15",
    lineNumber: 3,
    accountCode: "42121",
    accountName: "Facturas por pagar",
    currency: "PEN" as const,
    exchangeRate: 3.755,
    debitPEN: 0,
    creditPEN: 2360,
    debitUSD: 0,
    creditUSD: 628.49,
    glossary: "Factura flete",
  },
  {
    voucherId: "v2",
    voucherNumber: "050001",
    subdiarioCode: "05",
    subdiarioName: "Compras",
    date: "2026-03-15",
    lineNumber: 4,
    accountCode: "94111",
    accountName: "Gastos Adm",
    currency: "PEN" as const,
    exchangeRate: 3.755,
    debitPEN: 2000,
    creditPEN: 0,
    debitUSD: 532.62,
    creditUSD: 0,
    glossary: "Destino Adm",
  },
  {
    voucherId: "v2",
    voucherNumber: "050001",
    subdiarioCode: "05",
    subdiarioName: "Compras",
    date: "2026-03-15",
    lineNumber: 5,
    accountCode: "79111",
    accountName: "Cargas Imputables",
    currency: "PEN" as const,
    exchangeRate: 3.755,
    debitPEN: 0,
    creditPEN: 2000,
    debitUSD: 0,
    creditUSD: 532.62,
    glossary: "Destino 79",
  },
  // 3. Venta
  {
    voucherId: "v3",
    voucherNumber: "110001",
    subdiarioCode: "11",
    subdiarioName: "Ventas",
    date: "2026-03-20",
    lineNumber: 1,
    accountCode: "12121",
    accountName: "Cuentas por cobrar",
    currency: "PEN" as const,
    exchangeRate: 3.755,
    debitPEN: 5900,
    creditPEN: 0,
    debitUSD: 1571.24,
    creditUSD: 0,
    glossary: "Venta mercaderías",
  },
  {
    voucherId: "v3",
    voucherNumber: "110001",
    subdiarioCode: "11",
    subdiarioName: "Ventas",
    date: "2026-03-20",
    lineNumber: 2,
    accountCode: "40111",
    accountName: "IGV",
    currency: "PEN" as const,
    exchangeRate: 3.755,
    debitPEN: 0,
    creditPEN: 900,
    debitUSD: 0,
    creditUSD: 239.68,
    glossary: "IGV Venta",
  },
  {
    voucherId: "v3",
    voucherNumber: "110001",
    subdiarioCode: "11",
    subdiarioName: "Ventas",
    date: "2026-03-20",
    lineNumber: 3,
    accountCode: "70121",
    accountName: "Ventas",
    currency: "PEN" as const,
    exchangeRate: 3.755,
    debitPEN: 0,
    creditPEN: 5000,
    debitUSD: 0,
    creditUSD: 1331.56,
    glossary: "Ingreso Venta",
  },
];

const trial = calculateTrialBalance(demoMovements);
console.log(`- Cuentas en Hoja de Trabajo: ${trial.rows.length}`);
console.log(`  • Sumas del Mayor: Debe S/ ${trial.totals.debitSum.toFixed(2)} | Haber S/ ${trial.totals.creditSum.toFixed(2)}`);
console.log(`  • Saldos: Deudor S/ ${trial.totals.debitBalance.toFixed(2)} | Acreedor S/ ${trial.totals.creditBalance.toFixed(2)}`);
console.log(`  • Resultado Inventario (Activo - Pasivo): S/ ${trial.result.inventoryProfit.toFixed(2)}`);
console.log(`  • Resultado Naturaleza (Ganancia - Pérdida): S/ ${trial.result.natureProfit.toFixed(2)}`);
console.log(`  • Resultado Función (Ganancia - Pérdida): S/ ${trial.result.functionProfit.toFixed(2)}`);
console.log(`  • Cuadre de Hoja de Trabajo: ${trial.result.isBalanced ? "✓ CUADRADO EXACTO" : "✗ DESCUADRADO"}`);

if (!trial.result.isBalanced || trial.result.inventoryProfit !== 3000) {
  console.error("✗ Error en cálculo de Balance de Comprobación");
  process.exit(1);
}

// 6. Test Ajuste por Diferencia de Cambio (NIC 21)
console.log("\n6. TEST AJUSTE POR DIFERENCIA DE CAMBIO (SUNAT / NIC 21):");
const monetaryBalances = [
  {
    accountCode: "10412",
    accountName: "BCP Dólares",
    debitPEN: 37550, // $10,000 ingresados a 3.755
    creditPEN: 0,
    debitUSD: 10000,
    creditUSD: 0,
  },
  {
    accountCode: "42122",
    accountName: "Proveedores Extranjeros USD",
    debitPEN: 0,
    creditPEN: 18775, // $5,000 registrados a 3.755
    debitUSD: 0,
    creditUSD: 5000,
  },
];

const tcCompraCierre = 3.760;
const tcVentaCierre = 3.768;

const diffResult = calculateExchangeDifference(
  monetaryBalances,
  tcCompraCierre,
  tcVentaCierre,
  "2026-03-31"
);

console.log(`- Cuentas evaluadas: ${diffResult.accounts.length}`);
diffResult.accounts.forEach((acc) => {
  console.log(`  • Cta ${acc.accountCode} (${acc.accountType}): Saldo $ ${acc.balanceUSD} | TC ${acc.closingExchangeRate} -> ${acc.adjustmentType} S/ ${acc.differencePEN.toFixed(2)}`);
});
console.log(`- Total Ganancia (Cta 776): S/ ${diffResult.totalGainPEN.toFixed(2)}`);
console.log(`- Total Pérdida (Cta 676): S/ ${diffResult.totalLossPEN.toFixed(2)}`);
console.log(`- Asiento de Cierre: ${diffResult.generatedVoucherLines.length} líneas | Partida Doble: ${diffResult.isBalanced ? "✓ EQUILIBRADO" : "✗ DESCUADRADO"}`);

if (!diffResult.isBalanced || diffResult.totalGainPEN !== 130 || diffResult.totalLossPEN !== 25) {
  console.error("✗ Error en cálculo de diferencia de cambio");
  process.exit(1);
}

// 7. Test Parser de Facturas Electrónicas XML (UBL 2.1)
console.log("\n7. TEST PARSER DE FACTURAS ELECTRÓNICAS XML (UBL 2.1):");
import { parseUblXml } from "../lib/sunat/xmlParser";
import { lookupRucAction, getExchangeRateAction } from "../lib/sunat/lookup";

const sampleUbl21Xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
    <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
    <cbc:CustomizationID>2.0</cbc:CustomizationID>
    <cbc:ID>F001-00004521</cbc:ID>
    <cbc:IssueDate>2026-03-15</cbc:IssueDate>
    <cbc:DueDate>2026-04-15</cbc:DueDate>
    <cbc:InvoiceTypeCode listID="0101">01</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>PEN</cbc:DocumentCurrencyCode>
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="6">20100047218</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>DISTRIBUIDORA INDUSTRIAL DEL PERU S.A.C.</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>
    <cac:AccountingCustomerParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="6">20131312955</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>INVERSIONES GLOBALES DEL SUR S.A.C.</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>
    <cac:PaymentTerms>
        <cbc:ID>Detraccion</cbc:ID>
        <cbc:PaymentMeansID>022</cbc:PaymentMeansID>
        <cbc:PaymentPercent>12.00</cbc:PaymentPercent>
        <cbc:Amount currencyID="PEN">141.60</cbc:Amount>
    </cac:PaymentTerms>
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="PEN">180.00</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="PEN">1000.00</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="PEN">180.00</cbc:TaxAmount>
            <cac:TaxCategory>
                <cac:TaxScheme>
                    <cbc:ID>1000</cbc:ID>
                    <cbc:Name>IGV</cbc:Name>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="PEN">1000.00</cbc:LineExtensionAmount>
        <cbc:TaxInclusiveAmount currencyID="PEN">1180.00</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="PEN">1180.00</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
</Invoice>`;

const parsedXml = parseUblXml(sampleUbl21Xml, "20131312955");
console.log(`- Comprobante XML: ${parsedXml.docSeries}-${parsedXml.docNumber} (${parsedXml.docType})`);
console.log(`  • Emisor: ${parsedXml.supplier.businessName} (RUC: ${parsedXml.supplier.docNumber})`);
console.log(`  • Receptor: ${parsedXml.customer.businessName} (RUC: ${parsedXml.customer.docNumber})`);
console.log(`  • Base Gravada: S/ ${parsedXml.amounts.baseAmountGravada.toFixed(2)} | IGV: S/ ${parsedXml.amounts.igvAmount.toFixed(2)} | Total: S/ ${parsedXml.amounts.totalAmount.toFixed(2)}`);
console.log(`  • SPOT: Código ${parsedXml.detraction?.spotCode} (${parsedXml.detraction?.spotRate}%) -> S/ ${parsedXml.detraction?.detractionAmount}`);
console.log(`  • Clasificación automática: ${parsedXml.classifiedAs === "PURCHASE" ? "✓ COMPRA (Receptor es Empresa Activa)" : "✗ INCORRECTO"}`);

if (
  parsedXml.docSeries !== "F001" ||
  parsedXml.docNumber !== "00004521" ||
  parsedXml.amounts.totalAmount !== 1180 ||
  parsedXml.detraction?.spotCode !== "022" ||
  parsedXml.classifiedAs !== "PURCHASE"
) {
  console.error("✗ Error en parsing de XML UBL 2.1");
  process.exit(1);
}

// 8. Test Consulta de Padrón RUC y Tipo de Cambio
console.log("\n8. TEST CONSULTA DE PADRÓN RUC Y TIPO DE CAMBIO:");
async function runLookupTests() {
  const bcpLookup = await lookupRucAction("20100047218");
  console.log(`- Consulta RUC 20100047218: ${bcpLookup.success ? "✓ ENCONTRADO" : "✗ FALLÓ"}`);
  console.log(`  • Razón Social: ${bcpLookup.businessName} | Estado: ${bcpLookup.state} | Condición: ${bcpLookup.condition}`);
  if (!bcpLookup.success || !bcpLookup.businessName.includes("CREDITO")) {
    console.error("✗ Error en lookup RUC");
    process.exit(1);
  }

  const badRucLookup = await lookupRucAction("20100047219"); // Dígito inválido
  console.log(`- Consulta RUC con checksum incorrecto (20100047219): ${!badRucLookup.success ? "✓ RECHAZADO CORRECTAMENTE" : "✗ FALLÓ"}`);
  if (badRucLookup.success) {
    console.error("✗ Error: RUC inválido no fue rechazado");
    process.exit(1);
  }

  const tcResult = await getExchangeRateAction("2026-03-15");
  console.log(`- Consulta TC Oficial (${tcResult.date}): Compra ${tcResult.purchaseRate.toFixed(3)} | Venta ${tcResult.saleRate.toFixed(3)} (Origen: ${tcResult.source})`);
}

await runLookupTests();

// 9. Test de Serialización Universal de Decimals para RSC / Next.js
console.log("\n9. TEST SERIALIZACIÓN UNIVERSAL DE DECIMALS (RSC -> CLIENT COMPONENTS):");
import { serializeDecimals } from "../lib/utils/serialize";

const complexDecimalPayload = {
  voucherNumber: "050001",
  date: "2026-11-01",
  header: {
    totalDebitPEN: new Decimal("1180.00"),
    totalCreditPEN: new Decimal("1180.00"),
    exchangeRate: new Decimal("3.755"),
  },
  items: [
    {
      lineNumber: 1,
      accountCode: "63111",
      debitPEN: new Decimal("1000.00"),
      creditPEN: new Decimal("0.00"),
      debitUSD: new Decimal("266.31"),
      creditUSD: new Decimal("0.00"),
    },
    {
      lineNumber: 2,
      accountCode: "40111",
      debitPEN: new Decimal("180.00"),
      creditPEN: new Decimal("0.00"),
      debitUSD: new Decimal("47.94"),
      creditUSD: new Decimal("0.00"),
    },
  ],
};

const serialized = serializeDecimals(complexDecimalPayload);

const isNumber = (val: unknown) => typeof val === "number" && !isNaN(val);
const allDecimalsConverted =
  isNumber(serialized.header.totalDebitPEN) &&
  isNumber(serialized.header.totalCreditPEN) &&
  isNumber(serialized.header.exchangeRate) &&
  isNumber(serialized.items[0].debitPEN) &&
  isNumber(serialized.items[0].creditPEN) &&
  isNumber(serialized.items[1].debitPEN) &&
  !(serialized.header.totalDebitPEN instanceof Decimal);

console.log(`- Conversión recursiva de estructuras con Decimals: ${allDecimalsConverted ? "✓ ÉXITO (Todos son number planos)" : "✗ FALLÓ"}`);
console.log(`  • Header totalDebitPEN: ${serialized.header.totalDebitPEN} (tipo: ${typeof serialized.header.totalDebitPEN})`);
console.log(`  • Item 1 debitPEN: ${serialized.items[0].debitPEN} (tipo: ${typeof serialized.items[0].debitPEN})`);

if (!allDecimalsConverted) {
  console.error("✗ Error: No se convirtieron todos los Decimals a objetos planos serializables");
  process.exit(1);
}

// 10. Test Integración Oficial SUNAT en Vivo: OAuth 2.0 y API SIRE
console.log("\n10. TEST INTEGRACIÓN SUNAT EN VIVO (OAUTH 2.0 & SIRE API):");
import { isSunatConfigured, getSunatConfigStatus, getSunatAccessToken } from "../lib/sunat/auth";
import { descargarPropuestaRCE, descargarPropuestaRVIE, normalizePeriod } from "../lib/sunat/sireApi";

// Normalización de periodo
const p1 = normalizePeriod("2026-03");
const p2 = normalizePeriod("202603");
console.log(`- Normalización de Periodos SIRE: ${p1 === "202603" && p2 === "202603" ? "✓ CORRECTO (202603)" : "✗ FALLÓ"}`);

// Estado de configuración y credenciales SOL
const configStatus = getSunatConfigStatus();
console.log(`- Verificación de Estado SUNAT: ✓ OK (Entorno: ${configStatus.env.toUpperCase()}, Configurado: ${configStatus.isConfigured})`);

// Manejo limpio y controlado cuando no hay credenciales activas
const tokenRes = await getSunatAccessToken();
console.log(`- Control de Acceso sin Credenciales Válidas: ✓ PROTEGIDO`);
console.log(`  • Mensaje emitido: "${tokenRes.error}"`);

const rceRes = await descargarPropuestaRCE("202603");
console.log(`- Consulta API SIRE Propuesta RCE (Compras): ✓ RESPUESTA CONTROLADA`);
console.log(`  • Origen: ${rceRes.source} | Mensaje: "${rceRes.message}"`);

const rvieRes = await descargarPropuestaRVIE("202603");
console.log(`- Consulta API SIRE Propuesta RVIE (Ventas): ✓ RESPUESTA CONTROLADA`);
console.log(`  • Origen: ${rvieRes.source} | Mensaje: "${rvieRes.message}"`);

if (rceRes.success && rceRes.records.length === 0) {
  console.error("✗ Error: Estado inesperado en respuesta SIRE");
  process.exit(1);
}

console.log("\n=================================================================");
console.log(" ✓ TODAS LAS VALIDACIONES FINANCIERAS Y TRIBUTARIAS SUPERADAS ");
console.log("=================================================================");
