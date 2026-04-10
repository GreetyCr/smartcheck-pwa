import type { SectionConfig, SectionItem } from "@/lib/constants/sectionItems";
import { observationRuleFor } from "@/lib/section-form-ui";

export type SectionFormState = Record<string, unknown>;

function hasValue(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return true;
  if (typeof v === "object" && v !== null && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    if ("value" in o && o.value !== undefined && o.value !== null) {
      return true;
    }
    if ("texto" in o && typeof o.texto === "string" && o.texto.trim() !== "") {
      return true;
    }
  }
  return false;
}

export function countSectionProgress(
  items: SectionItem[],
  state: SectionFormState,
): number {
  let n = 0;
  for (const item of items) {
    const v = state[item.key];
    switch (item.type) {
      case "readonly":
        n++;
        break;
      case "textarea":
      case "text":
        if (typeof v === "string" && v.trim()) n++;
        break;
      case "select":
        if (
          v &&
          typeof v === "object" &&
          "value" in (v as object) &&
          (v as { value?: unknown }).value !== undefined
        ) {
          n++;
        }
        break;
      default:
        if (hasValue(v)) n++;
    }
  }
  return n;
}

function obsOk(
  rule: "optional" | "when_reparacion" | "when_si",
  raw: unknown,
  obs: string | undefined,
): boolean {
  const t = (obs ?? "").trim();
  if (rule === "optional") return true;
  const val = (raw as { value?: unknown } | undefined)?.value;
  if (rule === "when_reparacion") {
    if (val !== "reparacion") return true;
    return t.length > 0;
  }
  if (rule === "when_si") {
    if (val !== "si") return true;
    return t.length > 0;
  }
  return true;
}

export function validateSectionForm(
  config: SectionConfig,
  state: SectionFormState,
): { ok: boolean; message?: string } {
  for (const item of config.items) {
    const v = state[item.key];
    switch (item.type) {
      case "readonly":
        break;
      case "text":
      case "textarea":
        if (item.type === "textarea" && config.id === "finalizacion") {
          if (item.key === "comentario_final") {
            const s = typeof v === "string" ? v.trim() : "";
            if (!s) {
              return {
                ok: false,
                message: "Completa el comentario final antes de continuar.",
              };
            }
          }
        }
        break;
      case "select": {
        const row = v as { value?: unknown; observation?: string } | undefined;
        if (row?.value === undefined || row?.value === null) {
          return {
            ok: false,
            message: `Selecciona una opción en «${item.label}».`,
          };
        }
        break;
      }
      case "bien_reparacion":
      case "bien_reparacion_na": {
        const row = v as
          | { value?: string; observation?: string }
          | undefined;
        if (!row?.value) {
          return {
            ok: false,
            message: `Indica una opción en «${item.label}».`,
          };
        }
        if (
          !obsOk(observationRuleFor(item), row, row.observation)
        ) {
          return {
            ok: false,
            message: `Completa las observaciones en «${item.label}».`,
          };
        }
        break;
      }
      case "si_no":
      case "si_no_na": {
        const row = v as
          | { value?: string; observation?: string }
          | undefined;
        if (!row?.value) {
          return {
            ok: false,
            message: `Indica una opción en «${item.label}».`,
          };
        }
        if (
          !obsOk(observationRuleFor(item), row, row.observation)
        ) {
          return {
            ok: false,
            message: `Completa las observaciones en «${item.label}».`,
          };
        }
        break;
      }
      default:
        break;
    }
  }
  return { ok: true };
}

/** Convierte documento Convex a estado de formulario (sin metadatos). */
export function docToFormState(
  doc: Record<string, unknown> | null | undefined,
  config: SectionConfig,
): SectionFormState {
  if (!doc) return {};
  const out: SectionFormState = {};
  const skip = new Set([
    "_id",
    "_creationTime",
    "inspectionId",
    "photos",
    "itemPhotos",
  ]);
  for (const key of Object.keys(doc)) {
    if (skip.has(key)) continue;
    let val = doc[key];
    if (key === "comentario_final" && val && typeof val === "object") {
      const o = val as { texto?: string };
      val = o.texto ?? "";
    }
    if (key === "fecha_hora" && typeof val === "number") {
      out[key] = val;
      continue;
    }
    out[key] = val;
  }
  if (doc.itemPhotos && typeof doc.itemPhotos === "object") {
    out.itemPhotos = { ...(doc.itemPhotos as Record<string, unknown>) };
  }
  return out;
}

/** Arma el patch para `upsertSection` a partir del estado. */
export function formStateToPatch(
  state: SectionFormState,
  config: SectionConfig,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const item of config.items) {
    const v = state[item.key];
    if (v === undefined) continue;
    if (item.key === "comentario_final" && typeof v === "string") {
      patch.comentario_final = { texto: v.trim() };
      continue;
    }
    if (item.type === "readonly") {
      patch[item.key] = v;
      continue;
    }
    patch[item.key] = v;
  }
  if (state.itemPhotos && typeof state.itemPhotos === "object") {
    const cleaned: Record<string, unknown[]> = {};
    for (const [k, arr] of Object.entries(
      state.itemPhotos as Record<string, unknown[]>,
    )) {
      if (Array.isArray(arr) && arr.length > 0) cleaned[k] = arr;
    }
    if (Object.keys(cleaned).length > 0) {
      patch.itemPhotos = cleaned;
    }
  }
  return patch;
}
