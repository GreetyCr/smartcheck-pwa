import type { SectionItem } from "@/lib/constants/sectionItems";
import type { FormattedLine } from "@/lib/pdf/formatItem";

/**
 * Estilo del valor en PDF: hallazgos negativos vs positivos.
 * `positiveWhenNo`: «No» indica ausencia de un defecto (ej. herrumbre).
 */
export function pdfItemValueIsPositive(
  item: SectionItem,
  line: FormattedLine,
): boolean | null {
  const v = line.value;
  if (v === "—") return null;
  if (
    item.positiveWhenNo &&
    (item.type === "si_no" || item.type === "si_no_na")
  ) {
    if (v === "No") return true;
    if (v === "Sí") return false;
    if (v === "N/A") return null;
  }
  return null;
}
