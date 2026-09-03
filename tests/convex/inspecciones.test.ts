/**
 * Control de inspecciones realizadas (**A114**).
 *
 * Esta pantalla existe para que Esteban pueda **corroborar**: cuántas van, en
 * qué meses y quién las hizo. Eso pone el listón en un lugar incómodo — no
 * alcanza con que las cuentas den, tienen que dar **lo mismo que las otras
 * pantallas**, o el tablero se contradice consigo mismo y deja de servir para
 * lo único que se pidió.
 *
 * Las cuatro formas de romperlo, en orden de daño:
 *
 *  1. **Contar solo las de la app.** Es el defecto que originó el trabajo: la
 *     pantalla listaba 163 y no había forma de cruzarlas con las 904 de la
 *     portada ni con los convertidos de Leads.
 *  2. **Repartir las que no tienen técnico.** El CRM viejo nunca registró quién
 *     hizo la revisión. Sumarlas al que más tiene, o dejarlas fuera del total,
 *     son las dos maneras de mentir con el mismo dato.
 *  3. **Que los meses no sumen el total.** Un gráfico que no cuadra con su
 *     titular es peor que no tener gráfico.
 *  4. **Que el filtro mueva un lado y no el otro** — la lección de A113.
 */
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const convexModules = Object.fromEntries(
  Object.entries(import.meta.glob("../../convex/**/*.ts")).filter(
    ([path]) => !path.includes(".test.ts"),
  ),
);

const dia = (iso: string) => Date.parse(`${iso}T10:00:00-06:00`);

/** Revisión hecha en la app, con técnico. */
function app(over: Record<string, unknown> = {}) {
  return {
    clientName: "Ana León",
    clientPhone: "8888-7777",
    vehicleBrand: "Toyota",
    totalAmountCharged: 60_000,
    inspectionStartAt: dia("2026-07-10"),
    province: "san_jose",
    clerkUserId: "user_tecnico_a",
    ...over,
  };
}

/** Revisión del CRM viejo. No tiene ni puede tener técnico. */
function legacy(over: Record<string, unknown> = {}) {
  return {
    sourceRowId: `row-${Math.random()}`,
    inspectionDate: dia("2026-03-10"),
    clientName: "Carlos Mora",
    phone8: "70001111",
    vehicleBrand: "Hyundai",
    amountCRC: 50_000,
    originalCurrency: "CRC" as const,
    province: "cartago",
    ...over,
  };
}

async function montar(
  appRows: Array<Record<string, unknown>> = [],
  legacyRows: Array<Record<string, unknown>> = [],
  usuarios: Array<{ clerkId: string; name?: string; email?: string }> = [],
) {
  const t = convexTest(schema, convexModules);
  await t.run(async (ctx) => {
    for (const r of appRows) await ctx.db.insert("inspections", app(r) as never);
    for (const r of legacyRows)
      await ctx.db.insert("inspections_legacy", legacy(r) as never);
    for (const u of usuarios)
      await ctx.db.insert("users", {
        clerkId: u.clerkId,
        name: u.name,
        email: u.email ?? `${u.clerkId}@test.cr`,
        role: "tecnico",
        createdAt: dia("2026-01-01"),
        updatedAt: dia("2026-01-01"),
      } as never);
  });
  return t;
}

const panel = (t: ReturnType<typeof convexTest>, args = {}) =>
  t.query(internal.bi.inspecciones.inspecciones, args);

/* ========================================================================== */

describe("el total es el histórico completo, no solo las de la app", () => {
  test("suma las dos fuentes y dice de dónde sale cada una", async () => {
    const t = await montar([{}, {}], [{}, {}, {}]);
    const p = await panel(t);

    expect(p.total).toBe(5);
    expect(p.deLaApp).toBe(2);
    expect(p.delHistorico).toBe(3);
  });

  test("`totalHistorico` ignora los filtros: es el ancla contra la que se compara", async () => {
    const t = await montar([{}], [{}, {}]);
    const p = await panel(t, { fromMs: dia("2026-07-01") });

    expect(p.total).toBe(1); // solo la de julio
    expect(p.totalHistorico).toBe(3); // las tres, siempre
    expect(p.conFiltros).toBe(true);
  });

  test("sin filtros, `total` y `totalHistorico` son el mismo número", async () => {
    const t = await montar([{}], [{}, {}]);
    const p = await panel(t);

    expect(p.total).toBe(p.totalHistorico);
    expect(p.conFiltros).toBe(false);
  });
});

describe("las que no tienen técnico no se reparten ni se esconden", () => {
  test("las del CRM viejo van a su propio balde, no a un técnico", async () => {
    const t = await montar(
      [{}, {}],
      [{}, {}, {}],
      [{ clerkId: "user_tecnico_a", name: "Kevin" }],
    );
    const p = await panel(t);

    expect(p.sinTecnico).toBe(3);
    expect(p.atribuibles).toBe(2);
    // el único técnico se queda con lo suyo: no hereda las tres del histórico
    expect(p.porTecnico).toHaveLength(1);
    expect(p.porTecnico[0].rows).toBe(2);
  });

  test("atribuibles + sinTécnico = el total; nada se pierde por el camino", async () => {
    const t = await montar(
      [{}, { clerkUserId: "user_tecnico_b" }],
      [{}, {}],
      [
        { clerkId: "user_tecnico_a", name: "Kevin" },
        { clerkId: "user_tecnico_b", name: "Marco" },
      ],
    );
    const p = await panel(t);

    expect(p.atribuibles + p.sinTecnico).toBe(p.total);
    expect(p.porTecnico.reduce((s, x) => s + x.rows, 0)).toBe(p.atribuibles);
  });

  test("un técnico que ya no está en `users` sigue contando, con un nombre feo", async () => {
    // Sus revisiones ocurrieron. Borrarlas del conteo porque se borró la cuenta
    // movería el total; inventarle un nombre seria peor que enseñar el id.
    const t = await montar([{ clerkUserId: "user_borrado_xyz789" }], [], []);
    const p = await panel(t);

    expect(p.porTecnico).toHaveLength(1);
    expect(p.porTecnico[0].rows).toBe(1);
    expect(p.porTecnico[0].nombre).toContain("xyz789");
    expect(p.sinTecnico).toBe(0); // tiene técnico; lo que falta es el nombre
  });
});

describe("el desglose mensual cuadra con el titular", () => {
  test("los meses suman el total, y cada mes dice de dónde sale", async () => {
    const t = await montar(
      [{}, { inspectionStartAt: dia("2026-08-05") }],
      [{}, { inspectionDate: dia("2026-08-20") }],
    );
    const p = await panel(t);
    const suma = (f: (m: (typeof p.porMes)[number]) => number) =>
      p.porMes.reduce((s, m) => s + f(m), 0);

    expect(suma((m) => m.total)).toBe(p.total);
    expect(suma((m) => m.app)).toBe(p.deLaApp);
    expect(suma((m) => m.legacy)).toBe(p.delHistorico);
    expect(p.porMes.map((m) => m.yearMonth)).toEqual([
      "2026-03",
      "2026-07",
      "2026-08",
    ]);
  });

  test("la app sin `inspectionStartAt` cae en el mes de su creación, no desaparece", async () => {
    // 52 de las 164 filas de PROD están así. Si el mes se resolviera solo con
    // `inspectionStartAt`, un tercio del histórico de la app se esfumaría del
    // gráfico sin que nada avise.
    const t = await montar([{ inspectionStartAt: undefined }], []);
    const p = await panel(t);

    expect(p.total).toBe(1);
    expect(p.porMes.reduce((s, m) => s + m.total, 0)).toBe(1);
  });
});

describe("el filtro mueve los dos lados a la vez", () => {
  test("recorta el total, los meses y los técnicos con el mismo criterio", async () => {
    const t = await montar(
      [
        { inspectionStartAt: dia("2026-07-10") },
        { inspectionStartAt: dia("2026-02-10"), clerkUserId: "user_tecnico_b" },
      ],
      [{ inspectionDate: dia("2026-02-15") }],
      [
        { clerkId: "user_tecnico_a", name: "Kevin" },
        { clerkId: "user_tecnico_b", name: "Marco" },
      ],
    );
    const p = await panel(t, { fromMs: dia("2026-07-01") });

    expect(p.total).toBe(1);
    expect(p.porMes).toHaveLength(1);
    expect(p.porMes[0].yearMonth).toBe("2026-07");
    // Marco solo trabajó en febrero: fuera del periodo no debe aparecer con 0,
    // debe no aparecer.
    expect(p.porTecnico.map((x) => x.nombre)).toEqual(["Kevin"]);
    expect(p.sinTecnico).toBe(0);
  });

  test("filtrar por provincia también recorta a los técnicos", async () => {
    const t = await montar(
      [{}, { province: "heredia", clerkUserId: "user_tecnico_b" }],
      [],
      [
        { clerkId: "user_tecnico_a", name: "Kevin" },
        { clerkId: "user_tecnico_b", name: "Marco" },
      ],
    );
    const p = await panel(t, { province: "Heredia" });

    expect(p.total).toBe(1);
    expect(p.porTecnico).toHaveLength(1);
    expect(p.porTecnico[0].nombre).toBe("Marco");
  });
});

describe("primera y última revisión de cada técnico", () => {
  test("marcan el rango real, no el del periodo", async () => {
    const t = await montar(
      [
        { inspectionStartAt: dia("2026-05-02") },
        { inspectionStartAt: dia("2026-08-20") },
        { inspectionStartAt: dia("2026-06-15") },
      ],
      [],
      [{ clerkId: "user_tecnico_a", name: "Kevin" }],
    );
    const p = await panel(t);

    expect(p.porTecnico[0].primeraMs).toBe(dia("2026-05-02"));
    expect(p.porTecnico[0].ultimaMs).toBe(dia("2026-08-20"));
    expect(p.porTecnico[0].porMes.map((m) => m.yearMonth)).toEqual([
      "2026-05",
      "2026-06",
      "2026-08",
    ]);
  });
});

describe("cuadra con el resto del tablero", () => {
  test("el total es exactamente el de `totalRevisiones`: mismo cálculo, no coincidencia", async () => {
    // Es la razón de ser de la pantalla. Si estos dos números se separan, la
    // corroboración que pidió Esteban deja de ser posible.
    const t = await montar(
      [{}, { inspectionStartAt: dia("2026-08-05") }],
      [{}, {}, {}],
    );
    const p = await panel(t);
    const rev = await t.query(internal.bi.metrics.totalRevisiones, {});

    expect(p.total).toBe(rev.total);
    expect(p.totalHistorico).toBe(rev.total);
  });

  test("y sigue cuadrando con un filtro puesto", async () => {
    const t = await montar([{}], [{}, {}]);
    const args = { fromMs: dia("2026-07-01") };
    const p = await panel(t, args);
    const rev = await t.query(internal.bi.metrics.totalRevisiones, args);

    expect(p.total).toBe(rev.total);
  });
});

/* ========================================================================== */
/* El rol de quien hizo la revisión (A127)                                    */
/* ========================================================================== */

describe("no toda revisión de la app la hace un técnico", () => {
  /**
   * En PROD, **62 de las 165** las hizo Esteban desde su cuenta de admin. La
   * tarjeta las listaba junto a las del técnico, sin distinguir — y la regla de
   * pago dice lo contrario de lo que eso sugiere: las del dueño **no generan
   * viático ni comisión** (B36). Sin el rol, el reparto se lee como una
   * comparación de productividad entre dos técnicos, y no lo es.
   */
  test("devuelve el rol de cada uno, no solo el nombre", async () => {
    const t = await montar(
      [{ clerkUserId: "user_admin" }, { clerkUserId: "user_tec" }],
      [],
      [
        { clerkId: "user_tec", name: "Sergio" },
        { clerkId: "user_admin", name: "Esteban" },
      ],
    );
    await t.run(async (ctx) => {
      const u = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("clerkId"), "user_admin"))
        .unique();
      await ctx.db.patch(u!._id, { role: "admin" });
    });
    const p = await panel(t);
    const porNombre = new Map(p.porTecnico.map((x) => [x.nombre, x.rol]));

    expect(porNombre.get("Esteban")).toBe("admin");
    expect(porNombre.get("Sergio")).toBe("tecnico");
  });

  test("una cuenta borrada no se queda sin rol: dice «desconocido»", async () => {
    // Sus revisiones ocurrieron; inventarle un rol sería peor que decir que no
    // se sabe.
    const t = await montar([{ clerkUserId: "user_fantasma" }], [], []);
    const p = await panel(t);

    expect(p.porTecnico[0].rol).toBe("desconocido");
  });
});
