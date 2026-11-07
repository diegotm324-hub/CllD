import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export const ACTIVE_COMPANY_COOKIE = "colld_active_company";

/**
 * Obtiene o asegura el usuario contador por defecto (admin@colld.pe)
 */
export async function getOrCreateDefaultUser() {
  let user = await prisma.user.findFirst({
    where: { email: "admin@colld.pe" },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "admin@colld.pe",
        name: "Contador Principal",
        password: "$2a$12$K1d0wz8t6mFzXyexamplehashforcolldauth", // bcrypt format
      },
    });
  }

  return user;
}

/**
 * Obtiene el ID de la empresa activa desde la Cookie colld_active_company
 * Si no existe o no es válida, selecciona la primera empresa del usuario y establece la cookie.
 */
export async function getActiveCompanyId(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;

  if (cookieVal) {
    const exists = await prisma.company.findUnique({
      where: { id: cookieVal },
      select: { id: true },
    });
    if (exists) return exists.id;
  }

  // Fallback: Buscar la primera empresa activa en base de datos
  const firstCompany = await prisma.company.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (firstCompany) {
    return firstCompany.id;
  }

  return null;
}
