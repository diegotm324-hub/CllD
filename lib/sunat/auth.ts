// ==============================================================================
// ContablePro - Cliente de Autenticación Oficial OAuth 2.0 SUNAT (Clave SOL)
// Gestión y ciclo de vida de tokens para servicios SIRE (RCE / RVIE)
// Normativa: R.S. N° 000112-2021/SUNAT y guías de integración de API SUNAT
// ==============================================================================

export interface SunatTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface SunatAuthResult {
  success: boolean;
  token: string | null;
  fromCache?: boolean;
  expiresIn?: number;
  error?: string;
}

export interface SunatConfigStatus {
  isConfigured: boolean;
  env: "beta" | "production";
  ruc: string;
  username: string;
  message: string;
}

interface SunatTokenCache {
  accessToken: string;
  tokenType: string;
  expiresAt: number; // Milisegundos Unix epoch
  env: string;
  clientId: string;
}

// Almacenamiento en memoria para reuso eficiente del token activo
let memoryTokenCache: SunatTokenCache | null = null;

function cleanEnv(val?: string): string {
  if (!val) return "";
  return val.trim().replace(/^["']|["']$/g, "").trim();
}

/**
 * Obtiene la configuración de credenciales SOL desde las variables de entorno.
 */
export function getSunatCredentials() {
  const clientId = cleanEnv(process.env.SUNAT_CLIENT_ID);
  const clientSecret = cleanEnv(process.env.SUNAT_CLIENT_SECRET);
  const ruc = cleanEnv(process.env.SUNAT_RUC) || "10746979636";
  const usuarioSol = cleanEnv(process.env.SUNAT_USUARIO_SOL);
  const claveSol = cleanEnv(process.env.SUNAT_CLAVE_SOL);
  const env = cleanEnv(process.env.SUNAT_ENV).toLowerCase() === "production" ? "production" : "beta";

  return {
    clientId,
    clientSecret,
    ruc,
    usuarioSol,
    claveSol,
    env: env as "beta" | "production",
  };
}

/**
 * Verifica si las variables de entorno de SUNAT están configuradas con valores válidos (no vacíos ni de ejemplo).
 */
export function isSunatConfigured(): boolean {
  const { clientId, clientSecret, usuarioSol, claveSol } = getSunatCredentials();

  if (!clientId || !clientSecret || !usuarioSol || !claveSol) {
    return false;
  }

  // Descartar placeholders comunes de plantillas
  const placeholders = ["your_sunat_client_id_here", "your_sunat_client_secret_here", "xxx", "demo"];
  if (placeholders.includes(clientId.toLowerCase()) || placeholders.includes(clientSecret.toLowerCase())) {
    return false;
  }

  return true;
}

/**
 * Retorna el estado actual de conexión y configuración para el frontend/UI.
 */
export function getSunatConfigStatus(): SunatConfigStatus {
  const creds = getSunatCredentials();
  const configured = isSunatConfigured();

  if (!configured) {
    return {
      isConfigured: false,
      env: creds.env,
      ruc: creds.ruc,
      username: creds.usuarioSol,
      message: "Credenciales SOL no configuradas o incompletas en variables de entorno.",
    };
  }

  return {
    isConfigured: true,
    env: creds.env,
    ruc: creds.ruc,
    username: creds.usuarioSol,
    message: `Configurado en entorno ${creds.env.toUpperCase()} para RUC ${creds.ruc}.`,
  };
}

/**
 * Limpia la caché en memoria del token OAuth 2.0.
 */
export function clearSunatTokenCache(): void {
  memoryTokenCache = null;
}

/**
 * Obtiene un Access Token válido de SUNAT mediante flujo OAuth 2.0 password grant.
 * Reutiliza el token de memoria mientras no haya expirado (con margen de seguridad de 60s).
 */
export async function getSunatAccessToken(forceRefresh = false): Promise<SunatAuthResult> {
  const creds = getSunatCredentials();

  if (!isSunatConfigured()) {
    return {
      success: false,
      token: null,
      error: "Credenciales SOL no configuradas o servicio SUNAT no disponible, usando modo manual/archivo",
    };
  }

  // 1. Revisar caché en memoria
  const now = Date.now();
  const safetyMarginMs = 60 * 1000; // 60 segundos antes de expirar

  if (
    !forceRefresh &&
    memoryTokenCache &&
    memoryTokenCache.env === creds.env &&
    memoryTokenCache.clientId === creds.clientId &&
    memoryTokenCache.expiresAt > now + safetyMarginMs
  ) {
    return {
      success: true,
      token: memoryTokenCache.accessToken,
      fromCache: true,
      expiresIn: Math.floor((memoryTokenCache.expiresAt - now) / 1000),
    };
  }

  // 2. Formato estricto exigido por SUNAT en OAuth 2.0
  const tokenEndpoint = `https://api-seguridad.sunat.gob.pe/v1/clientessol/${creds.clientId}/oauth2/token/`;
  const formattedUsername = `${creds.ruc}${creds.usuarioSol}`;
  const basicAuth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");

  const bodyParams = new URLSearchParams();
  bodyParams.append("grant_type", "password");
  bodyParams.append("scope", "https://api.sunat.gob.pe/v1/contribuyente/migeigv");
  bodyParams.append("client_id", creds.clientId);
  bodyParams.append("client_secret", creds.clientSecret);
  bodyParams.append("username", formattedUsername);
  bodyParams.append("password", creds.claveSol);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

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

    if (!response.ok) {
      const rawText = await response.text();
      let errorResponse: unknown = rawText;
      try {
        errorResponse = JSON.parse(rawText);
      } catch {
        // mantener texto plano
      }

      // Log de diagnóstico con formato solicitado para inspección directa en terminal
      console.error("[SUNAT ERROR]", {
        step: "OAuth 2.0 Token Request",
        endpoint: tokenEndpoint,
        status: response.status,
        statusText: response.statusText,
        errorResponse,
      });

      const errorMsg =
        typeof errorResponse === "object" && errorResponse !== null
          ? (errorResponse as any).error_description ||
            (errorResponse as any).error ||
            (errorResponse as any).message ||
            JSON.stringify(errorResponse)
          : String(errorResponse);

      return {
        success: false,
        token: null,
        error: `[SUNAT HTTP ${response.status}] ${errorMsg}`,
      };
    }

    const data = (await response.json()) as SunatTokenResponse;
    const expiresIn = data.expires_in || 3600;

    // Guardar en caché en memoria
    memoryTokenCache = {
      accessToken: data.access_token,
      tokenType: data.token_type || "bearer",
      expiresAt: now + expiresIn * 1000,
      env: creds.env,
      clientId: creds.clientId,
    };

    return {
      success: true,
      token: data.access_token,
      fromCache: false,
      expiresIn,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[SUNAT ERROR]", {
      step: "OAuth 2.0 Network/Exception",
      endpoint: tokenEndpoint,
      error: errorMessage,
    });

    return {
      success: false,
      token: null,
      error: `Error de conexión con servidor SUNAT: ${errorMessage}`,
    };
  }
}
