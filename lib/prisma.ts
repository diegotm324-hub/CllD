import { PrismaClient } from "@prisma/client";

// ==============================================================================
// ContablePro - Cliente Prisma Singleton optimizado para Vercel Serverless & Neon
// Evita agotamiento del Connection Pool reutilizando instancias en Lambdas activas
// ==============================================================================

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Persistir en globalThis tanto en desarrollo como en Serverless de producción
globalForPrisma.prisma = prisma;

export default prisma;
