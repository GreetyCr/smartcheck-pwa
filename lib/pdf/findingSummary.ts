import { SECTIONS_CONFIG } from "@/lib/constants/sectionItems";
import { formatItemForPdf } from "@/lib/pdf/formatItem";
import type { PdfExportPayload } from "@/lib/pdf/types";
import { itemCountsAsFinding } from "@/lib/inspection-findings";

export type PdfFindingSummaryRow = {
  sectionName: string;
  itemLabel: string;
  valueText: string;
  observation?: string;
  photoUrls: string[];
};

export type PdfFindingPhotoEntry = { url: string; caption: string };

export function buildPdfFindingRows(
  sections: PdfExportPayload["sections"],
): PdfFindingSummaryRow[] {
  const rows: PdfFindingSummaryRow[] = [];
  for (const sec of sections) {
    if (sec.table === "section_finalizacion") continue;
    const cfg = SECTIONS_CONFIG.find((c) => c.table === sec.table);
    if (!cfg || !sec.doc) continue;
    for (const item of cfg.items) {
      const raw = sec.doc[item.key];
      if (!itemCountsAsFinding(item, raw)) continue;
      const line = formatItemForPdf(item, raw);
      rows.push({
        sectionName: cfg.name,
        itemLabel: item.label,
        valueText: line.value,
        observation: line.observation,
        photoUrls: [...(sec.itemPhotoUrls[item.key] ?? [])],
      });
    }
  }
  return rows;
}

export function flattenFindingPhotos(
  rows: PdfFindingSummaryRow[],
): PdfFindingPhotoEntry[] {
  const out: PdfFindingPhotoEntry[] = [];
  for (const row of rows) {
    for (const url of row.photoUrls) {
      out.push({
        url,
        caption: `${row.sectionName} — ${row.itemLabel}`,
      });
    }
  }
  return out;
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return arr.length ? [arr] : [];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}
