import Decimal from "decimal.js";
import { Prisma } from "@prisma/client";

/**
 * Verifica si un valor es una instancia de Decimal (de Decimal.js o Prisma.Decimal)
 */
function isDecimalInstance(val: unknown): val is { toNumber: () => number } {
  if (!val || typeof val !== "object") return false;
  if (val instanceof Decimal) return true;
  if (val instanceof Prisma.Decimal) return true;
  // Fallback estructural para instancias provenientes de diferentes bundles o versiones
  const obj = val as Record<string, unknown>;
  return (
    typeof obj.toNumber === "function" &&
    ("d" in obj || "s" in obj || "e" in obj || "isDecimal" in obj)
  );
}

/**
 * Serializa recursivamente cualquier estructura de datos, convirtiendo
 * todas las instancias de Decimal (Prisma o Decimal.js) a tipos primitivos `number`.
 * Garantiza que los objetos enviados desde Server Components o Server Actions
 * a Client Components sean objetos planos serializables (JSON estándar).
 */
export function serializeDecimals<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (isDecimalInstance(data)) {
    return data.toNumber() as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => serializeDecimals(item)) as unknown as T;
  }

  if (typeof data === "object") {
    // Si es un objeto Date u otro objeto especial estándar nativo, mantenerlo intacto
    if (data instanceof Date || data instanceof RegExp) {
      return data;
    }

    const plainObject: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      plainObject[key] = serializeDecimals(value);
    }
    return plainObject as T;
  }

  return data;
}

export default serializeDecimals;
