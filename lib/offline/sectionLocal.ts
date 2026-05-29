import type { SectionConfig } from "@/lib/constants/sectionItems";
import type { SectionData } from "@/lib/offline/db";
import {
  docToFormState,
  formStateToPatch,
  type SectionFormState,
} from "@/lib/section-form-utils";

/** Payload para `sections.upsertSection` / fila IDB — único camino desde el formulario. */
export function toUpsertPayload(
  state: SectionFormState,
  config: SectionConfig,
): SectionData {
  return formStateToPatch(state, config) as SectionData;
}

export function localSectionDoc(
  sections: Record<string, SectionData> | null | undefined,
  sectionTable: string,
): Record<string, unknown> | undefined {
  const doc = sections?.[sectionTable];
  if (!doc || typeof doc !== "object") return undefined;
  return doc as Record<string, unknown>;
}

export function seedSectionFormState(
  doc: Record<string, unknown> | null | undefined,
  config: SectionConfig,
  finalizacionDefaults?: {
    nombre_inspector: string;
    fecha_hora: number;
  },
): SectionFormState {
  let next = docToFormState(doc, config);

  if (config.id === "finalizacion" && finalizacionDefaults) {
    next = {
      ...next,
      nombre_inspector:
        (doc?.nombre_inspector as string | undefined) ??
        finalizacionDefaults.nombre_inspector,
      fecha_hora:
        (doc?.fecha_hora as number | undefined) ?? finalizacionDefaults.fecha_hora,
      comentario_final:
        typeof next.comentario_final === "string"
          ? next.comentario_final
          : ((doc?.comentario_final as { texto?: string } | undefined)?.texto ??
            ""),
    };
  }

  return next;
}
