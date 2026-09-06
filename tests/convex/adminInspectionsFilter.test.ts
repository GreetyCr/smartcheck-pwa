/**
 * El filtro de estado de la tabla de Inspecciones del panel — A150.
 *
 * Existe porque la falla que arregla **no rompía nada**: `listAllInspections`
 * ensanchaba `synced` a `synced || report_delivered`, así que elegir «Ya subida»
 * devolvía filas cuya propia insignia decía «INFORME ENTREGADO». Medido en
 * producción el 6-set: 170 entregadas contra 2 subidas sin entregar, o sea que
 * el filtro devolvía 172 donde el rótulo prometía 2.
 *
 * Ninguna de las 661 pruebas lo vio, porque el ensanche era código deliberado y
 * consistente consigo mismo. Se fija acá para que un día no vuelva como
 * «unificar los dos filtros»: **las dos superficies tienen que diferir**, y por
 * eso se prueban las dos en el mismo archivo.
 */
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const convexModules = Object.fromEntries(
  Object.entries(import.meta.glob("../../convex/**/*.ts")).filter(
    ([path]) => !path.includes(".test.ts"),
  ),
);

const ADMIN = "user_test_filtro_admin";
const TECNICO = "user_test_filtro_tecnico";

/**
 * Siembra el reparto real de producción en miniatura: casi todo entregado y
 * apenas una subida sin entregar. Con dos y dos la prueba pasaría igual y no
 * mostraría por qué importa.
 */
async function setup() {
  const t = convexTest(schema, convexModules);
  await t.run(async (ctx) => {
    const now = Date.now();
    for (const [clerkId, role] of [
      [ADMIN, "admin"],
      [TECNICO, "tecnico"],
    ] as const) {
      await ctx.db.insert("users", {
        clerkId,
        email: `${clerkId}@example.com`,
        role,
        approvalStatus: "approved",
        createdAt: now,
        updatedAt: now,
      });
    }
    const estados = [
      ...Array<string>(5).fill("report_delivered"),
      "synced",
      "pending_sync",
      "draft",
    ];
    for (const [i, status] of estados.entries()) {
      await ctx.db.insert("inspections", {
        clerkUserId: TECNICO,
        clientId: `cliente-${i}`,
        clientName: `Cliente ${i}`,
        status: status as "synced",
      });
    }
  });
  return { asAdmin: t.withIdentity({ subject: ADMIN }), asTecnico: t.withIdentity({ subject: TECNICO }) };
}

describe("panel · listAllInspections", () => {
  test("«Ya subida» no devuelve las entregadas", async () => {
    const { asAdmin } = await setup();
    const { rows, totalMatched } = await asAdmin.query(
      api.admin.listAllInspections,
      { status: "synced" },
    );

    expect(rows).toHaveLength(1);
    expect(totalMatched).toBe(1);
    expect(rows.map((r) => r.inspection.status)).toEqual(["synced"]);
  });

  test("«Informe entregado» devuelve solo las entregadas", async () => {
    const { asAdmin } = await setup();
    const { rows } = await asAdmin.query(api.admin.listAllInspections, {
      status: "report_delivered",
    });

    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((r) => r.inspection.status))).toEqual(
      new Set(["report_delivered"]),
    );
  });

  test("las dos opciones no se solapan: juntas dan el total que llegó al servidor", async () => {
    // La razón de ser del arreglo. Si un día vuelven a solaparse, esta suma
    // pasa de 6 a 11 y la prueba lo dice.
    const { asAdmin } = await setup();
    const subidas = await asAdmin.query(api.admin.listAllInspections, {
      status: "synced",
    });
    const entregadas = await asAdmin.query(api.admin.listAllInspections, {
      status: "report_delivered",
    });

    expect(subidas.totalMatched + entregadas.totalMatched).toBe(6);
  });
});

describe("app del técnico · inspections.list", () => {
  test("«synced» SÍ incluye las entregadas, porque sus chips no las ofrecen aparte", async () => {
    // No es una inconsistencia: `InspectionFilters` no tiene «Informe
    // entregado», así que sin el ensanche las entregadas no saldrían en ningún
    // filtro del técnico.
    const { asTecnico } = await setup();
    const rows = await asTecnico.query(api.inspections.listByClerkUser, {
      status: "synced",
    });

    expect(rows).toHaveLength(6);
  });
});
