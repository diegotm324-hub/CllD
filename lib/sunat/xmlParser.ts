// ==============================================================================
// ContablePro - Parser de Facturación Electrónica SUNAT (XML UBL 2.1)
// Soporta Facturas (01), Boletas (03), Notas de Crédito (07) y Débito (08)
// Extracción de Proveedor/Cliente, Documento, Moneda, Impuestos y SPOT (Detracción)
// ==============================================================================

import { XMLParser } from "fast-xml-parser";

export interface ParsedInvoiceXml {
  docType: "01" | "03" | "07" | "08";
  docSeries: string;
  docNumber: string;
  fullDocNumber: string;          // Ej: "F001-00004521"
  issueDate: string;              // YYYY-MM-DD
  dueDate?: string;               // YYYY-MM-DD
  currency: "PEN" | "USD";
  exchangeRate?: number;

  // Emisor (Proveedor si es Compra / Empresa si es Venta)
  supplier: {
    docType: string;              // "6" = RUC
    docNumber: string;
    businessName: string;
    address?: string;
  };

  // Receptor / Adquiriente (Empresa si es Compra / Cliente si es Venta)
  customer: {
    docType: string;              // "6" = RUC, "1" = DNI
    docNumber: string;
    businessName: string;
  };

  // Desglose de Importes e Impuestos
  amounts: {
    baseAmountGravada: number;    // Operaciones Gravadas (Código 1000)
    baseAmountInafecta: number;   // Inafectas (Código 9998)
    baseAmountExonerada: number;  // Exoneradas (Código 9997)
    igvAmount: number;            // IGV 18% (Código 1000)
    iscAmount: number;            // Impuesto Selectivo al Consumo
    icbperAmount: number;         // Impuesto bolsas plásticas
    otherTaxes: number;
    totalAmount: number;          // Total a pagar (PayableAmount)
  };

  // Detracción SPOT (si viene especificada en cac:PaymentTerms o Notas)
  detraction?: {
    isSubject: boolean;
    spotCode?: string;            // Ej: "022"
    spotRate?: number;            // Ej: 12.00
    detractionAmount?: number;    // Monto retenido para depósito SPOT
  };

  // Referencia para Notas de Crédito / Débito
  reference?: {
    docType: string;              // 01, 03
    docSeries: string;
    docNumber: string;
    reasonCode?: string;
    reasonDescription?: string;
  };

  // Clasificación de la Operación respecto al RUC de la empresa activa
  classifiedAs: "PURCHASE" | "SALE" | "UNKNOWN";
  rawXmlLength: number;
}

/**
 * Parsea el contenido de texto plano de un XML electrónico SUNAT bajo el estándar UBL 2.1.
 * @param xmlContent Cadena de texto con el XML completo.
 * @param activeCompanyRuc RUC de la empresa activa para clasificar automáticamente si es Compra o Venta.
 */
export function parseUblXml(xmlContent: string, activeCompanyRuc?: string): ParsedInvoiceXml {
  if (!xmlContent || !xmlContent.trim()) {
    throw new Error("El contenido del archivo XML está vacío.");
  }

  // Configuración de fast-xml-parser para neutralizar prefijos de namespaces (cac, cbc, ns2, etc.)
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true, // Convierte <cac:TaxTotal> en <TaxTotal>, haciendo el parseo universal
    trimValues: true,
    parseTagValue: false, // Preserva cadenas con ceros a la izquierda (ej: "022", "01", "00004521")
  });

  const parsed = parser.parse(xmlContent);

  // Identificar el nodo raíz (Invoice, CreditNote o DebitNote)
  let rootNode: any = null;
  let inferredDocType: "01" | "03" | "07" | "08" = "01";

  if (parsed.Invoice) {
    rootNode = parsed.Invoice;
    const typeCode = String(rootNode.InvoiceTypeCode?.["#text"] || rootNode.InvoiceTypeCode || "01").trim();
    inferredDocType = typeCode === "03" ? "03" : "01";
  } else if (parsed.CreditNote) {
    rootNode = parsed.CreditNote;
    inferredDocType = "07";
  } else if (parsed.DebitNote) {
    rootNode = parsed.DebitNote;
    inferredDocType = "08";
  } else {
    throw new Error(
      "El archivo XML no corresponde a un comprobante electrónico SUNAT válido (se esperaba nodo Invoice, CreditNote o DebitNote)."
    );
  }

  // 1. Serie y Correlativo
  const rawId = String(rootNode.ID || "").trim();
  let docSeries = "";
  let docNumber = "";

  if (rawId.includes("-")) {
    const parts = rawId.split("-");
    docSeries = parts[0].toUpperCase();
    docNumber = parts[1];
  } else {
    docSeries = rawId.substring(0, 4);
    docNumber = rawId.substring(4);
  }

  // 2. Fechas y Moneda
  const issueDate = String(rootNode.IssueDate || new Date().toISOString().split("T")[0]).trim();
  let dueDate = rootNode.DueDate ? String(rootNode.DueDate).trim() : undefined;

  // Buscar fecha de vencimiento en PaymentTerms si no está en raíz
  if (!dueDate && rootNode.PaymentTerms) {
    const terms = Array.isArray(rootNode.PaymentTerms) ? rootNode.PaymentTerms : [rootNode.PaymentTerms];
    for (const t of terms) {
      if (t.PaymentDueDate) {
        dueDate = String(t.PaymentDueDate).trim();
        break;
      }
    }
  }

  const rawCurrency = String(rootNode.DocumentCurrencyCode || "PEN").toUpperCase().trim();
  const currency: "PEN" | "USD" = rawCurrency === "USD" || rawCurrency === "DOL" ? "USD" : "PEN";

  // 3. Emisor (Supplier)
  const supplierParty = rootNode.AccountingSupplierParty?.Party || {};
  const supplierDocNumber = String(
    supplierParty.PartyIdentification?.ID?.["#text"] ||
      supplierParty.PartyIdentification?.ID ||
      ""
  ).trim();

  const supplierLegalName =
    supplierParty.PartyLegalEntity?.RegistrationName ||
    supplierParty.PartyName?.Name ||
    `PROVEEDOR RUC ${supplierDocNumber}`;

  const supplier = {
    docType: "6",
    docNumber: supplierDocNumber,
    businessName: String(supplierLegalName).trim(),
  };

  // 4. Receptor (Customer)
  const customerParty = rootNode.AccountingCustomerParty?.Party || {};
  const customerIdObj = customerParty.PartyIdentification?.ID;
  const customerDocNumber = String(customerIdObj?.["#text"] || customerIdObj || "").trim();
  const customerDocType = String(customerIdObj?.["@_schemeID"] || (customerDocNumber.length === 11 ? "6" : "1")).trim();

  const customerLegalName =
    customerParty.PartyLegalEntity?.RegistrationName ||
    customerParty.PartyName?.Name ||
    `CLIENTE ${customerDocNumber}`;

  const customer = {
    docType: customerDocType,
    docNumber: customerDocNumber,
    businessName: String(customerLegalName).trim(),
  };

  // 5. Desglose de Impuestos e Importes
  let baseAmountGravada = 0;
  let baseAmountInafecta = 0;
  let baseAmountExonerada = 0;
  let igvAmount = 0;
  let iscAmount = 0;
  let icbperAmount = 0;

  // Procesar TaxTotal
  if (rootNode.TaxTotal) {
    const taxTotals = Array.isArray(rootNode.TaxTotal) ? rootNode.TaxTotal : [rootNode.TaxTotal];

    for (const tt of taxTotals) {
      const subTotals = tt.TaxSubtotal
        ? Array.isArray(tt.TaxSubtotal)
          ? tt.TaxSubtotal
          : [tt.TaxSubtotal]
        : [];

      for (const st of subTotals) {
        const schemeId = String(st.TaxCategory?.TaxScheme?.ID || "").trim();
        const taxable = parseXmlDecimal(st.TaxableAmount);
        const taxAmt = parseXmlDecimal(st.TaxAmount);

        if (schemeId === "1000") {
          // IGV 18%
          baseAmountGravada += taxable;
          igvAmount += taxAmt;
        } else if (schemeId === "9998") {
          // Inafecto
          baseAmountInafecta += taxable;
        } else if (schemeId === "9997") {
          // Exonerado
          baseAmountExonerada += taxable;
        } else if (schemeId === "2000") {
          // ISC
          iscAmount += taxAmt;
        } else if (schemeId === "7152") {
          // ICBPER bolsas
          icbperAmount += taxAmt;
        }
      }
    }
  }

  // Importe Total
  let totalAmount = 0;
  if (rootNode.LegalMonetaryTotal) {
    totalAmount = parseXmlDecimal(rootNode.LegalMonetaryTotal.PayableAmount);
  } else if (rootNode.RequestedMonetaryTotal) {
    totalAmount = parseXmlDecimal(rootNode.RequestedMonetaryTotal.PayableAmount);
  }

  // Si no se extrajo base gravada pero hay total e IGV, desglosar matemáticamente
  if (baseAmountGravada === 0 && totalAmount > 0) {
    if (igvAmount > 0) {
      baseAmountGravada = Math.round((totalAmount - igvAmount) * 100) / 100;
    } else {
      baseAmountGravada = Math.round((totalAmount / 1.18) * 100) / 100;
      igvAmount = Math.round((totalAmount - baseAmountGravada) * 100) / 100;
    }
  }

  // 6. Extracción de Detracciones SPOT
  let detraction: ParsedInvoiceXml["detraction"] = undefined;
  if (rootNode.PaymentTerms) {
    const terms = Array.isArray(rootNode.PaymentTerms) ? rootNode.PaymentTerms : [rootNode.PaymentTerms];
    for (const t of terms) {
      const termId = String(t.ID || "").toLowerCase();
      if (termId.includes("detraccion") || t.PaymentMeansID) {
        detraction = {
          isSubject: true,
          spotCode: String(t.PaymentMeansID || "022").trim(),
          spotRate: parseXmlDecimal(t.PaymentPercent) || 12,
          detractionAmount: parseXmlDecimal(t.Amount),
        };
        break;
      }
    }
  }

  // 7. Referencias para Notas de Crédito / Débito
  let reference: ParsedInvoiceXml["reference"] = undefined;
  if (inferredDocType === "07" || inferredDocType === "08") {
    const disc = rootNode.DiscrepancyResponse;
    const invRef = rootNode.BillingReference?.InvoiceDocumentReference;

    const refId = String(disc?.ReferenceID || invRef?.ID || "").trim();
    if (refId) {
      const parts = refId.split("-");
      reference = {
        docType: String(invRef?.DocumentTypeCode || "01").trim(),
        docSeries: parts[0] || "",
        docNumber: parts[1] || "",
        reasonCode: String(disc?.ResponseCode || "").trim(),
        reasonDescription: String(disc?.Description || "").trim(),
      };
    }
  }

  // 8. Clasificar Operación (Compra vs Venta)
  let classifiedAs: ParsedInvoiceXml["classifiedAs"] = "UNKNOWN";
  if (activeCompanyRuc) {
    const cleanActive = activeCompanyRuc.trim();
    if (supplier.docNumber === cleanActive) {
      classifiedAs = "SALE"; // Si el emisor es la empresa activa, es una Venta
    } else if (customer.docNumber === cleanActive) {
      classifiedAs = "PURCHASE"; // Si el receptor es la empresa activa, es una Compra
    }
  }

  return {
    docType: inferredDocType,
    docSeries,
    docNumber,
    fullDocNumber: rawId,
    issueDate,
    dueDate,
    currency,
    supplier,
    customer,
    amounts: {
      baseAmountGravada,
      baseAmountInafecta,
      baseAmountExonerada,
      igvAmount,
      iscAmount,
      icbperAmount,
      otherTaxes: 0,
      totalAmount,
    },
    detraction,
    reference,
    classifiedAs,
    rawXmlLength: xmlContent.length,
  };
}

function parseXmlDecimal(val: any): number {
  if (val === undefined || val === null) return 0;
  const raw = typeof val === "object" ? val["#text"] || val : val;
  const str = String(raw).trim().replace(/,/g, ".");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}
