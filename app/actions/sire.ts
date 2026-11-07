"use server";

// ==============================================================================
// ContablePro - Server Actions para Integración SUNAT SIRE en Vivo
// Manejo transaccional, autenticación OAuth 2.0 y serialización segura
// ==============================================================================

import { getSunatConfigStatus, isSunatConfigured, SunatConfigStatus } from "@/lib/sunat/auth";
import { descargarPropuestaRCE, descargarPropuestaRVIE, SireDownloadResult } from "@/lib/sunat/sireApi";
import { SirePurchaseRecord, SireSaleRecord, parseSirePurchasesFile, parseSireSalesFile } from "@/lib/sunat/sire";
import { serializeDecimals } from "@/lib/utils/serialize";

// Muestras oficiales para fallback demo cuando no hay conexión en vivo
const DEMO_RCE_RAW = `10746979636|CONTRIBUYENTE RUC 10746979636 (SCABCASH)|20260300|1074697963601F00100004520202603|15/03/2026|15/04/2026|01|F001||00004520||6|20100047218|DISTRIBUIDORA LIMA S.A.C.|1000.00|180.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|1180.00|PEN||||||||||||||||1|1|
10746979636|CONTRIBUYENTE RUC 10746979636 (SCABCASH)|20260300|1074697963601F00200008912202603|18/03/2026|18/04/2026|01|F002||00008912||6|20543210981|SERVICIOS Y LOGISTICA GLOBAL S.R.L.|2500.00|450.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|2950.00|PEN||||||||||||||||1|1|
10746979636|CONTRIBUYENTE RUC 10746979636 (SCABCASH)|20260300|1074697963603B00100001245202603|20/03/2026|20/03/2026|03|B001||00001245||1|45892134|COMERCIAL LOS ANDES|350.00|63.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|413.00|PEN||||||||||||||||1|1|`;

const DEMO_RVIE_RAW = `10746979636|CONTRIBUYENTE RUC 10746979636 (SCABCASH)|20260300|1074697963601F00100001234202603|10/03/2026||01|F001|00001234||6|20543210981|CLIENTE MAYORISTA S.A.C.|0.00|1500.00|0.00|270.00|0.00|0.00|0.00|0.00|0.00|0.00|1770.00|PEN|3.755|||||1|
10746979636|CONTRIBUYENTE RUC 10746979636 (SCABCASH)|20260300|1074697963603B00100000567202603|12/03/2026||03|B001|00000567||1|10458921|CLIENTE CONSUMIDOR FINAL|0.00|200.00|0.00|36.00|0.00|0.00|0.00|0.00|0.00|0.00|236.00|PEN|3.755|||||1|`;

/**
 * Consulta el estado de configuración y disponibilidad del servicio SUNAT.
 */
export async function getSunatStatusAction(): Promise<SunatConfigStatus> {
  const status = getSunatConfigStatus();
  return serializeDecimals(status);
}

export interface SyncSireParams {
  companyRuc: string;
  year: number;
  month: number;
  moduleType: "PURCHASES" | "SALES";
  forceDemoOnFailure?: boolean;
}

/**
 * Server Action para sincronizar en vivo la propuesta del SIRE con SUNAT.
 */
export async function syncSireProposalAction(params: SyncSireParams) {
  const { companyRuc, year, month, moduleType, forceDemoOnFailure } = params;
  const period = `${year}${String(month).padStart(2, "0")}`;

  if (moduleType === "PURCHASES") {
    const result = await descargarPropuestaRCE(period, companyRuc);

    // Si falló por falta de credenciales o timeout y se solicita fallback visual de prueba
    if (!result.success && forceDemoOnFailure) {
      const parsed = parseSirePurchasesFile(DEMO_RCE_RAW);
      const totalBase = parsed.records.reduce((acc, r) => acc + r.baseAmountGravada, 0);
      const totalIgv = parsed.records.reduce((acc, r) => acc + r.igvAmount, 0);
      const totalAmount = parsed.records.reduce((acc, r) => acc + r.totalAmount, 0);

      const demoResult: SireDownloadResult<SirePurchaseRecord> = {
        success: true,
        source: "SIMULATION",
        period,
        records: parsed.records,
        totalRecords: parsed.records.length,
        totalBase,
        totalIgv,
        totalAmount,
        message: "Modo Offline: Datos de prueba cargados automáticamente (Credenciales SUNAT no configuradas).",
      };
      return serializeDecimals(demoResult);
    }

    return serializeDecimals(result);
  } else {
    const result = await descargarPropuestaRVIE(period, companyRuc);

    if (!result.success && forceDemoOnFailure) {
      const parsed = parseSireSalesFile(DEMO_RVIE_RAW);
      const totalBase = parsed.records.reduce((acc, r) => acc + r.baseAmountGravada, 0);
      const totalIgv = parsed.records.reduce((acc, r) => acc + r.igvAmount, 0);
      const totalAmount = parsed.records.reduce((acc, r) => acc + r.totalAmount, 0);

      const demoResult: SireDownloadResult<SireSaleRecord> = {
        success: true,
        source: "SIMULATION",
        period,
        records: parsed.records,
        totalRecords: parsed.records.length,
        totalBase,
        totalIgv,
        totalAmount,
        message: "Modo Offline: Datos de prueba cargados automáticamente (Credenciales SUNAT no configuradas).",
      };
      return serializeDecimals(demoResult);
    }

    return serializeDecimals(result);
  }
}

export interface SaveSunatCredentialsInput {
  ruc: string;
  usuarioSol: string;
  claveSol: string;
}

/**
 * Server Action para verificar y conectar las credenciales SOL de la empresa.
 * Oculta la complejidad técnica de Client ID y Secret utilizando credenciales maestras.
 */
export async function testAndSaveSunatConnectionAction(input: SaveSunatCredentialsInput) {
  const cleanRuc = input.ruc.trim();
  const cleanUser = input.usuarioSol.trim().toUpperCase();
  const cleanPass = input.claveSol.trim();

  if (!cleanRuc || cleanRuc.length !== 11) {
    return serializeDecimals({
      success: false,
      message: "El RUC debe tener exactamente 11 dígitos numéricos.",
    });
  }

  if (!cleanUser || !cleanPass) {
    return serializeDecimals({
      success: false,
      message: "Por favor ingrese el Usuario SOL y la Contraseña.",
    });
  }

  const clientId = (process.env.SUNAT_CLIENT_ID || "66956367-6e49-4564-902b-c20d91c11130").trim();
  const clientSecret = (process.env.SUNAT_CLIENT_SECRET || "asOeicRMhGtKNQM2wOOSKw==").trim();

  const tokenEndpoint = `https://api-seguridad.sunat.gob.pe/v1/clientessol/${clientId}/oauth2/token/`;
  const formattedUsername = `${cleanRuc}${cleanUser}`;
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const bodyParams = new URLSearchParams();
  bodyParams.append("grant_type", "password");
  bodyParams.append("scope", "https://api.sunat.gob.pe/v1/contribuyente/migeigv");
  bodyParams.append("client_id", clientId);
  bodyParams.append("client_secret", clientSecret);
  bodyParams.append("username", formattedUsername);
  bodyParams.append("password", cleanPass);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: bodyParams.toString(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      process.env.SUNAT_RUC = cleanRuc;
      process.env.SUNAT_USUARIO_SOL = cleanUser;
      process.env.SUNAT_CLAVE_SOL = cleanPass;

      return serializeDecimals({
        success: true,
        message: "¡Conexión exitosa con SUNAT! Clave SOL verificada correctamente.",
      });
    }

    const rawError = await response.text();
    console.error("[SUNAT ERROR]", {
      step: "testAndSaveSunatConnectionAction",
      status: response.status,
      response: rawError,
    });

    return serializeDecimals({
      success: false,
      message:
        response.status === 400 || response.status === 401
          ? "Usuario SOL o Clave SOL incorrecta. Verifique sus datos en el portal SUNAT."
          : `SUNAT respondió con código HTTP ${response.status}. Intente nuevamente o use el modo manual Drag & Drop.`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[SUNAT ERROR]", {
      step: "testAndSaveSunatConnectionAction Exception",
      error: errorMsg,
    });
    return serializeDecimals({
      success: false,
      message: "No se pudo conectar con el servidor de SUNAT. Verifique su conexión o use el modo manual.",
    });
  }
}

