/**
 * Ingresos por canal (F3 · tablero 3 de 5).
 *
 * **De dónde sale el canal, y por qué solo de un lado.** El canal vive en las
 * *revisiones*, no en los leads: `captureSource` de la app y `Fuente` del CRM
 * viejo, unificados a un vocabulario title-case en **A34** (Mercadeo, TikTok,
 * Buscador, Recompra, Referido, Otro). En Airtable el origen **está vacío en las
 * 9.096 fichas** —verificado en PROD—, así que **no existe un embudo de leads por
 * canal** y este tablero no lo finge. Es la limitación que ya anotaba el plan, y
 * se dice en pantalla en vez de dejar a Esteban buscando la sección que falta.
 *
 * **Los ingresos de acá NO son los del P&L.** Estos salen de las revisiones
 * (`inspections_all`); los titulares salen de `finance_entries` (**A16**). No
 * cuadran, y no tienen por qué: hay ingresos que no son revisiones y revisiones
 * cuyo cobro se registró distinto. Mezclarlos sería el error de A49 otra vez, así
 * que el número se rotula por lo que es y la nota lo dice.
 *
 * **La publicidad no se puede repartir por canal.** En la hoja de Esteban es una
 * sola bolsa (`ADS`, `MARKETING`, `PUBLICIDAD DEL x AL y`) sin separar por
 * plataforma. Así que el costo se atribuye **completo a Mercadeo**, que es el
 * canal que sí sabemos que es pagado. Eso **sobreestima** el costo por revisión
 * si TikTok o Buscador también llevan pauta — se eligió el lado conservador a
 * propósito: es preferible que el canal se vea más caro de lo que es a venderlo
 * más barato de lo que es.
 */
import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { yearMonth as ymFromMs, isoDate } from "./lib/dates";
import { buildInspectionsAll, pasaFiltros, type FilterArgs } from "./metrics";

/**
 * Todas las dimensiones de la barra global **menos `channel`**.
 *
 * Esa exclusión se mantiene y ahora importa más: filtrar por canal el tablero
 * *de canales* dejaría una sola barra en pantalla y el reparto —que es lo que
 * este tablero existe para mostrar— perdería sentido. La barra global lo marca
 * como «no aplica acá» en vez de aceptarlo y no hacer nada, que es lo que A64
 * prohíbe.
 *
 * Las demás sí entran: preguntar «¿de dónde vienen los clientes **de Hyundai**
 * en Heredia?» es exactamente para lo que sirve RF-02.
 */
export const channelFilterValidator = {
  fromMs: v.optional(v.number()),
  toMs: v.optional(v.number()),
  province: v.optional(v.string()),
  engineType: v.optional(v.string()),
  agency: v.optional(v.string()),
  brand: v.optional(v.string()),
  sellerType: v.optional(v.string()),
  currency: v.optional(v.string()),
};

/**
 * El canal al que se le carga la pauta.
 *
 * Uno solo y explícito, no una lista adivinada: `Buscador` puede ser SEO (gratis)
 * o SEM (pagado) y `TikTok` puede ser contenido orgánico. Meterlos sin saber
 * repartiría el costo sobre revisiones que quizá no costaron nada.
 */
export const CANAL_CON_PAUTA = "Mercadeo";

/** Etiqueta para las revisiones que no traen canal. Visible, nunca escondida. */
export const SIN_CANAL = "(sin canal)";

const canalRow = v.object({
  canal: v.string(),
  rows: v.number(),
  /** Revisiones con monto: es la base del ticket, no `rows`. */
  rowsConMonto: v.number(),
  ingresosCRC: v.number(),
  pctIngresos: v.number(),
  pctRows: v.number(),
  ticketPromedioCRC: v.number(),
  ultimaRevisionISO: v.union(v.string(), v.null()),
  /** Meses completos sin una sola revisión. 0 = tuvo este mes. */
  mesesSinRevision: v.number(),
});

const mesRow = v.object({
  ym: v.string(),
  /** El mes en curso va incompleto: ni sus ingresos ni su pauta están cerrados. */
  enCurso: v.boolean(),
  rows: v.number(),
  ingresosCRC: v.number(),
  publicidadCRC: v.number(),
  canales: v.array(
    v.object({ canal: v.string(), rows: v.number(), ingresosCRC: v.number() }),
  ),
});

export const channelRevenueReturns = v.object({
  totalRows: v.number(),
  totalRowsConMonto: v.number(),
  totalIngresosCRC: v.number(),
  ticketPromedioCRC: v.number(),
  canales: v.array(canalRow),
  porMes: v.array(mesRow),
  /**
   * Retorno de la pauta, **calculado solo sobre los meses que tienen pauta
   * registrada**.
   *
   * En la hoja de Esteban los primeros meses traen revisiones de Mercadeo pero
   * ningún renglón de publicidad. Meter esas revisiones en el denominador daría
   * un costo por revisión artificialmente barato —salieron «gratis» solo porque
   * el gasto no está anotado—, así que la base se restringe y se reporta cuántos
   * meses quedaron fuera para que el recorte sea visible y no un silencio.
   */
  publicidad: v.object({
    totalCRC: v.number(),
    canalAtribuido: v.string(),
    mesesConPauta: v.number(),
    /** Meses con revisiones del canal pero sin pauta anotada. Excluidos. */
    mesesSinPautaRegistrada: v.number(),
    /** Revisiones del canal EN los meses con pauta. Es el denominador. */
    rowsAtribuidas: v.number(),
    ingresosAtribuidosCRC: v.number(),
    /** El canal completo, para poder decir cuánto quedó fuera de la base. */
    rowsCanalTotal: v.number(),
    /** Pauta ÷ revisiones del canal en esos meses. 0 si no hay base. */
    costoPorRevisionCRC: v.number(),
    /** Colones de ingreso por cada colón de pauta. 0 si no hubo pauta. */
    retornoPorColon: v.number(),
  }),
  nota: v.string(),
});

/** Distancia en meses entre dos `AAAA-MM`. Negativa si `b` es anterior a `a`. */
function mesesEntre(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

const redondear = (x: number, decimales = 1) => {
  const f = 10 ** decimales;
  return Math.round(x * f) / f;
};

/**
 * Cómputo puro. Recibe `ctx` y no llama a otra función de Convex: una `query` no
 * puede `ctx.runQuery` (**A41**), y este cálculo lo comparten la `internalQuery`
 * —que usa el CLI, sin identidad— y el wrapper público, que gatea con
 * `requireAdmin`.
 */
export async function channelRevenueImpl(
  ctx: QueryCtx,
  args: Omit<FilterArgs, "channel">,
) {
  const built = await buildInspectionsAll(ctx);
  // El periodo es semiabierto [from, to) y lo aplica `pasaFiltros`, igual que el
  // resto del BI: así dos periodos contiguos nunca se comen la misma revisión
  // dos veces, y las demás dimensiones se comparan con los MISMOS
  // normalizadores que el resumen ejecutivo. Sin eso, «Heredia» podría
  // significar cosas distintas en dos pantallas.
  const rows = built.all.filter((r) => pasaFiltros(r, args));

  /* ---------------------------------------------------------------------- */
  /* Por canal                                                              */
  /* ---------------------------------------------------------------------- */

  type Acum = {
    rows: number;
    rowsConMonto: number;
    ingresosCRC: number;
    ultimaFecha: number | null;
  };
  const porCanal = new Map<string, Acum>();
  const porMes = new Map<string, Map<string, { rows: number; ingresosCRC: number }>>();

  let totalIngresosCRC = 0;
  let totalRowsConMonto = 0;

  for (const r of rows) {
    const canal = r.channel ?? SIN_CANAL;
    const monto = r.amountCRC;

    const a = porCanal.get(canal) ?? {
      rows: 0,
      rowsConMonto: 0,
      ingresosCRC: 0,
      ultimaFecha: null,
    };
    a.rows++;
    if (monto !== undefined) {
      a.rowsConMonto++;
      a.ingresosCRC += monto;
      totalRowsConMonto++;
      totalIngresosCRC += monto;
    }
    a.ultimaFecha = a.ultimaFecha === null ? r.date : Math.max(a.ultimaFecha, r.date);
    porCanal.set(canal, a);

    const ym = ymFromMs(r.date);
    const mes = porMes.get(ym) ?? new Map();
    const m = mes.get(canal) ?? { rows: 0, ingresosCRC: 0 };
    m.rows++;
    m.ingresosCRC += monto ?? 0;
    mes.set(canal, m);
    porMes.set(ym, mes);
  }

  const mesEnCurso = ymFromMs(Date.now());

  const canales = [...porCanal.entries()]
    .map(([canal, a]) => ({
      canal,
      rows: a.rows,
      rowsConMonto: a.rowsConMonto,
      ingresosCRC: a.ingresosCRC,
      pctIngresos:
        totalIngresosCRC > 0
          ? redondear((a.ingresosCRC / totalIngresosCRC) * 100)
          : 0,
      pctRows: rows.length > 0 ? redondear((a.rows / rows.length) * 100) : 0,
      // Ticket sobre las revisiones CON monto: dividir entre todas castigaría a
      // un canal por filas a las que nunca se les anotó el cobro.
      ticketPromedioCRC:
        a.rowsConMonto > 0 ? Math.round(a.ingresosCRC / a.rowsConMonto) : 0,
      ultimaRevisionISO: a.ultimaFecha === null ? null : isoDate(a.ultimaFecha),
      mesesSinRevision:
        a.ultimaFecha === null
          ? 0
          : Math.max(0, mesesEntre(ymFromMs(a.ultimaFecha), mesEnCurso)),
    }))
    .sort((x, y) => y.ingresosCRC - x.ingresosCRC || y.rows - x.rows);

  /* ---------------------------------------------------------------------- */
  /* Publicidad — una sola bolsa, atribuida al canal que sí es pagado        */
  /* ---------------------------------------------------------------------- */

  const publicidadPorMes = new Map<string, number>();
  let publicidadTotal = 0;
  for (const f of await ctx.db.query("finance_entries").collect()) {
    if (f.isDeleted) continue;
    if (f.kind !== "expense") continue;
    if (f.category !== "publicidad") continue;
    if (args.fromMs != null && f.date < args.fromMs) continue;
    if (args.toMs != null && f.date >= args.toMs) continue;
    publicidadTotal += f.amountCRC;
    const ym = ymFromMs(f.date);
    publicidadPorMes.set(ym, (publicidadPorMes.get(ym) ?? 0) + f.amountCRC);
  }

  // Base del retorno: solo los meses con pauta anotada (ver la nota del
  // validador). Se recorre `porMes` en vez del acumulado del canal.
  let rowsAtribuidas = 0;
  let ingresosAtribuidosCRC = 0;
  let mesesSinPautaRegistrada = 0;
  for (const [ym, mes] of porMes) {
    const delCanal = mes.get(CANAL_CON_PAUTA);
    if (!delCanal) continue;
    if ((publicidadPorMes.get(ym) ?? 0) > 0) {
      rowsAtribuidas += delCanal.rows;
      ingresosAtribuidosCRC += delCanal.ingresosCRC;
    } else {
      mesesSinPautaRegistrada++;
    }
  }
  const rowsCanalTotal =
    canales.find((c) => c.canal === CANAL_CON_PAUTA)?.rows ?? 0;

  /* ---------------------------------------------------------------------- */
  /* Serie mensual — la unión de los meses con revisiones y con pauta        */
  /* ---------------------------------------------------------------------- */

  const meses = [...new Set([...porMes.keys(), ...publicidadPorMes.keys()])].sort();
  const serie = meses.map((ym) => {
    const mes = porMes.get(ym) ?? new Map<string, { rows: number; ingresosCRC: number }>();
    const canalesDelMes = [...mes.entries()]
      .map(([canal, m]) => ({ canal, rows: m.rows, ingresosCRC: m.ingresosCRC }))
      .sort((a, b) => b.ingresosCRC - a.ingresosCRC || b.rows - a.rows);
    return {
      ym,
      enCurso: ym === mesEnCurso,
      rows: canalesDelMes.reduce((s, c) => s + c.rows, 0),
      ingresosCRC: canalesDelMes.reduce((s, c) => s + c.ingresosCRC, 0),
      publicidadCRC: publicidadPorMes.get(ym) ?? 0,
      canales: canalesDelMes,
    };
  });

  return {
    totalRows: rows.length,
    totalRowsConMonto,
    totalIngresosCRC,
    ticketPromedioCRC:
      totalRowsConMonto > 0 ? Math.round(totalIngresosCRC / totalRowsConMonto) : 0,
    canales,
    porMes: serie,
    publicidad: {
      totalCRC: publicidadTotal,
      canalAtribuido: CANAL_CON_PAUTA,
      mesesConPauta: publicidadPorMes.size,
      mesesSinPautaRegistrada,
      rowsAtribuidas,
      ingresosAtribuidosCRC,
      rowsCanalTotal,
      costoPorRevisionCRC:
        rowsAtribuidas > 0 ? Math.round(publicidadTotal / rowsAtribuidas) : 0,
      retornoPorColon:
        publicidadTotal > 0
          ? redondear(ingresosAtribuidosCRC / publicidadTotal, 2)
          : 0,
    },
    nota:
      "Ingresos de REVISIONES (inspections_all, A30) — no son los titulares del P&L, que salen de finance_entries (A16). El canal solo existe en las revisiones: en Airtable el origen está vacío, así que no hay desglose de leads por canal. La pauta es una sola bolsa en la hoja y se atribuye completa a Mercadeo, lo que sobreestima su costo por revisión si otro canal también lleva pauta.",
  };
}

export const channelRevenue = internalQuery({
  args: { ...channelFilterValidator },
  returns: channelRevenueReturns,
  handler: async (ctx, args) => channelRevenueImpl(ctx, args),
});
