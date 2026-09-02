/**
 * Feriados de Costa Rica (**RF-20 · RF-21 · RF-22**, A117).
 *
 * Acá lo que puede salir mal no es el cálculo: **es la lista**. Y una lista de
 * feriados equivocada no falla ruidosamente — falla en la planilla de alguien,
 * meses después, sin que nada avise.
 *
 * Las cinco formas de equivocarla, todas comprobadas contra la fuente antes de
 * escribir el módulo:
 *
 *  1. **Dejar el 12 de octubre.** Dejó de ser feriado con la Ley 9803 (2020) y
 *     lo reemplazó el 1.º de diciembre. Todavía hay páginas que lo listan, así
 *     que la prueba lo fija por su ausencia.
 *  2. **Olvidar el 31 de agosto**, que se agregó después y cae en un mes con
 *     mucha actividad.
 *  3. **Mover Semana Santa mal**: es lo único que cambia de fecha entre años.
 *  4. **Trasladar a lunes.** La reforma caducó en 2024; hay un proyecto para
 *     reinstaurarla. Hoy cada feriado va en su fecha exacta, y si eso cambia
 *     tiene que cambiar el dato, no aparecer solo.
 *  5. **Que un año sin datos se vea igual que un año sin feriados.** En enero de
 *     2028 la pantalla diría en silencio que no hay ninguno.
 */
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import {
  ANIOS_CUBIERTOS,
  anioCubierto,
  feriadoDe,
  feriadosDelAnio,
} from "../../convex/bi/lib/feriados";

const convexModules = Object.fromEntries(
  Object.entries(import.meta.glob("../../convex/**/*.ts")).filter(
    ([path]) => !path.includes(".test.ts"),
  ),
);

const dia = (iso: string) => Date.parse(`${iso}T10:00:00-06:00`);

function revision(over: Record<string, unknown> = {}) {
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

async function montar(revisiones: Array<Record<string, unknown>> = []) {
  const t = convexTest(schema, convexModules);
  await t.run(async (ctx) => {
    for (const r of revisiones)
      await ctx.db.insert("inspections", revision(r) as never);
  });
  return t;
}

/* ========================================================================== */

describe("la lista, que es lo que puede salir mal en silencio", () => {
  test("cada año tiene 9 de pago obligatorio y 3 de no obligatorio", async () => {
    for (const anio of ANIOS_CUBIERTOS) {
      const f = feriadosDelAnio(anio);
      const ob = f.filter((x) => x.tipo === "obligatorio").length;
      const no = f.filter((x) => x.tipo === "no_obligatorio").length;
      expect(`${anio}: ${ob}/${no}`).toBe(`${anio}: 9/3`);
    }
  });

  test("el 12 de octubre NO es feriado — lo derogó la Ley 9803", async () => {
    // La prueba que más vale de este archivo: es el error que se comete solo,
    // copiando una lista vieja de internet.
    for (const anio of ANIOS_CUBIERTOS) {
      expect(feriadoDe(`${anio}-10-12`)).toBeNull();
    }
  });

  test("el 1.º de diciembre lo reemplazó, y es de pago NO obligatorio", async () => {
    for (const anio of ANIOS_CUBIERTOS) {
      expect(feriadoDe(`${anio}-12-01`)?.tipo).toBe("no_obligatorio");
    }
  });

  test("el 31 de agosto existe y es de pago no obligatorio", async () => {
    for (const anio of ANIOS_CUBIERTOS) {
      const f = feriadoDe(`${anio}-08-31`);
      expect(f).not.toBeNull();
      expect(f?.tipo).toBe("no_obligatorio");
    }
  });

  test("los tres de pago no obligatorio son exactamente 2-ago, 31-ago y 1-dic", async () => {
    for (const anio of ANIOS_CUBIERTOS) {
      const noOb = feriadosDelAnio(anio)
        .filter((f) => f.tipo === "no_obligatorio")
        .map((f) => f.fecha.slice(5));
      expect(noOb.sort()).toEqual(["08-02", "08-31", "12-01"]);
    }
  });

  test("Semana Santa cambia de fecha cada año y son dos días seguidos", async () => {
    const esperado: Record<number, [string, string]> = {
      2025: ["2025-04-17", "2025-04-18"],
      2026: ["2026-04-02", "2026-04-03"],
      2027: ["2027-03-25", "2027-03-26"],
    };
    for (const anio of ANIOS_CUBIERTOS) {
      const santa = feriadosDelAnio(anio)
        .filter((f) => f.nombre.includes("Santo"))
        .map((f) => f.fecha);
      expect(santa).toEqual(esperado[anio]);
    }
  });

  test("ningún feriado se traslada: las fechas fijas caen donde dice la ley", async () => {
    // Si vuelve el traslado a lunes, esta prueba se cae y obliga a tocar el
    // dato en vez de dejar que la pantalla mienta.
    const fijos = ["01-01", "04-11", "05-01", "07-25", "08-02", "08-15", "08-31", "09-15", "12-01", "12-25"];
    for (const anio of ANIOS_CUBIERTOS) {
      for (const mmdd of fijos) {
        expect(feriadoDe(`${anio}-${mmdd}`)).not.toBeNull();
      }
    }
  });

  test("no hay fechas repetidas ni feriados fuera de su año", async () => {
    for (const anio of ANIOS_CUBIERTOS) {
      const fechas = feriadosDelAnio(anio).map((f) => f.fecha);
      expect(new Set(fechas).size).toBe(fechas.length);
      expect(fechas.every((f) => f.startsWith(String(anio)))).toBe(true);
    }
  });
});

describe("un año que la tabla no conoce se dice, no se muestra vacío", () => {
  test("`cubierto` avisa en vez de devolver un calendario en blanco", async () => {
    const t = await montar();
    const p = await t.query(internal.bi.feriados.feriados, { anio: 2035 });

    expect(p.cubierto).toBe(false);
    expect(p.delAnio).toHaveLength(0);
    // y ofrece los que sí conoce, para que la pantalla no quede sin salida
    expect(p.aniosCubiertos.length).toBeGreaterThan(0);
  });

  test("un año conocido viene cubierto y con sus doce", async () => {
    const t = await montar();
    const p = await t.query(internal.bi.feriados.feriados, { anio: 2026 });

    expect(p.cubierto).toBe(true);
    expect(p.delAnio).toHaveLength(12);
    expect(anioCubierto(2026)).toBe(true);
  });
});

describe("el cruce con las revisiones, que es lo que lo hace útil", () => {
  test("cuenta las revisiones que cayeron en un feriado obligatorio", async () => {
    // 25-jul-2026 es Anexión de Nicoya, de pago obligatorio. En PROD ese día se
    // hicieron 2 revisiones.
    const t = await montar([
      { inspectionStartAt: dia("2026-07-25") },
      { inspectionStartAt: dia("2026-07-25") },
      { inspectionStartAt: dia("2026-07-26") }, // el día siguiente NO cuenta
    ]);
    const p = await t.query(internal.bi.feriados.feriados, { anio: 2026 });
    const nicoya = p.delAnio.find((f) => f.fecha === "2026-07-25");

    expect(nicoya?.revisiones).toBe(2);
    expect(nicoya?.revisionesApp).toBe(2);
    expect(p.revisionesEnObligatorio).toBe(2);
    expect(p.revisionesEnNoObligatorio).toBe(0);
  });

  test("separa el obligatorio del que no lo es", async () => {
    const t = await montar([
      { inspectionStartAt: dia("2026-08-15") }, // Día de la Madre: obligatorio
      { inspectionStartAt: dia("2026-08-31") }, // Persona Negra: no obligatorio
    ]);
    const p = await t.query(internal.bi.feriados.feriados, { anio: 2026 });

    expect(p.revisionesEnObligatorio).toBe(1);
    expect(p.revisionesEnNoObligatorio).toBe(1);
  });

  test("el conteo mira TODOS los años, no solo el que se muestra", async () => {
    // Si contara solo el año en pantalla, el titular cambiaría al cambiar de
    // año y parecería que las revisiones en feriado desaparecieron.
    const t = await montar([
      { inspectionStartAt: dia("2025-05-01") },
      { inspectionStartAt: dia("2026-07-25") },
    ]);
    const p = await t.query(internal.bi.feriados.feriados, { anio: 2026 });

    expect(p.revisionesEnObligatorio).toBe(2);
  });

  test("el día de la semana sale bien en zona CR, sin correrse", async () => {
    const t = await montar();
    const p = await t.query(internal.bi.feriados.feriados, { anio: 2026 });
    const porFecha = new Map(p.delAnio.map((f) => [f.fecha, f.diaSemana]));

    // 25-jul-2026 fue sábado y 15-ago-2026 también: es lo que hace que la
    // pregunta «¿se trabajó?» tenga sentido en este negocio.
    expect(porFecha.get("2026-07-25")).toBe("sábado");
    expect(porFecha.get("2026-08-15")).toBe("sábado");
    expect(porFecha.get("2026-01-01")).toBe("jueves");
  });
});

describe("los próximos (RF-22)", () => {
  test("cuenta desde hoy y dice cuántos días faltan", async () => {
    const t = await montar();
    const p = await t.query(internal.bi.feriados.feriados, {
      ahoraMs: dia("2026-09-01"),
    });

    expect(p.proximos[0].fecha).toBe("2026-09-15");
    expect(p.proximos[0].faltanDias).toBe(14);
    expect(p.proximos[0].tipo).toBe("obligatorio");
  });

  test("el de hoy sigue apareciendo, con 0 días", async () => {
    // Que se apague justo el día que importa sería el peor momento.
    const t = await montar();
    const p = await t.query(internal.bi.feriados.feriados, {
      ahoraMs: dia("2026-09-15"),
    });

    expect(p.proximos[0].fecha).toBe("2026-09-15");
    expect(p.proximos[0].faltanDias).toBe(0);
  });

  test("en diciembre sigue de largo al año siguiente", async () => {
    // Un aviso que se apaga en el último mes del año es justo el que falta.
    const t = await montar();
    const p = await t.query(internal.bi.feriados.feriados, {
      ahoraMs: dia("2026-12-26"),
    });

    expect(p.proximos[0].fecha).toBe("2027-01-01");
    expect(p.proximos.length).toBeGreaterThan(1);
  });
});
