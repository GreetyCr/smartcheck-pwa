/**
 * Resolución de identidad de un lead — compartida por los cuatro endpoints de
 * escritura (A37).
 *
 * Vive acá y no dentro de `leadsIngest` porque los cuatro tienen que resolver
 * **igual**: si `/leads/upsert` y `/leads/mark-followup` encontraran filas
 * distintas para el mismo teléfono, el bot marcaría el seguimiento de una
 * persona y le escribiría a otra. Un solo camino, una sola regla.
 */
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { normalizePhone } from "../bi/leadsSync";

/**
 * Orden en que se resuelve la identidad. **Pendiente de confirmar con Hans (H1).**
 *
 * `manychatId` va primero porque es el identificador que el bot maneja de forma
 * nativa: si viene, es el que él considera "esta conversación". El teléfono es
 * el respaldo, y además es el que empata con las inspecciones (`phone8`).
 *
 * Cuando Hans conteste, cambiar la decisión es **reordenar esta lista**.
 */
export const IDENTITY_ORDER = ["manychatId", "phone8"] as const;

export type Identidad = {
  existing: Doc<"leads_contacts"> | null;
  /** `manychatId`, `phone8`, o `none` si no se encontró nada. */
  matchedBy: string;
  /** Cuántas filas vivas competían por la llave usada. */
  candidates: number;
};

/**
 * Teléfono utilizable **como llave**.
 *
 * ⚠️ Más estricto que el sync, a propósito. `normalizePhone` siempre devuelve
 * algo: ante un número que no es de Costa Rica se queda con los **últimos 8
 * dígitos** y marca `phoneValid: false`. Para el sync está bien —espejo fiel de
 * Airtable (A26), ahí no nos toca decidir— pero como llave es peligroso:
 * `+1 415 555 0100` se vuelve `55550100`, un número tico plausible, y ese lead
 * quedaría bajo la llave de **otra persona** (A75).
 */
export function telefonoUtilizable(phone: string | undefined | null) {
  const tel = phone != null ? normalizePhone(phone) : null;
  return {
    tel,
    phone8: tel?.phoneValid ? tel.phone8 : undefined,
    rechazado: phone != null && !(tel?.phoneValid && tel.phone8),
  };
}

/**
 * Busca el lead por las llaves disponibles, en el orden de `IDENTITY_ORDER`.
 *
 * Nunca crea nada: eso es decisión de cada endpoint. Los tres de patch
 * (`payment-status`, `mark-followup`, y el on/off por-lead a futuro) responden
 * **404** cuando no encuentran, porque un estado de pago o un seguimiento sobre
 * un contacto que no existe es señal de que algo viene mal de arriba, no una
 * razón para inventar una ficha.
 */
export async function resolverIdentidad(
  ctx: MutationCtx,
  { manychatId, phone8 }: { manychatId?: string; phone8?: string },
): Promise<Identidad> {
  for (const llave of IDENTITY_ORDER) {
    const valor = llave === "manychatId" ? manychatId : phone8;
    if (!valor) continue;

    const encontrados = (
      await ctx.db
        .query("leads_contacts")
        .withIndex(llave === "manychatId" ? "by_manychat" : "by_phone8", (q) =>
          q.eq(llave === "manychatId" ? "manychatId" : "phone8", valor),
        )
        .collect()
    ).filter((r) => !r.isDeleted);

    if (encontrados.length === 0) continue;

    return {
      existing: elegirCandidato(encontrados),
      matchedBy: llave,
      candidates: encontrados.length,
    };
  }
  return { existing: null, matchedBy: "none", candidates: 0 };
}

/**
 * Cuál de las filas repetidas recibe la escritura.
 *
 * La del contacto más reciente: el bot está hablando con alguien **ahora**, y de
 * varias filas con el mismo número la conversación viva es casi siempre la
 * última tocada. Es un desempate determinista —misma entrada, misma salida— para
 * que dos llamadas seguidas no escriban en filas distintas.
 *
 * Es una heurística, no la respuesta: la buena es que Hans defina la llave (H1)
 * y que los duplicados se resuelvan de raíz. Por eso cada vez que se usa queda
 * un aviso en quien la llama.
 */
export function elegirCandidato(
  filas: Array<Doc<"leads_contacts">>,
): Doc<"leads_contacts"> {
  return filas.reduce((mejor, actual) => {
    const a = actual.lastContactAt ?? actual.updatedAt;
    const b = mejor.lastContactAt ?? mejor.updatedAt;
    if (a !== b) return a > b ? actual : mejor;
    // Empate perfecto: se ordena por id para que el resultado sea estable.
    return String(actual._id) < String(mejor._id) ? actual : mejor;
  });
}

/** Aviso de ambigüedad — mismo texto desde los cuatro endpoints. */
export async function avisarAmbiguedad(
  ctx: MutationCtx,
  {
    lead,
    matchedBy,
    candidates,
    runId,
    now,
  }: {
    lead: Doc<"leads_contacts">;
    matchedBy: string;
    candidates: number;
    runId: string;
    now: number;
  },
): Promise<void> {
  await ctx.db.insert("bi_quality_issues", {
    issueType: "ambiguous_upsert",
    severity: "warn",
    entity: "leads_contacts",
    entityRef: lead.airtableId ?? String(lead._id),
    detail:
      `la escritura por ${matchedBy} matcheó ${candidates} filas vivas; ` +
      `se eligió la de contacto más reciente (${String(lead._id)}) — ` +
      `revisar duplicados.`,
    runId,
    detectedAt: now,
    resolved: false,
  });
}
