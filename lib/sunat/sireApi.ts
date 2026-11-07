// ==============================================================================
// ContablePro - Conexión API en Vivo para SUNAT SIRE (RCE y RVIE)
// Descarga directa de propuestas de compras y ventas vía API REST Oficial
// Normativa: R.S. N° 000112-2021/SUNAT y especificaciones técnicas del SIRE
// ==============================================================================

import { getSunatAccessToken, getSunatCredentials, isSunatConfigured } from "./auth";
import { SirePurchaseRecord, SireSaleRecord } from "./sire";

export interface SireDownloadResult<T> {
  success: boolean;
  source: "SUNAT_API" | "SIMULATION" | "OFFLINE_FALLBACK";
  period: string;
  records: T[];
  totalRecords: number;
  totalBase: number;
  totalIgv: number;
  totalAmount: number;
  message: string;
  error?: string;
}

/**
 * Normaliza el periodo a formato AAAAMM (ej: '202603').
 */
export function normalizePeriod(periodInput: string | number): string {
  const str = String(periodInput).replace(/[^0-9]/g, "");
  if (str.length === 6) return str;
  if (str.length === 7 && str.includes("-")) {
    const [y, m] = str.split("-");
    return `${y}${m.padStart(2, "0")}`;
  }
  return "202603";
}

/**
 * Retorna la URL base de servicios SIRE según el entorno configurado.
 */
function getSireBaseUrl(): string {
  const creds = getSunatCredentials();
  return creds.env === "production"
    ? "https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv/libros"
    : "https://api-sire-beta.sunat.gob.pe/v1/contribuyente/migeigv/libros";
}

/**
 * Descarga en tiempo real la Propuesta de Compras (RCE) desde SUNAT.
 * Si las credenciales no existen o SUNAT no responde, maneja el fallo limpiamente.
 */
export async function descargarPropuestaRCE(
  period: string | number,
  rucOverride?: string
): Promise<SireDownloadResult<SirePurchaseRecord>> {
  const cleanPeriod = normalizePeriod(period);
  const creds = getSunatCredentials();
  const targetRuc = rucOverride || creds.ruc || "10746979636";

  // Verificación previa de credenciales SOL
  if (!isSunatConfigured()) {
    return {
      success: false,
      source: "OFFLINE_FALLBACK",
      period: cleanPeriod,
      records: [],
      totalRecords: 0,
      totalBase: 0,
      totalIgv: 0,
      totalAmount: 0,
      message: "Credenciales SOL no configuradas o servicio SUNAT no disponible, usando modo manual/archivo",
      error: "Credenciales SOL no configuradas o servicio SUNAT no disponible, usando modo manual/archivo",
    };
  }

  // Obtener Token de Acceso OAuth 2.0
  const authRes = await getSunatAccessToken();
  if (!authRes.success || !authRes.token) {
    return {
      success: false,
      source: "OFFLINE_FALLBACK",
      period: cleanPeriod,
      records: [],
      totalRecords: 0,
      totalBase: 0,
      totalIgv: 0,
      totalAmount: 0,
      message: authRes.error || "Credenciales SOL no configuradas o servicio SUNAT no disponible, usando modo manual/archivo",
      error: authRes.error,
    };
  }

  // Invocar endpoint oficial de propuesta RCE
  const baseUrl = getSireBaseUrl();
  const endpoint = `${baseUrl}/rce/v1/${encodeURIComponent(targetRuc)}/periodos/${cleanPeriod}/propuesta/comprobantes?page=1&perPage=100`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s de espera máxima

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authRes.token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const rawText = await response.text();
      let errorResponse: unknown = rawText;
      try {
        errorResponse = JSON.parse(rawText);
      } catch {
        // mantener texto plano
      }

      console.error("[SUNAT ERROR]", {
        operation: "descargarPropuestaRCE",
        endpoint,
        status: response.status,
        statusText: response.statusText,
        errorResponse,
      });

      const errText =
        typeof errorResponse === "object" && errorResponse !== null
          ? JSON.stringify(errorResponse)
          : String(errorResponse);

      return {
        success: false,
        source: "OFFLINE_FALLBACK",
        period: cleanPeriod,
        records: [],
        totalRecords: 0,
        totalBase: 0,
        totalIgv: 0,
        totalAmount: 0,
        message: `[SUNAT HTTP ${response.status}] ${errText || "Error en servicio SIRE RCE"}`,
        error: `SUNAT respondió con código HTTP ${response.status}: ${errText}`,
      };
    }

    const data = await response.json();
    const rawItems: Record<string, unknown>[] = Array.isArray(data)
      ? data
      : Array.isArray(data.registros)
      ? data.registros
      : Array.isArray(data.comprobantes)
      ? data.comprobantes
      : Array.isArray(data.items)
      ? data.items
      : [];

    const records: SirePurchaseRecord[] = rawItems.map((item, idx) => {
      const base = Number(item.mtoBiGravada || item.baseImponible || 0);
      const igv = Number(item.mtoIgv || item.igv || 0);
      const total = Number(item.mtoTotalCdp || item.total || base + igv);
      const docSeries = String(item.numSerieCdp || item.serie || "F001");
      const docNum = String(item.numCdp || item.numero || String(idx + 1).padStart(8, "0"));

      return {
        carSunat: String(item.codCar || `${targetRuc}01${docSeries}${docNum}${cleanPeriod}`),
        period: cleanPeriod,
        supplierDocType: String(item.codTipoDocIdentidad || item.tipoDocIdentidad || "6"),
        supplierDocNumber: String(item.numDocEmisor || item.numRucEmisor || item.ruc || "20100047218"),
        supplierName: String(item.nomRazonSocialEmisor || item.razonSocial || "PROVEEDOR REGISTRADO SUNAT"),
        docType: String(item.codTipoCdp || item.tipoComprobante || "01"),
        docSeries,
        docNumber: docNum,
        issueDate: String(item.fecEmision || "2026-03-15"),
        dueDate: item.fecVencimiento ? String(item.fecVencimiento) : undefined,
        baseAmountGravada: base,
        igvAmount: igv,
        baseAmountNoGravada: Number(item.mtoBiNoGravada || 0),
        exoneratedAmount: Number(item.mtoExonerado || 0),
        iscAmount: Number(item.mtoIsc || 0),
        icbperAmount: Number(item.mtoIcbper || 0),
        otherTaxes: Number(item.mtoOtrosTributos || 0),
        totalAmount: total,
        currency: (item.codMoneda === "USD" ? "USD" : "PEN") as "PEN" | "USD",
        exchangeRate: Number(item.mtoTipoCambio || 3.755),
      };
    });

    const totalBase = records.reduce((acc, r) => acc + r.baseAmountGravada, 0);
    const totalIgv = records.reduce((acc, r) => acc + r.igvAmount, 0);
    const totalAmount = records.reduce((acc, r) => acc + r.totalAmount, 0);

    return {
      success: true,
      source: "SUNAT_API",
      period: cleanPeriod,
      records,
      totalRecords: records.length,
      totalBase,
      totalIgv,
      totalAmount,
      message: `Propuesta RCE sincronizada exitosamente con SUNAT (${records.length} comprobantes obtenidos).`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[SUNAT ERROR]", {
      operation: "descargarPropuestaRCE Exception",
      endpoint,
      error: errorMsg,
    });
    return {
      success: false,
      source: "OFFLINE_FALLBACK",
      period: cleanPeriod,
      records: [],
      totalRecords: 0,
      totalBase: 0,
      totalIgv: 0,
      totalAmount: 0,
      message: `Error de conexión con SUNAT: ${errorMsg}`,
      error: errorMsg,
    };
  }
}

/**
 * Descarga en tiempo real la Propuesta de Ventas (RVIE) desde SUNAT.
 */
export async function descargarPropuestaRVIE(
  period: string | number,
  rucOverride?: string
): Promise<SireDownloadResult<SireSaleRecord>> {
  const cleanPeriod = normalizePeriod(period);
  const creds = getSunatCredentials();
  const targetRuc = rucOverride || creds.ruc || "10746979636";

  // Verificación previa de credenciales SOL
  if (!isSunatConfigured()) {
    return {
      success: false,
      source: "OFFLINE_FALLBACK",
      period: cleanPeriod,
      records: [],
      totalRecords: 0,
      totalBase: 0,
      totalIgv: 0,
      totalAmount: 0,
      message: "Credenciales SOL no configuradas o servicio SUNAT no disponible, usando modo manual/archivo",
      error: "Credenciales SOL no configuradas o servicio SUNAT no disponible, usando modo manual/archivo",
    };
  }

  // Obtener Token de Acceso OAuth 2.0
  const authRes = await getSunatAccessToken();
  if (!authRes.success || !authRes.token) {
    return {
      success: false,
      source: "OFFLINE_FALLBACK",
      period: cleanPeriod,
      records: [],
      totalRecords: 0,
      totalBase: 0,
      totalIgv: 0,
      totalAmount: 0,
      message: authRes.error || "Credenciales SOL no configuradas o servicio SUNAT no disponible, usando modo manual/archivo",
      error: authRes.error,
    };
  }

  const baseUrl = getSireBaseUrl();
  const endpoint = `${baseUrl}/rvie/v1/${encodeURIComponent(targetRuc)}/periodos/${cleanPeriod}/propuesta/comprobantes?page=1&perPage=100`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authRes.token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const rawText = await response.text();
      let errorResponse: unknown = rawText;
      try {
        errorResponse = JSON.parse(rawText);
      } catch {
        // texto plano
      }

      console.error("[SUNAT ERROR]", {
        operation: "descargarPropuestaRVIE",
        endpoint,
        status: response.status,
        statusText: response.statusText,
        errorResponse,
      });

      const errText =
        typeof errorResponse === "object" && errorResponse !== null
          ? JSON.stringify(errorResponse)
          : String(errorResponse);

      return {
        success: false,
        source: "OFFLINE_FALLBACK",
        period: cleanPeriod,
        records: [],
        totalRecords: 0,
        totalBase: 0,
        totalIgv: 0,
        totalAmount: 0,
        message: `[SUNAT HTTP ${response.status}] ${errText || "Error en servicio SIRE RVIE"}`,
        error: `SUNAT respondió con código HTTP ${response.status}: ${errText}`,
      };
    }

    const data = await response.json();
    const rawItems: Record<string, unknown>[] = Array.isArray(data)
      ? data
      : Array.isArray(data.registros)
      ? data.registros
      : Array.isArray(data.comprobantes)
      ? data.comprobantes
      : Array.isArray(data.items)
      ? data.items
      : [];

    const records: SireSaleRecord[] = rawItems.map((item, idx) => {
      const base = Number(item.mtoBiGravada || item.baseImponible || 0);
      const igv = Number(item.mtoIgv || item.igv || 0);
      const total = Number(item.mtoTotalCdp || item.total || base + igv);
      const docSeries = String(item.numSerieCdp || item.serie || "F001");
      const docNum = String(item.numCdp || item.numero || String(idx + 1).padStart(8, "0"));

      return {
        carSunat: String(item.codCar || `${targetRuc}01${docSeries}${docNum}${cleanPeriod}`),
        period: cleanPeriod,
        clientDocType: String(item.codTipoDocIdentidad || item.tipoDocIdentidad || "6"),
        clientDocNumber: String(item.numDocAdquirente || item.numRucCliente || item.ruc || "20543210981"),
        clientName: String(item.nomRazonSocialAdquirente || item.razonSocial || "CLIENTE REGISTRADO SUNAT"),
        docType: String(item.codTipoCdp || item.tipoComprobante || "01"),
        docSeries,
        docNumber: docNum,
        issueDate: String(item.fecEmision || "2026-03-15"),
        dueDate: item.fecVencimiento ? String(item.fecVencimiento) : undefined,
        exportAmount: Number(item.mtoExportacion || 0),
        baseAmountGravada: base,
        discountBaseAmount: 0,
        igvAmount: igv,
        discountIgvAmount: 0,
        exoneratedAmount: Number(item.mtoExonerado || 0),
        inafectoAmount: Number(item.mtoInafecto || 0),
        iscAmount: Number(item.mtoIsc || 0),
        icbperAmount: Number(item.mtoIcbper || 0),
        otherTaxes: Number(item.mtoOtrosTributos || 0),
        totalAmount: total,
        currency: (item.codMoneda === "USD" ? "USD" : "PEN") as "PEN" | "USD",
        exchangeRate: Number(item.mtoTipoCambio || 3.755),
        state: 1,
      };
    });

    const totalBase = records.reduce((acc, r) => acc + r.baseAmountGravada, 0);
    const totalIgv = records.reduce((acc, r) => acc + r.igvAmount, 0);
    const totalAmount = records.reduce((acc, r) => acc + r.totalAmount, 0);

    return {
      success: true,
      source: "SUNAT_API",
      period: cleanPeriod,
      records,
      totalRecords: records.length,
      totalBase,
      totalIgv,
      totalAmount,
      message: `Propuesta RVIE sincronizada exitosamente con SUNAT (${records.length} comprobantes obtenidos).`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[SUNAT ERROR]", {
      operation: "descargarPropuestaRVIE Exception",
      endpoint,
      error: errorMsg,
    });
    return {
      success: false,
      source: "OFFLINE_FALLBACK",
      period: cleanPeriod,
      records: [],
      totalRecords: 0,
      totalBase: 0,
      totalIgv: 0,
      totalAmount: 0,
      message: `Error de conexión con SUNAT: ${errorMsg}`,
      error: errorMsg,
    };
  }
}
