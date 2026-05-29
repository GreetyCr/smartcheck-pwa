import { describe, expect, it } from "vitest";
import type { SectionConfig } from "@/lib/constants/sectionItems";
import { toUpsertPayload } from "@/lib/offline/sectionLocal";

const minimalConfig: SectionConfig = {
  id: "motor",
  name: "Motor",
  table: "section_motor",
  items: [
    {
      key: "aceite_motor",
      label: "Aceite",
      type: "bien_reparacion_na",
    },
  ],
};

describe("sectionLocal", () => {
  it("toUpsertPayload maps form state to section patch", () => {
    const patch = toUpsertPayload(
      {
        aceite_motor: { value: "bien", observation: "" },
      },
      minimalConfig,
    );
    expect(patch.aceite_motor).toEqual({ value: "bien", observation: "" });
  });
});
