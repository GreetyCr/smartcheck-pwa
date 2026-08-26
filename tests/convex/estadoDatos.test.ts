/**
 * Estado y frescura de los datos (RF-09 · RF-16).
 *
 * El requerimiento es «no mostrar datos viejos en silencio», así que lo que hay
 * que proteger es justamente el ruido y el silencio:
 *
 *  1. **Que un fallo del sync se vea.** Es la mitad de RF-16 que faltaba: la
 *     validación existía y no la mostraba nadie.
 *  2. **Que las cargas únicas NO cuenten como atrasadas.** Se hicieron en julio
 *     y no vuelven a correr; medirlas contra el reloj dejaría el aviso encendido
 *     para siempre, y un aviso siempre encendido no se lee.
 *  3. **Que el umbral no se dispare un domingo.** El cron corre los lunes: con
 *     siete días, un proceso sano daría alarma cada fin de semana.
 */
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { DIAS_PARA_ATRASO, PROCESOS } from "../../convex/bi/estadoDatos";

const convexModules = Object.fromEntries(
  Object.entries(import.meta.glob("../../convex/**/*.ts")).filter(
    ([path]) => !path.includes(".test.ts"),
  ),
);

const MS_DIA = 24 * 60 * 60 * 1000;
const haceDias = (d: number) => Date.now() - d * MS_DIA;

const sembrar = async (metas: Array<Record<string, unknown>>) => {
  const t = convexTest(schema, convexModules);
  await t.run(async (ctx) => {
    for (const m of metas) {
      await ctx.db.insert("bi_meta", {
        key: "leads_sync",
        lastRunAt: haceDias(1),
        lastStatus: "ok" as const,
        rowsProcessed: 9096,
        message: "full: fetched=9096 fail=0",
        ...m,
      } as never);
    }
  });
  return t;
};

const pedir = (t: ReturnType<typeof convexTest>) =>
  t.query(internal.bi.estadoDatos.estadoDatos, {});

const proc = (res: any, k: string) => res.procesos.find((p: any) => p.key === k);

/* ========================================================================== */

describe("un fallo del sync se ve", () => {
  test("`lastStatus` en error levanta la bandera", async () => {
    // La mitad de RF-16 que faltaba: la validación ya existía, la pantalla no.
    const t = await sembrar([
      { key: "leads_sync", lastStatus: "error", message: "airtable 500" },
    ]);
    const res = await pedir(t);

    expect(res.hayError).toBe(true);
    expect(proc(res, "leads_sync").message).toBe("airtable 500");
  });

  test("con todo en orden no hay bandera", async () => {
    const t = await sembrar([{ key: "leads_sync" }, { key: "matches_rebuild" }]);
    const res = await pedir(t);
    expect(res.hayError).toBe(false);
    expect(res.hayAtraso).toBe(false);
  });
});

describe("qué envejece y qué no", () => {
  test("una carga ÚNICA de hace un mes NO está atrasada", async () => {
    // `finance_migration` y `legacy_migration` corrieron en julio y no vuelven.
    // Si contaran, el aviso quedaría encendido para siempre y nadie lo leería.
    const t = await sembrar([
      { key: "finance_migration", lastRunAt: haceDias(31) },
      { key: "legacy_migration", lastRunAt: haceDias(31) },
    ]);
    const res = await pedir(t);

    expect(proc(res, "finance_migration").atrasado).toBe(false);
    expect(res.hayAtraso).toBe(false);
  });

  test("un proceso SEMANAL de hace un mes sí está atrasado", async () => {
    const t = await sembrar([{ key: "leads_sync", lastRunAt: haceDias(31) }]);
    const res = await pedir(t);

    expect(proc(res, "leads_sync").atrasado).toBe(true);
    expect(res.hayAtraso).toBe(true);
  });

  test("el umbral deja pasar el fin de semana", async () => {
    // El cron corre los lunes: un domingo por la noche un proceso sano lleva
    // seis días y pico. Con siete, alarma todos los domingos.
    expect(DIAS_PARA_ATRASO).toBeGreaterThan(7);

    const sano = await sembrar([{ key: "leads_sync", lastRunAt: haceDias(6.5) }]);
    expect(proc(await pedir(sano), "leads_sync").atrasado).toBe(false);

    const justo = await sembrar([{ key: "leads_sync", lastRunAt: haceDias(8.5) }]);
    expect(proc(await pedir(justo), "leads_sync").atrasado).toBe(true);
  });
});

describe("la última actualización", () => {
  test("una carga única RECIENTE no puede tapar un sync atrasado", async () => {
    // El caso que de verdad discrimina. Con la migración más VIEJA que el sync
    // —lo intuitivo de sembrar— el máximo de todos da igual que el máximo de
    // los periódicos, y la prueba no probaría nada. Hay que ponerla más nueva:
    // si contara, la pantalla diría «actualizado hoy» con el sync de hace 10
    // días, que es exactamente el «datos viejos en silencio» de RF-16.
    const t = await sembrar([
      { key: "leads_sync", lastRunAt: haceDias(10) },
      { key: "matches_rebuild", lastRunAt: haceDias(12) },
      { key: "finance_migration", lastRunAt: haceDias(0.1) },
    ]);
    const res = await pedir(t);

    expect(res.ultimaActualizacion).toBe(proc(res, "leads_sync").lastRunAt);
    expect(res.hayAtraso).toBe(true);
  });

  test("sin procesos periódicos devuelve null, no una fecha inventada", async () => {
    const t = await sembrar([{ key: "finance_migration", lastRunAt: haceDias(31) }]);
    expect((await pedir(t)).ultimaActualizacion).toBeNull();
  });
});

describe("un proceso que nadie declaró", () => {
  test("se trata como periódico y se reporta aparte", async () => {
    // Igual que en Calidad: el hueco tiene que ser ruidoso. Si se asumiera
    // «carga única», un proceso nuevo nunca daría aviso por más viejo que fuera.
    const t = await sembrar([{ key: "proceso_nuevo", lastRunAt: haceDias(30) }]);
    const res = await pedir(t);

    expect(res.sinDeclarar).toEqual(["proceso_nuevo"]);
    expect(proc(res, "proceso_nuevo").atrasado).toBe(true);
  });

  test("con todo declarado la lista viene vacía", async () => {
    const t = await sembrar([{ key: "leads_sync" }]);
    expect((await pedir(t)).sinDeclarar).toEqual([]);
  });
});

describe("presentación", () => {
  test("los periódicos van primero", async () => {
    const t = await sembrar([
      { key: "finance_migration", lastRunAt: haceDias(31) },
      { key: "leads_sync", lastRunAt: haceDias(2) },
    ]);
    expect((await pedir(t)).procesos[0].key).toBe("leads_sync");
  });

  test("cada proceso se explica en castellano", async () => {
    const t = await sembrar(
      Object.keys(PROCESOS).map((key) => ({ key, lastRunAt: haceDias(1) })),
    );
    for (const p of (await pedir(t)).procesos) {
      expect(p.etiqueta.length, p.key).toBeGreaterThan(0);
      expect(p.queEs.length, p.key).toBeGreaterThan(0);
      expect(p.etiqueta, p.key).not.toBe(p.key); // no el nombre técnico crudo
    }
  });

  test("sin datos no explota", async () => {
    const t = await sembrar([]);
    const res = await pedir(t);
    expect(res.procesos).toEqual([]);
    expect(res.ultimaActualizacion).toBeNull();
    expect(res.hayError).toBe(false);
  });
});
