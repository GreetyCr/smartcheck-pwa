/**
 * Lo que se le paga al técnico cada mes: viáticos y comisión (**B36**).
 *
 * Hoy Esteban calcula estos dos números a mano y los escribe. Son la regla que
 * confirmó el 24-ago, y las tres partes importan por igual:
 *
 *  1. **Solo cuentan las revisiones del técnico.** No todas. «36 hizo Sergio,
 *     las otras las hice yo» — Esteban también hace revisiones y esas no le
 *     generan viático ni comisión a nadie. Es lo que explicaba el desfase entre
 *     sus 32 y nuestras 46 de julio.
 *  2. **La semana va de lunes a domingo**, y una semana pertenece **al mes en
 *     que arrancó**. Por eso los días 1, 2 y 3 de julio le contaron a junio.
 *  3. **Viático ₡2.000 desde la primera revisión; comisión ₡3.800 a partir de la
 *     número 46 del mes.** La comisión reproduce julio al colón con su propio
 *     conteo: `(64 − 45) × 3.800 = ₡72.200`.
 *
 * ---
 *
 * **Hasta cuándo NO sirve, y por qué se dice en vez de callarlo.** La atribución
 * por persona solo existe en la app. Sergio hizo su primera revisión ahí el
 * **16-jul-2026**, y la plataforma vieja —que no dice quién hizo qué— siguió en
 * uso hasta el 19 de julio. Así que **el primer mes completo y confiable es
 * agosto de 2026**. Para meses anteriores el cálculo se muestra igual, pero
 * marcado: un número redondo y silenciosamente incompleto es peor que ninguno.
 */
import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { lunesDeLaSemana, mesDePagoSemanal, nowMs, yearMonth as ymDe } from "./lib/dates";

/** ₡ por revisión, desde la primera. */
export const VIATICO_POR_REVISION = 2_000;
/** ₡ por revisión, a partir de la número 46 del mes. */
export const COMISION_POR_REVISION = 3_800;
/** Las primeras 45 del mes no generan comisión. */
export const REVISIONES_SIN_COMISION = 45;

/**
 * Primer mes en que el conteo por persona está completo.
 *
 * Antes de agosto conviven dos cosas que lo rompen: revisiones en la plataforma
 * vieja (sin dueño) y un Sergio que todavía no usaba la app.
 */
export const PRIMER_MES_CONFIABLE = "2026-08";

const FORMATO_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Viático y comisión a partir del conteo de revisiones del mes. */
export function calcularPago(revisiones: number): {
  viaticosCRC: number;
  comisionCRC: number;
  revisionesConComision: number;
} {
  const conComision = Math.max(0, revisiones - REVISIONES_SIN_COMISION);
  return {
    viaticosCRC: revisiones * VIATICO_POR_REVISION,
    comisionCRC: conComision * COMISION_POR_REVISION,
    revisionesConComision: conComision,
  };
}

const semanaRow = v.object({
  /** Lunes de la semana, ISO. */
  lunes: v.string(),
  revisiones: v.number(),
  viaticosCRC: v.number(),
});

const tecnicoRow = v.object({
  clerkId: v.string(),
  nombre: v.string(),
  revisiones: v.number(),
  revisionesConComision: v.number(),
  viaticosCRC: v.number(),
  comisionCRC: v.number(),
  semanas: v.array(semanaRow),
});

export const pagosTecnicoReturns = v.object({
  yearMonth: v.string(),
  tecnicos: v.array(tecnicoRow),
  /** Suma de las comisiones — es el dato que va al campo de la planilla. */
  comisionTotalCRC: v.number(),
  viaticosTotalCRC: v.number(),
  /** Revisiones del mes que NO son de un técnico (las hace Esteban). */
  revisionesDeOtros: v.number(),
  tarifas: v.object({
    viaticoPorRevision: v.number(),
    comisionPorRevision: v.number(),
    revisionesSinComision: v.number(),
  }),
  /** `false` para los meses en que el conteo por persona está incompleto. */
  confiable: v.boolean(),
  /**
   * ¿Es el mes que todavía está corriendo? **No es lo mismo que «no confiable»**:
   * el dato del mes en curso es correcto, pero **parcial por definición**, y el
   * número va a subir hasta que el mes cierre.
   */
  enCurso: v.boolean(),
  aviso: v.union(v.string(), v.null()),
});

/**
 * Cómputo puro, compartido por la `internalQuery` y el wrapper público (A41).
 *
 * Lee `inspections` y **no** la vista unificada: la vista incluye la plataforma
 * vieja, que no dice quién hizo cada revisión. Meterla acá sumaría revisiones
 * sin dueño al total de alguien.
 */
export async function pagosTecnicoImpl(ctx: QueryCtx, { yearMonth }: { yearMonth: string }) {
  if (!FORMATO_MES.test(yearMonth)) {
    throw new Error(`Mes inválido: "${yearMonth}". Se espera AAAA-MM.`);
  }

  const tecnicos = (await ctx.db.query("users").collect()).filter(
    (u) => u.role === "tecnico" && !!u.clerkId,
  );
  const porTecnico = new Map<
    string,
    { nombre: string; semanas: Map<string, number> }
  >();
  for (const u of tecnicos) {
    porTecnico.set(u.clerkId, {
      nombre: u.name ?? u.email ?? u.clerkId,
      semanas: new Map(),
    });
  }

  let revisionesDeOtros = 0;

  for (const r of await ctx.db.query("inspections").collect()) {
    const fecha = r.inspectionStartAt ?? r._creationTime;
    // El mes de PAGO, no el del calendario: la semana manda.
    if (mesDePagoSemanal(fecha) !== yearMonth) continue;

    const t = r.clerkUserId ? porTecnico.get(r.clerkUserId) : undefined;
    if (!t) {
      revisionesDeOtros++;
      continue;
    }
    const lunes = lunesDeLaSemana(fecha);
    t.semanas.set(lunes, (t.semanas.get(lunes) ?? 0) + 1);
  }

  const filas = [...porTecnico.entries()]
    .map(([clerkId, t]) => {
      const revisiones = [...t.semanas.values()].reduce((a, n) => a + n, 0);
      const pago = calcularPago(revisiones);
      return {
        clerkId,
        nombre: t.nombre,
        revisiones,
        ...pago,
        semanas: [...t.semanas.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([lunes, n]) => ({
            lunes,
            revisiones: n,
            viaticosCRC: n * VIATICO_POR_REVISION,
          })),
      };
    })
    .sort((a, b) => b.revisiones - a.revisiones);

  const confiable = yearMonth >= PRIMER_MES_CONFIABLE;
  /**
   * El mes en curso se marca aparte — **A120**.
   *
   * La pantalla abre por defecto en el mes de hoy, así que lo primero que se ve
   * un día 2 es un viático pequeño y una **comisión en ₡0**: la comisión solo
   * arranca en la revisión número 46 del mes, de modo que las primeras semanas
   * marcan cero **por regla, no por error**. Sin decirlo, ese cero se lee como
   * que el cálculo no corrió o que la planilla está rota.
   *
   * Va separado de `confiable` a propósito: aquel dice «este número está
   * incompleto por un hueco del dato»; este dice «este número todavía no
   * terminó de pasar».
   */
  const enCurso = yearMonth === ymDe(nowMs());

  return {
    yearMonth,
    tecnicos: filas,
    comisionTotalCRC: filas.reduce((a, t) => a + t.comisionCRC, 0),
    viaticosTotalCRC: filas.reduce((a, t) => a + t.viaticosCRC, 0),
    revisionesDeOtros,
    tarifas: {
      viaticoPorRevision: VIATICO_POR_REVISION,
      comisionPorRevision: COMISION_POR_REVISION,
      revisionesSinComision: REVISIONES_SIN_COMISION,
    },
    confiable,
    enCurso,
    aviso: confiable
      ? null
      : `Antes de ${PRIMER_MES_CONFIABLE} el conteo por persona está incompleto: Sergio empezó a usar la app el 16-jul-2026 y la plataforma vieja, que no registra quién hizo cada revisión, se usó hasta el 19 de julio. El número de este mes se queda corto.`,
  };
}

export const pagosTecnico = internalQuery({
  args: { yearMonth: v.string() },
  returns: pagosTecnicoReturns,
  handler: async (ctx, args) => pagosTecnicoImpl(ctx, args),
});
