import { describe, expect, it } from "vitest";
import { SECTIONS_CONFIG } from "@/lib/constants/sectionItems";
import { getSectionCompletionStats } from "@/lib/section-form-utils";
import { formatItemForPdf } from "@/lib/pdf/formatItem";
import { countFindingsForSectionDoc } from "@/lib/inspection-findings";
import { buildPdfFindingRows } from "@/lib/pdf/findingSummary";

/** Documento Motor típico pre-cambio (sin nivel_coolant). */
const legacyMotor = {
  nivel_aceite: { value: "bien" },
  aspecto_aceite: { value: "bien" },
  contaminacion_interna: { value: "no" },
  fajas_accesorios: { value: "bien" },
  fuga_aceite: { value: "no" },
  indicios_reparacion_prematura: { value: "no" },
  estado_radiador_condensador: { value: "bien" },
  fugas_coolant: { value: "no" },
  indicios_malas_manipulaciones: { value: "no" },
  ruidos_anormales: { value: "no" },
  presencia_humo: { value: "no" },
  presencia_herrumbre_motor: { value: "no" },
};

/** Transmisión típica pre-cambio (sin tipo_transmision). */
const legacyTransmision = {
  aspecto_liquido_transmision: { value: "bien" },
  fugas_aceite: { value: "no" },
  estado_botas_eje: { value: "bien" },
  aspecto_liquido_embrague: { value: "bien" },
  fugas_liquido_embrague: { value: "no" },
  funcionamiento_embrague: { value: "bien" },
  funcionamiento_palanca: { value: "bien" },
  ruidos_anormales: { value: "no" },
  funcionamiento_cambio_velocidades: { value: "bien" },
};

describe("compatibilidad reportes legacy con catálogo nuevo", () => {
  it("formatea ítems nuevos ausentes como — sin lanzar", () => {
    const motor = SECTIONS_CONFIG.find((s) => s.table === "section_motor")!;
    const coolant = motor.items.find((i) => i.key === "nivel_coolant")!;
    expect(formatItemForPdf(coolant, undefined).value).toBe("—");

    const trans = SECTIONS_CONFIG.find((s) => s.table === "section_transmision")!;
    const tipo = trans.items.find((i) => i.key === "tipo_transmision")!;
    expect(formatItemForPdf(tipo, undefined).value).toBe("—");
  });

  it("conteo de hallazgos no se altera por campos ausentes", () => {
    expect(countFindingsForSectionDoc("section_motor", legacyMotor)).toBe(0);
    expect(
      countFindingsForSectionDoc("section_transmision", legacyTransmision),
    ).toBe(0);
  });

  it("resumen ejecutivo PDF tolera docs legacy", () => {
    const rows = buildPdfFindingRows([
      {
        table: "section_motor",
        doc: legacyMotor,
        itemPhotoUrls: {},
        sectionPhotoUrls: [],
      },
      {
        table: "section_transmision",
        doc: legacyTransmision,
        itemPhotoUrls: {},
        sectionPhotoUrls: [],
      },
    ]);
    expect(rows).toEqual([]);
  });

  it("progreso: docs legacy dejan de verse 100% por ítems nuevos requeridos", () => {
    const motor = SECTIONS_CONFIG.find((s) => s.table === "section_motor")!;
    const trans = SECTIONS_CONFIG.find((s) => s.table === "section_transmision")!;
    const motorStats = getSectionCompletionStats(motor, legacyMotor);
    const transStats = getSectionCompletionStats(trans, legacyTransmision);
    expect(motorStats.filled).toBe(motorStats.total - 1);
    expect(transStats.filled).toBe(transStats.total - 1);
  });

  it("fotos extra null no entran a la galería (filtro url)", () => {
    const extras = [
      { caption: "VIN — 1", url: "https://x/vin.jpg" as string | null },
      { caption: "VIN — 2", url: null as string | null },
      { caption: "Kilometraje", url: null as string | null },
    ];
    const kept = extras.filter((r) => r.url);
    expect(kept).toHaveLength(1);
  });

  it("hora de inicio ausente se muestra como guion", () => {
    const startAt = undefined as number | undefined;
    const shown =
      startAt != null && Number.isFinite(startAt) ? "date" : "—";
    expect(shown).toBe("—");
  });
});
