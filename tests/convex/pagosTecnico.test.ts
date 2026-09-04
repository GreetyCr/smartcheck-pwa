/**
 * Viáticos y comisión del técnico (B36).
 *
 * Las tres cosas que este cálculo puede equivocar, y lo que cuesta cada una:
 *
 *  1. **Contar revisiones que no son del técnico.** Esteban también hace
 *     revisiones. Si entraran, julio pasaría de 33 a 46 y le pagaría de más
 *     todos los meses.
 *  2. **Cortar el mes por el calendario y no por la semana.** Los días 1, 2 y 3
 *     de julio pertenecen a la semana que arrancó el 29 de junio, así que son de
 *     junio. Cortarlos mal mueve revisiones entre meses.
 *  3. **Arrancar la comisión en la revisión equivocada.** Son ₡3.800 desde la
 *     46: empezar en la 45 le suma ₡3.800 al mes por error de uno.
 */
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import {
  calcularPago,
  PRIMER_MES_CONFIABLE,
} from "../../convex/bi/pagosTecnico";
import { lunesDeLaSemana, mesDePagoSemanal } from "../../convex/bi/lib/dates";

const convexModules = Object.fromEntries(
  Object.entries(import.meta.glob("../../convex/**/*.ts")).filter(
    ([path]) => !path.includes(".test.ts"),
  ),
);

const SERGIO = "user_sergio";
const ESTEBAN = "user_esteban";
/** Hora del día irrelevante salvo en los bordes, que se prueban aparte. */
const en = (iso: string, hora = "10:00") => Date.parse(`${iso}T${hora}:00-06:00`);

async function setup(
  revisiones: Array<{ iso: string; hora?: string; user?: string }>,
) {
  const t = convexTest(schema, convexModules);
  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("users", {
      clerkId: SERGIO, email: "sergio@x.com", name: "Sergio Smartcheck",
      role: "tecnico", approvalStatus: "approved", createdAt: now, updatedAt: now,
    });
    await ctx.db.insert("users", {
      clerkId: ESTEBAN, email: "esteban@x.com", name: "Smart Check",
      role: "admin", approvalStatus: "approved", createdAt: now, updatedAt: now,
    });
    for (const r of revisiones) {
      await ctx.db.insert("inspections", {
        clerkUserId: r.user ?? SERGIO,
        inspectionStartAt: en(r.iso, r.hora),
      } as never);
    }
  });
  return t;
}

const pedir = (t: ReturnType<typeof convexTest>, yearMonth: string) =>
  t.query(internal.bi.pagosTecnico.pagosTecnico, { yearMonth });

const sergio = (res: any) => res.tecnicos.find((x: any) => x.clerkId === SERGIO);

/* ========================================================================== */

describe("la tarifa", () => {
  test("las primeras 45 no llevan comisión; la 46 sí", () => {
    // El error de uno más caro del cálculo: son ₡3.800 de diferencia.
    expect(calcularPago(45).comisionCRC).toBe(0);
    expect(calcularPago(46).comisionCRC).toBe(3_800);
    expect(calcularPago(46).revisionesConComision).toBe(1);
  });

  test("reproduce julio de Esteban al colón", () => {
    // Su conteo fue 64 y pagó ₡72.200. Es la única validación externa que hay.
    expect(calcularPago(64).comisionCRC).toBe(72_200);
  });

  test("el viático va desde la primera, no desde la 46", () => {
    expect(calcularPago(1).viaticosCRC).toBe(2_000);
    expect(calcularPago(12).viaticosCRC).toBe(24_000); // una semana real de julio
  });

  test("en cero no da negativos", () => {
    expect(calcularPago(0)).toEqual({
      viaticosCRC: 0, comisionCRC: 0, revisionesConComision: 0,
    });
  });
});

describe("la semana manda sobre el calendario", () => {
  test("el lunes de la semana se calcula en hora de Costa Rica", () => {
    // Domingo 5-jul a las 19:00 CR es lunes 6 en UTC. Si se usara la zona del
    // proceso, esta revisión saltaría de semana — y de mes, si el domingo cae
    // a fin de mes.
    expect(lunesDeLaSemana(en("2026-07-05", "19:00"))).toBe("2026-06-29");
    expect(lunesDeLaSemana(en("2026-07-06", "00:30"))).toBe("2026-07-06");
  });

  test("los días 1, 2 y 3 de julio le tocan a JUNIO", () => {
    // Es el hallazgo de Esteban: «hay 3 días que no se están contabilizando».
    for (const d of ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04"]) {
      expect(mesDePagoSemanal(en(d)), d).toBe("2026-06");
    }
    expect(mesDePagoSemanal(en("2026-07-06"))).toBe("2026-07");
  });

  test("una semana que cruza el fin de mes cuenta entera en el mes que arrancó", async () => {
    const t = await setup([
      { iso: "2026-07-30" }, { iso: "2026-07-31" },
      { iso: "2026-08-01" }, { iso: "2026-08-02" }, // sábado y domingo
    ]);
    // La semana arrancó el lunes 27 de julio: las cuatro son de julio.
    expect(sergio(await pedir(t, "2026-07")).revisiones).toBe(4);
    expect(sergio(await pedir(t, "2026-08")).revisiones).toBe(0);
  });
});

describe("solo cuentan las revisiones del técnico", () => {
  test("las de Esteban no le generan viático ni comisión a nadie", async () => {
    // Es la mitad del problema que este cálculo resuelve.
    const t = await setup([
      { iso: "2026-08-04" }, { iso: "2026-08-05" },
      { iso: "2026-08-06", user: ESTEBAN }, { iso: "2026-08-07", user: ESTEBAN },
    ]);
    const res = await pedir(t, "2026-08");

    expect(sergio(res).revisiones).toBe(2);
    expect(res.revisionesDeOtros).toBe(2);
    expect(res.viaticosTotalCRC).toBe(4_000);
  });

  test("una revisión sin usuario tampoco se le asigna a nadie", async () => {
    const t = await setup([{ iso: "2026-08-04" }]);
    await t.run(async (ctx) => {
      await ctx.db.insert("inspections", {
        inspectionStartAt: en("2026-08-05"),
      } as never);
    });
    const res = await pedir(t, "2026-08");
    expect(sergio(res).revisiones).toBe(1);
    expect(res.revisionesDeOtros).toBe(1);
  });

  test("solo entran los usuarios con rol técnico", async () => {
    const t = await setup([{ iso: "2026-08-04", user: ESTEBAN }]);
    const res = await pedir(t, "2026-08");
    expect(res.tecnicos.map((x: any) => x.clerkId)).toEqual([SERGIO]);
    expect(res.tecnicos[0].revisiones).toBe(0);
  });
});

describe("el desglose por semana", () => {
  test("cada semana trae su conteo y su viático, ordenadas", async () => {
    // Es lo que le permite a Esteban contrastar contra lo que ya pagó por tanda.
    const t = await setup([
      { iso: "2026-08-04" }, { iso: "2026-08-05" }, { iso: "2026-08-06" },
      { iso: "2026-08-11" }, { iso: "2026-08-12" },
    ]);
    const s = sergio(await pedir(t, "2026-08"));

    expect(s.semanas).toEqual([
      { lunes: "2026-08-03", revisiones: 3, viaticosCRC: 6_000 },
      { lunes: "2026-08-10", revisiones: 2, viaticosCRC: 4_000 },
    ]);
    expect(s.semanas.reduce((a: number, w: any) => a + w.revisiones, 0)).toBe(
      s.revisiones,
    );
  });
});

describe("los meses en que el dato no alcanza", () => {
  test("antes de agosto-2026 se marca como no confiable, con el porqué", async () => {
    // Sergio empezó en la app el 16-jul y la plataforma vieja siguió hasta el
    // 19. Un número redondo y callado sería peor que ninguno.
    const t = await setup([{ iso: "2026-07-20" }]);
    const jul = await pedir(t, "2026-07");
    expect(jul.confiable).toBe(false);
    expect(jul.aviso).toMatch(/16-jul/);

    const ago = await pedir(t, "2026-08");
    expect(ago.confiable).toBe(true);
    expect(ago.aviso).toBeNull();
  });

  test("el primer mes confiable es agosto de 2026", () => {
    expect(PRIMER_MES_CONFIABLE).toBe("2026-08");
  });
});

describe("bordes", () => {
  test("un mes inválido se rechaza", async () => {
    const t = await setup([]);
    for (const ym of ["2026-13", "agosto", "26-08"]) {
      await expect(pedir(t, ym), ym).rejects.toThrow(/mes inválido/i);
    }
  });

  test("un mes sin revisiones devuelve ceros, no explota", async () => {
    const t = await setup([]);
    const res = await pedir(t, "2026-08");
    expect(res.comisionTotalCRC).toBe(0);
    expect(sergio(res).semanas).toEqual([]);
  });

  test("las tarifas viajan en la respuesta, para poder mostrarlas", async () => {
    // La pantalla tiene que poder explicar el número sin repetir constantes.
    const t = await setup([]);
    const res = await pedir(t, "2026-08");
    expect(res.tarifas).toEqual({
      viaticoPorRevision: 2_000,
      comisionPorRevision: 3_800,
      revisionesSinComision: 45,
    });
  });
});

/* ========================================================================== */
/* El mes en curso (A120)                                                     */
/* ========================================================================== */

describe("el mes en curso se marca aparte de «no confiable»", () => {
  /**
   * Son dos cosas distintas y la pantalla dice cosas distintas por cada una:
   * `confiable=false` es «este número está incompleto por un hueco del dato»;
   * `enCurso=true` es «este número todavía no terminó de pasar». Un mes puede
   * ser confiable y estar en curso a la vez — de hecho es el caso normal, y es
   * justo cuando la comisión marca ₡0 las primeras semanas y se lee como error.
   */
  const mesDeHoy = () =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Costa_Rica",
      year: "numeric",
      month: "2-digit",
    }).format(new Date());

  test("el mes de hoy viene marcado como en curso", async () => {
    const t = await setup([]);
    const r = await pedir(t, mesDeHoy());
    expect(r.enCurso).toBe(true);
  });

  test("un mes cerrado no", async () => {
    const t = await setup([]);
    const r = await pedir(t, "2026-08");
    expect(r.enCurso).toBe(mesDeHoy() === "2026-08");
    // y si hoy no es agosto, además tiene que ser un mes confiable y cerrado
    if (mesDeHoy() !== "2026-08") expect(r.confiable).toBe(true);
  });

  test("«en curso» y «confiable» son independientes", async () => {
    const t = await setup([]);
    const viejo = await pedir(t, "2026-06");
    expect(viejo.confiable).toBe(false); // anterior a 2026-08
    expect(viejo.enCurso).toBe(false); // y ya cerrado
  });
});

/* ========================================================================== */
/* Feriados obligatorios trabajados — A129                                    */
/* ========================================================================== */

describe("detecta los feriados de pago obligatorio trabajados (A129)", () => {
  /**
   * 15 de setiembre (Independencia) es **obligatorio**; 31 de agosto (Persona
   * Negra y la Cultura Afrocostarricense) es **no obligatorio**. La diferencia
   * es la que decide si se paga doble, así que es la primera que se prueba.
   */
  test("un feriado obligatorio trabajado cuenta un día", async () => {
    const t = await setup([{ iso: "2026-09-15" }]);
    const r = await pedir(t, "2026-09");

    expect(r.feriadosDias).toBe(1);
    expect(r.feriados[0].nombre).toBe("Independencia");
    expect(r.feriados[0].tecnico).toBe("Sergio Smartcheck");
  });

  test("un feriado NO obligatorio no cuenta, pero SÍ se lista", async () => {
    // Trabajarlo se paga sencillo salvo acuerdo: no genera recargo. Pero
    // omitirlo dejaría invisible un día que el técnico sí trabajó — Sergio
    // trabajó el 31-ago-2026 y esa ausencia provocó la pregunta «¿y el día de
    // la persona negra?». Se lista rotulado, no se esconde.
    const t = await setup([{ iso: "2026-08-31" }]);
    const r = await pedir(t, "2026-08");

    expect(r.feriadosDias).toBe(0);
    expect(r.feriados).toHaveLength(1);
    expect(r.feriados[0].tipo).toBe("no_obligatorio");
  });

  test("un mes con los dos tipos cuenta solo el obligatorio", async () => {
    const t = await setup([{ iso: "2026-08-15" }, { iso: "2026-08-31" }]);
    const r = await pedir(t, "2026-08");

    expect(r.feriadosDias).toBe(1); // solo el Día de la Madre
    expect(r.feriados).toHaveLength(2); // pero los dos quedan a la vista
  });

  test("un día común no cuenta", async () => {
    const t = await setup([{ iso: "2026-09-16" }]);
    expect((await pedir(t, "2026-09")).feriadosDias).toBe(0);
  });

  /**
   * La misma regla que rige viáticos y comisiones (B36): las revisiones que hace
   * Esteban desde su cuenta de admin no le generan pago a nadie.
   */
  test("las revisiones de Esteban NO generan recargo", async () => {
    const t = await setup([{ iso: "2026-09-15", user: ESTEBAN }]);
    expect((await pedir(t, "2026-09")).feriadosDias).toBe(0);
  });

  /**
   * **Varias revisiones el mismo feriado son UN día.** El recargo es por la
   * jornada, no por revisión: contar por revisión le pagaría tres días por un
   * martes.
   */
  test("tres revisiones el mismo feriado siguen siendo un día", async () => {
    const t = await setup([
      { iso: "2026-09-15", hora: "08:00" },
      { iso: "2026-09-15", hora: "11:00" },
      { iso: "2026-09-15", hora: "15:00" },
    ]);
    const r = await pedir(t, "2026-09");

    expect(r.feriadosDias).toBe(1);
    expect(r.feriados[0].revisiones).toBe(3);
  });

  test("dos feriados distintos del mismo mes son dos días", async () => {
    // 2026: 25 de julio (Anexión) y… solo uno en julio, así que se usa abril:
    // 11 de abril (Juan Santamaría) y Jueves/Viernes Santo caen en abril.
    const t = await setup([{ iso: "2026-04-11" }, { iso: "2026-04-02" }]);
    expect((await pedir(t, "2026-04")).feriadosDias).toBe(2);
  });

  /**
   * **El recargo del feriado se corta por MES CALENDARIO, no por la semana.**
   * Es la excepción deliberada a la regla que usan viáticos y comisiones: el
   * recargo es salario, y el salario se paga por mes calendario.
   *
   * El 1.º de enero de 2027 es viernes; su semana arrancó el lunes 28 de
   * diciembre, así que `mesDePagoSemanal` lo manda a **diciembre**. El recargo
   * tiene que quedar en **enero**, que es donde Esteban lo va a buscar.
   */
  test("un feriado se paga en SU mes calendario, no en el de su semana", async () => {
    const t = await setup([{ iso: "2027-01-01" }]);

    expect(mesDePagoSemanal(en("2027-01-01"))).toBe("2026-12"); // la semana dice diciembre
    expect((await pedir(t, "2027-01")).feriadosDias).toBe(1); // el recargo, enero
    expect((await pedir(t, "2026-12")).feriadosDias).toBe(0);
  });

  test("cada técnico que trabaja el mismo feriado gana su propio día", async () => {
    const t = convexTest(schema, convexModules);
    await t.run(async (ctx) => {
      const now = Date.now();
      for (const [id, nombre] of [
        [SERGIO, "Sergio Smartcheck"],
        ["user_otro", "Otro Técnico"],
      ] as const) {
        await ctx.db.insert("users", {
          clerkId: id, email: `${id}@x.com`, name: nombre,
          role: "tecnico", approvalStatus: "approved", createdAt: now, updatedAt: now,
        });
      }
      for (const u of [SERGIO, "user_otro"]) {
        await ctx.db.insert("inspections", {
          clerkUserId: u,
          inspectionStartAt: en("2026-09-15"),
        } as never);
      }
    });

    expect((await pedir(t, "2026-09")).feriadosDias).toBe(2);
  });

  test("un mes sin feriados trabajados devuelve cero y lista vacía", async () => {
    const t = await setup([{ iso: "2026-09-16" }, { iso: "2026-09-17" }]);
    const r = await pedir(t, "2026-09");

    expect(r.feriadosDias).toBe(0);
    expect(r.feriados).toEqual([]);
  });
});
