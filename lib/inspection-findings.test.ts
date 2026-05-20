import { describe, expect, it } from "vitest";
import { SECTIONS_CONFIG } from "@/lib/constants/sectionItems";
import {
  countFindingsForSectionDoc,
  itemCountsAsFinding,
} from "@/lib/inspection-findings";

function item(table: string, key: string) {
  const cfg = SECTIONS_CONFIG.find((s) => s.table === table);
  const found = cfg?.items.find((i) => i.key === key);
  if (!found) throw new Error(`missing ${table}.${key}`);
  return found;
}

describe("inspection-findings", () => {
  it("motor: reparación prematura No no es hallazgo", () => {
    const itm = item("section_motor", "indicios_reparacion_prematura");
    expect(itemCountsAsFinding(itm, { value: "no" })).toBe(false);
    expect(itemCountsAsFinding(itm, { value: "si" })).toBe(true);
  });

  it("motor: malas manipulaciones No no es hallazgo", () => {
    const itm = item("section_motor", "indicios_malas_manipulaciones");
    expect(itemCountsAsFinding(itm, { value: "no" })).toBe(false);
    expect(itemCountsAsFinding(itm, { value: "si" })).toBe(true);
  });

  it("motor: ruidos anormales No no es hallazgo", () => {
    const itm = item("section_motor", "ruidos_anormales");
    expect(itemCountsAsFinding(itm, { value: "no" })).toBe(false);
    expect(itemCountsAsFinding(itm, { value: "si" })).toBe(true);
  });

  it("transmisión: ruidos anormales No no es hallazgo", () => {
    const itm = item("section_transmision", "ruidos_anormales");
    expect(itemCountsAsFinding(itm, { value: "no" })).toBe(false);
  });

  it("motor: presencia herrumbre No no es hallazgo (positiveWhenNo)", () => {
    const itm = item("section_motor", "presencia_herrumbre_motor");
    expect(itemCountsAsFinding(itm, { value: "no" })).toBe(false);
    expect(itemCountsAsFinding(itm, { value: "si" })).toBe(true);
  });

  it("seguridad: llanta repuesto No sí es hallazgo (findingWhenNo)", () => {
    const itm = item("section_seguridad", "llanta_repuesto");
    expect(itemCountsAsFinding(itm, { value: "no" })).toBe(true);
    expect(itemCountsAsFinding(itm, { value: "si" })).toBe(false);
  });

  it("bien_reparacion_na: solo reparacion cuenta", () => {
    const itm = item("section_motor", "nivel_aceite");
    expect(itemCountsAsFinding(itm, { value: "bien" })).toBe(false);
    expect(itemCountsAsFinding(itm, { value: "reparacion" })).toBe(true);
    expect(itemCountsAsFinding(itm, { value: "na" })).toBe(false);
  });

  it("countFindingsForSectionDoc alinea con ítems motor", () => {
    const doc = {
      indicios_reparacion_prematura: { value: "no" },
      indicios_malas_manipulaciones: { value: "no" },
      ruidos_anormales: { value: "no" },
      presencia_herrumbre_motor: { value: "no" },
      fuga_aceite: { value: "no" },
    };
    expect(countFindingsForSectionDoc("section_motor", doc)).toBe(0);
    expect(
      countFindingsForSectionDoc("section_motor", {
        ...doc,
        ruidos_anormales: { value: "si" },
      }),
    ).toBe(1);
  });
});
