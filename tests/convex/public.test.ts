/**
 * QA de la superficie pública del BI (`bi/public.ts`).
 *
 * Estos wrappers existen por una sola razón: exponer al navegador un cálculo que
 * hasta ahora era `internal`. Así que lo que hay que proteger es exactamente eso:
 * (1) que **nadie sin rol admin** pueda leerlos —es el único gate entre un
 * técnico y el P&L de la empresa— y (2) que devuelvan **lo mismo** que la versión
 * internal, porque el día que se dupliquen los números empiezan a divergir en
 * silencio.
 */
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const convexModules = Object.fromEntries(
  Object.entries(import.meta.glob("../../convex/**/*.ts")).filter(
    ([path]) => !path.includes(".test.ts"),
  ),
);

const ADMIN = "user_pub_admin";
const TECNICO = "user_pub_tecnico";
const FECHA = Date.parse("2026-07-15T00:00:00-06:00");

async function setup() {
  const t = convexTest(schema, convexModules);
  await t.run(async (ctx) => {
    const now = Date.now();
    for (const [clerkId, role, email] of [
      [ADMIN, "admin", "a@example.com"],
      [TECNICO, "tecnico", "t@example.com"],
    ] as const) {
      await ctx.db.insert("users", {
        clerkId, email, role,
        approvalStatus: "approved",
        createdAt: now, updatedAt: now,
      });
    }
    // Algo de dato real para que los números no sean todos cero.
    await ctx.db.insert("finance_entries", {
      kind: "income", category: "inspeccion", isViatico: false,
      amountCRC: 64_000, originalCurrency: "CRC",
      date: FECHA, yearMonth: "2026-07", source: "sheet",
      isDeleted: false, createdAt: FECHA, updatedAt: FECHA,
    });
    await ctx.db.insert("inspections", {
      clientName: "Ana Fernández", clientPhone: "88887777",
      status: "report_delivered", reportDeliveredAt: FECHA,
      totalAmountCharged: 64_000,
    });
    await ctx.db.insert("leads_contacts", {
      dedupKey: "88887777", phone8: "88887777", phoneValid: true,
      leadStage: "nuevo", source: "airtable_migration", isDeleted: false,
      createdAt: FECHA, updatedAt: FECHA,
    });
  });
  return {
    t,
    asAdmin: t.withIdentity({ subject: ADMIN }),
    asTecnico: t.withIdentity({ subject: TECNICO }),
  };
}

/** Las siete puertas públicas, con sus argumentos mínimos. */
/**
 * **Todas** las queries públicas del BI, no una muestra.
 *
 * La lista se había quedado en 7 mientras el BI crecía a 15, así que ocho
 * quedaron sin nadie que verificara su gate — entre ellas `convertedLeads`, que
 * devuelve **nombre y teléfono** de los clientes de Esteban, y `leadsPorRevisar`,
 * que devuelve nombres y teléfonos crudos. Una lista incompleta de cosas que hay
 * que blindar se lee como completa, que es peor que no tenerla.
 *
 * Al agregar una query a `convex/bi/public.ts`, agregarla acá.
 */
const PUBLICAS = [
  ["financeSummary", api.bi.public.financeSummary, {}],
  ["totalRevisiones", api.bi.public.totalRevisiones, {}],
  ["executiveSummary", api.bi.public.executiveSummary, {}],
  ["reconciliation", api.bi.public.reconciliation, {}],
  ["conversionFunnel", api.bi.public.conversionFunnel, {}],
  ["matchesStats", api.bi.public.matchesStats, {}],
  ["leadsStats", api.bi.public.leadsStats, {}],
  // PII: nombre y teléfono de los clientes.
  ["convertedLeads", api.bi.public.convertedLeads, {}],
  ["leadsPorRevisar", api.bi.public.leadsPorRevisar, {}],
  ["expenseBreakdown", api.bi.public.expenseBreakdown, {}],
  ["channelRevenue", api.bi.public.channelRevenue, {}],
  ["pagosTecnico", api.bi.public.pagosTecnico, { yearMonth: "2026-08" }],
  ["calidad", api.bi.public.calidad, {}],
  ["estadoDatos", api.bi.public.estadoDatos, {}],
  ["operacion", api.bi.public.operacion, {}],
  ["filterOptions", api.bi.public.filterOptions, {}],
  ["contrasteHoja", api.bi.public.contrasteHoja, {}],
] as const;

describe("bi/public — el gate de admin", () => {
  test.each(PUBLICAS)("%s rechaza a un técnico", async (_n, fn, args) => {
    const { asTecnico } = await setup();
    await expect(asTecnico.query(fn, args as never)).rejects.toThrow();
  });

  test.each(PUBLICAS)("%s rechaza sin sesión", async (_n, fn, args) => {
    const { t } = await setup();
    await expect(t.query(fn, args as never)).rejects.toThrow();
  });

  test.each(PUBLICAS)("%s responde a un admin", async (_n, fn, args) => {
    const { asAdmin } = await setup();
    await expect(asAdmin.query(fn, args as never)).resolves.toBeDefined();
  });
});

describe("bi/public — mismo cálculo que la versión internal", () => {
  test("financeSummary", async () => {
    const { t, asAdmin } = await setup();
    expect(await asAdmin.query(api.bi.public.financeSummary, {})).toEqual(
      await t.query(internal.bi.metrics.financeSummary, {}),
    );
  });

  test("totalRevisiones", async () => {
    const { t, asAdmin } = await setup();
    expect(await asAdmin.query(api.bi.public.totalRevisiones, {})).toEqual(
      await t.query(internal.bi.metrics.totalRevisiones, {}),
    );
  });

  test("executiveSummary", async () => {
    const { t, asAdmin } = await setup();
    expect(await asAdmin.query(api.bi.public.executiveSummary, {})).toEqual(
      await t.query(internal.bi.metrics.executiveSummary, {}),
    );
  });

  test("reconciliation", async () => {
    const { t, asAdmin } = await setup();
    expect(await asAdmin.query(api.bi.public.reconciliation, {})).toEqual(
      await t.query(internal.bi.metrics.reconciliation, {}),
    );
  });

  test("conversionFunnel", async () => {
    const { t, asAdmin } = await setup();
    expect(await asAdmin.query(api.bi.public.conversionFunnel, {})).toEqual(
      await t.query(internal.bi.matches.conversionFunnel, {}),
    );
  });

  test("leadsStats", async () => {
    const { t, asAdmin } = await setup();
    expect(await asAdmin.query(api.bi.public.leadsStats, {})).toEqual(
      await t.query(internal.bi.leads.leadsStats, {}),
    );
  });
});

describe("A38 — refrescar el embudo bajo demanda", () => {
  test("refreshBiNow exige admin", async () => {
    const { asTecnico } = await setup();
    await expect(
      asTecnico.mutation(api.bi.leadsSync.refreshBiNow, {}),
    ).rejects.toThrow();
  });

  test("agenda el rebuild y devuelve enseguida", async () => {
    const { asAdmin } = await setup();
    // No bloquea esperando el recálculo: solo confirma que quedó agendado.
    expect(await asAdmin.mutation(api.bi.leadsSync.refreshBiNow, {})).toEqual({
      scheduled: true,
    });
  });
});
