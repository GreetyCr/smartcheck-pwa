/**
 * Opciones de la barra de filtros global — **RF-02**.
 *
 * ## Por qué las opciones salen del backend y no de una lista escrita a mano
 *
 * Una lista fija en el frontend se desactualiza en silencio: el día que
 * aparezca una provincia nueva o una marca nueva, el desplegable no la muestra
 * y **esas revisiones quedan fuera del alcance del filtro sin que nadie se
 * entere**. Acá cada opción se deriva de los datos y viene **con su cuenta**,
 * así que el desplegable dice «Hyundai (146)» y no solo «Hyundai» — y una
 * opción con 0 no existe porque no se genera.
 *
 * ## Las nueve dimensiones del requerimiento, y qué pasa con cada una
 *
 * | Dimensión | Estado |
 * |---|---|
 * | periodo | ✅ la sirve la barra con presets y rango |
 * | canal | ✅ |
 * | provincia | ✅ |
 * | tipo de motor | ✅ |
 * | localidad (agencia) | ✅ |
 * | marca | ✅ tras unificar el texto libre del CRM (`lib/marcas.ts`) |
 * | moneda | ✅ CRC/USD; la app cobra siempre en ₡, el CRM tiene las dos |
 * | tipo de vendedor | ⚠️ **solo la app**: el CRM viejo no lo registraba |
 * | estado de pago | ❌ **no se puede**: hoy no hay ni una revisión sin cobrar |
 *
 * Las dos últimas se devuelven igual, con su cobertura y su motivo, para que la
 * barra los **muestre y explique** en vez de callarlos. Un filtro que falta sin
 * decir por qué se lee como un olvido; uno que aparece y no discrimina nada es
 * peor (A64).
 */
import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { buildInspectionsAll } from "./metrics";

const opcion = v.object({
  valor: v.string(),
  rows: v.number(),
});

const dimension = v.object({
  /** Clave del argumento de la query (`province`, `brand`, …). */
  key: v.string(),
  etiqueta: v.string(),
  opciones: v.array(opcion),
  /** Revisiones que TIENEN el dato. Si es menor al total, la barra lo advierte. */
  cobertura: v.number(),
  /** Texto de la advertencia, o `null` si la dimensión cubre todo. */
  aviso: v.union(v.string(), v.null()),
});

export const filterOptionsReturns = v.object({
  totalRevisiones: v.number(),
  dimensiones: v.array(dimension),
  /** Dimensiones del requerimiento que hoy NO se pueden servir, con el motivo. */
  noDisponibles: v.array(
    v.object({ etiqueta: v.string(), motivo: v.string() }),
  ),
});

export const filterOptions = internalQuery({
  args: {},
  returns: filterOptionsReturns,
  handler: async (ctx) => filterOptionsImpl(ctx),
});

/** Cómputo plano compartido con el wrapper público (A41). */
export async function filterOptionsImpl(ctx: QueryCtx) {
  const { all } = await buildInspectionsAll(ctx);
  const total = all.length;

  /** Cuenta por valor, ignorando los `undefined` (que son la falta de dato). */
  function contar(
    valores: Array<string | undefined>,
  ): { opciones: { valor: string; rows: number }[]; cobertura: number } {
    const m = new Map<string, number>();
    let cobertura = 0;
    for (const v0 of valores) {
      if (v0 === undefined || v0 === "") continue;
      cobertura++;
      m.set(v0, (m.get(v0) ?? 0) + 1);
    }
    const opciones = [...m.entries()]
      .map(([valor, rows]) => ({ valor, rows }))
      // Por cantidad y no alfabético: lo que más pesa se elige más seguido, y
      // con 30 marcas una lista alfabética obliga a buscar la de siempre.
      .sort((a, b) => b.rows - a.rows || a.valor.localeCompare(b.valor));
    return { opciones, cobertura };
  }

  const dims: Array<{
    key: string;
    etiqueta: string;
    valores: Array<string | undefined>;
    aviso?: (cobertura: number) => string | null;
  }> = [
    { key: "channel", etiqueta: "Canal", valores: all.map((r) => r.channel) },
    { key: "province", etiqueta: "Provincia", valores: all.map((r) => r.province) },
    {
      key: "engineType",
      etiqueta: "Tipo de motor",
      valores: all.map((r) => r.engineType),
    },
    { key: "agency", etiqueta: "Localidad", valores: all.map((r) => r.agency) },
    { key: "brand", etiqueta: "Marca", valores: all.map((r) => r.brand) },
    { key: "currency", etiqueta: "Moneda", valores: all.map((r) => r.currency) },
    {
      key: "sellerType",
      etiqueta: "Tipo de vendedor",
      valores: all.map((r) => r.sellerType),
      aviso: (c) =>
        `Solo lo registra la app: hay dato en ${c} de ${total} revisiones. Al filtrar por acá, las demás quedan fuera.`,
    },
  ];

  const dimensiones = dims.map((d) => {
    const { opciones, cobertura } = contar(d.valores);
    return {
      key: d.key,
      etiqueta: d.etiqueta,
      opciones,
      cobertura,
      aviso: d.aviso
        ? d.aviso(cobertura)
        : cobertura < total
          ? `Hay ${total - cobertura} revisiones sin este dato; al filtrar quedan fuera.`
          : null,
    };
  });

  /**
   * El estado de pago se comprueba **con los datos**, no se asume.
   *
   * Si algún día aparecen revisiones sin cobrar, el motivo cambia solo y deja
   * de ser una excusa escrita a mano: pasa a decir cuántas hay.
   */
  const sinCobro = all.filter(
    (r) => r.amountCRC === undefined || r.amountCRC === 0 || r.isPlaceholderIncome,
  ).length;

  return {
    totalRevisiones: total,
    dimensiones,
    noDisponibles: [
      {
        etiqueta: "Estado de pago",
        motivo:
          sinCobro === 0
            ? `Hoy las ${total} revisiones están cobradas: no hay ninguna en ₡0 ni en ₡1.000, así que el filtro tendría un solo valor y no separaría nada.`
            : `Hay ${sinCobro} revisiones sin cobro real de ${total}. Ya se puede separar: falta agregar la dimensión.`,
      },
    ],
  };
}
