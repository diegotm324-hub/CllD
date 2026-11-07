import { PrismaClient, PeriodStatus, AccountLevel, AccountNature, AccountCurrency, TaxRegime } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando Seed de ContablePro...");

  // 1. Empresa Principal vinculada a Clave SOL
  const solRuc = (process.env.SUNAT_RUC || "").trim() || "10746979636";
  const solUser = (process.env.SUNAT_USUARIO_SOL || "").trim() || "SCABCASH";
  const isJuridica = solRuc.startsWith("20");

  await prisma.company.updateMany({
    where: { ruc: { not: solRuc } },
    data: { isActive: false },
  });

  const company = await prisma.company.upsert({
    where: { ruc: solRuc },
    update: { isActive: true },
    create: {
      ruc: solRuc,
      businessName: isJuridica ? `EMPRESA RUC ${solRuc}` : `CONTRIBUYENTE RUC ${solRuc} (${solUser})`,
      tradeName: solUser,
      legalAddress: "DOMICILIO FISCAL DECLARADO ANTE SUNAT",
      taxRegime: isJuridica ? TaxRegime.MYPE_TRIBUTARIO : TaxRegime.ESPECIAL_RER,
      isSireObligated: true,
      isDetractionSubject: true,
      detractionAccount: "00-045-892147",
      phone: "(01) 640-9000",
      email: "contacto@contablepro.pe",
      isActive: true,
    },
  });
  console.log(`✅ Empresa configurada: ${company.businessName} (RUC: ${company.ruc})`);

  // 2. Periodo Fiscal 2026-11 (Noviembre 2026) en estado ABIERTO
  const period = await prisma.fiscalPeriod.upsert({
    where: {
      companyId_year_month: {
        companyId: company.id,
        year: 2026,
        month: 11,
      },
    },
    update: {
      status: PeriodStatus.ABIERTO,
    },
    create: {
      companyId: company.id,
      year: 2026,
      month: 11,
      status: PeriodStatus.ABIERTO,
    },
  });
  console.log(`✅ Periodo fiscal configurado: ${period.year}-${String(period.month).padStart(2, "0")} (${period.status})`);

  // 3. Subdiarios Estándar (Compras, Ventas, Diario, Bancos, Cierre)
  const subdiariosData = [
    { code: "01", name: "Apertura de Ejercicio", description: "Asiento inicial de apertura de balances" },
    { code: "05", name: "Libro Diario General", description: "Operaciones diversas y reclasificaciones" },
    { code: "11", name: "Registro de Compras", description: "Facturas, notas y comprobantes de proveedores (RCE)" },
    { code: "21", name: "Registro de Ventas e Ingresos", description: "Facturas, boletas emitidas a clientes (RVIE)" },
    { code: "31", name: "Caja y Bancos - Ingresos", description: "Cobranzas de facturas y depósitos" },
    { code: "34", name: "Caja y Bancos - Egresos", description: "Pagos a proveedores y detracciones" },
    { code: "35", name: "Cierre y Ajuste por TC", description: "Diferencia de cambio mensual y regularizaciones" },
  ];

  for (const sub of subdiariosData) {
    await prisma.subdiario.upsert({
      where: {
        companyId_code: {
          companyId: company.id,
          code: sub.code,
        },
      },
      update: { name: sub.name, description: sub.description },
      create: {
        companyId: company.id,
        code: sub.code,
        name: sub.name,
        description: sub.description,
      },
    });
  }
  console.log(`✅ ${subdiariosData.length} Subdiarios oficiales configurados.`);

  // 4. Plan Contable General Empresarial (PCGE) Base
  // Cuentas de destino y contrapartida primero
  const destDebit = await prisma.account.upsert({
    where: { companyId_code: { companyId: company.id, code: "94111" } },
    update: {},
    create: {
      companyId: company.id,
      code: "94111",
      name: "Gastos Administrativos",
      level: AccountLevel.SUBDIVISIONARIA,
      nature: AccountNature.DEUDORA,
      allowsMovement: true,
      requiresCostCenter: true,
    },
  });

  const destSales = await prisma.account.upsert({
    where: { companyId_code: { companyId: company.id, code: "95111" } },
    update: {},
    create: {
      companyId: company.id,
      code: "95111",
      name: "Gastos de Ventas",
      level: AccountLevel.SUBDIVISIONARIA,
      nature: AccountNature.DEUDORA,
      allowsMovement: true,
      requiresCostCenter: true,
    },
  });

  const destCredit = await prisma.account.upsert({
    where: { companyId_code: { companyId: company.id, code: "79111" } },
    update: {},
    create: {
      companyId: company.id,
      code: "79111",
      name: "Cargas Imputables a Cuentas de Costos y Gastos",
      level: AccountLevel.SUBDIVISIONARIA,
      nature: AccountNature.ACREEDORA,
      allowsMovement: true,
    },
  });

  // Demás cuentas maestras del PCGE
  const accountsMaster = [
    {
      code: "10111",
      name: "Caja Central M/N",
      level: AccountLevel.SUBDIVISIONARIA,
      nature: AccountNature.DEUDORA,
      currency: AccountCurrency.PEN,
      allowsMovement: true,
    },
    {
      code: "10411",
      name: "Cuentas Corrientes Operativas - PEN (BCP)",
      level: AccountLevel.SUBDIVISIONARIA,
      nature: AccountNature.DEUDORA,
      currency: AccountCurrency.PEN,
      allowsMovement: true,
    },
    {
      code: "10412",
      name: "Cuentas Corrientes Operativas - USD (BCP)",
      level: AccountLevel.SUBDIVISIONARIA,
      nature: AccountNature.DEUDORA,
      currency: AccountCurrency.USD,
      allowsMovement: true,
    },
    {
      code: "12121",
      name: "Facturas, Boletas por Cobrar - Emitidas en Cartera (PEN)",
      level: AccountLevel.SUBDIVISIONARIA,
      nature: AccountNature.DEUDORA,
      currency: AccountCurrency.PEN,
      allowsMovement: true,
      requiresEntity: true,
      requiresDocRef: true,
    },
    {
      code: "12122",
      name: "Facturas, Boletas por Cobrar - Emitidas en Cartera (USD)",
      level: AccountLevel.SUBDIVISIONARIA,
      nature: AccountNature.DEUDORA,
      currency: AccountCurrency.USD,
      allowsMovement: true,
      requiresEntity: true,
      requiresDocRef: true,
    },
    {
      code: "40111",
      name: "IGV - Cuenta Propia (18%)",
      level: AccountLevel.SUBDIVISIONARIA,
      nature: AccountNature.ACREEDORA,
      currency: AccountCurrency.PEN,
      allowsMovement: true,
    },
    {
      code: "42121",
      name: "Facturas por Pagar - Emitidas en Cartera (PEN)",
      level: AccountLevel.SUBDIVISIONARIA,
      nature: AccountNature.ACREEDORA,
      currency: AccountCurrency.PEN,
      allowsMovement: true,
      requiresEntity: true,
      requiresDocRef: true,
    },
    {
      code: "42122",
      name: "Facturas por Pagar - Emitidas en Cartera (USD)",
      level: AccountLevel.SUBDIVISIONARIA,
      nature: AccountNature.ACREEDORA,
      currency: AccountCurrency.USD,
      allowsMovement: true,
      requiresEntity: true,
      requiresDocRef: true,
    },
    {
      code: "60111",
      name: "Mercaderías Manufacturadas",
      level: AccountLevel.SUBDIVISIONARIA,
      nature: AccountNature.DEUDORA,
      currency: AccountCurrency.BOTH,
      allowsMovement: true,
      requiresCostCenter: true,
      hasAutomaticDestination: true,
      destinationDebitAccountId: destDebit.id,
      destinationCreditAccountId: destCredit.id,
    },
    {
      code: "63111",
      name: "Transporte de Carga",
      level: AccountLevel.SUBDIVISIONARIA,
      nature: AccountNature.DEUDORA,
      currency: AccountCurrency.BOTH,
      allowsMovement: true,
      requiresCostCenter: true,
      hasAutomaticDestination: true,
      destinationDebitAccountId: destDebit.id,
      destinationCreditAccountId: destCredit.id,
    },
    {
      code: "70121",
      name: "Venta de Mercaderías - Terceros",
      level: AccountLevel.SUBDIVISIONARIA,
      nature: AccountNature.ACREEDORA,
      currency: AccountCurrency.BOTH,
      allowsMovement: true,
      requiresDocRef: true,
    },
    {
      code: "67611",
      name: "Pérdida por Diferencia de Cambio",
      level: AccountLevel.SUBDIVISIONARIA,
      nature: AccountNature.DEUDORA,
      currency: AccountCurrency.PEN,
      allowsMovement: true,
    },
    {
      code: "77611",
      name: "Ganancia por Diferencia de Cambio",
      level: AccountLevel.SUBDIVISIONARIA,
      nature: AccountNature.ACREEDORA,
      currency: AccountCurrency.PEN,
      allowsMovement: true,
    },
  ];

  for (const acc of accountsMaster) {
    await prisma.account.upsert({
      where: {
        companyId_code: {
          companyId: company.id,
          code: acc.code,
        },
      },
      update: acc,
      create: {
        companyId: company.id,
        ...acc,
      },
    });
  }
  console.log(`✅ ${accountsMaster.length + 3} Cuentas del PCGE base configuradas con amarres automáticos.`);

  // 5. Centro de Costos Demo
  await prisma.costCenter.upsert({
    where: {
      companyId_code: {
        companyId: company.id,
        code: "ADM-01",
      },
    },
    update: {},
    create: {
      companyId: company.id,
      code: "ADM-01",
      name: "Administración General",
      description: "Gastos operativos administrativos de sede central",
    },
  });

  console.log("✨ Seed completado con éxito en ContablePro.");
}

main()
  .catch((e) => {
    console.error("❌ Error ejecutando Seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
