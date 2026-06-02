import type { SectionConfig, SectionItem } from "@/lib/constants/sectionItems";
import type { SectionFormState } from "@/lib/section-form-utils";

function fieldSelectValue(state: SectionFormState, fieldKey: string): string {
  const raw = state[fieldKey];
  if (raw && typeof raw === "object" && "value" in (raw as object)) {
    const v = (raw as { value?: unknown }).value;
    if (typeof v === "string") return v;
  }
  return "";
}

/** Ítem visible según `visibleWhen` (p. ej. sub-ítems de Tracción solo en 4WD/4x4). */
export function isSectionItemVisible(
  item: SectionItem,
  state: SectionFormState,
): boolean {
  if (!item.visibleWhen) return true;
  const current = fieldSelectValue(state, item.visibleWhen.field);
  return item.visibleWhen.values.includes(current);
}

export function getVisibleSectionItems(
  config: SectionConfig,
  state: SectionFormState,
): SectionItem[] {
  return config.items.filter((item) => isSectionItemVisible(item, state));
}
