import { describe, expect, it } from "vitest";
import {
  labelTransmission,
  labelTransmissionForReport,
} from "@/lib/pdf/vehicleLabels";

describe("labelTransmissionForReport", () => {
  it("prioriza tipo_transmision de la sección", () => {
    expect(
      labelTransmissionForReport({
        inspectionTransmissionType: undefined,
        sectionTipoTransmision: { value: "manual" },
      }),
    ).toBe("Manual");
    expect(
      labelTransmissionForReport({
        inspectionTransmissionType: "automatico_2wd",
        sectionTipoTransmision: { value: "automatico" },
      }),
    ).toBe("Automático");
  });

  it("cae al campo legacy de cabecera si no hay ítem de sección", () => {
    expect(
      labelTransmissionForReport({
        inspectionTransmissionType: "manual_4wd",
        sectionTipoTransmision: undefined,
      }),
    ).toBe("Manual 4WD");
  });

  it("muestra guion si no hay dato", () => {
    expect(
      labelTransmissionForReport({
        inspectionTransmissionType: undefined,
        sectionTipoTransmision: undefined,
      }),
    ).toBe("—");
  });
});

describe("labelTransmission", () => {
  it("acepta manual/automatico además del legacy 2wd/4wd", () => {
    expect(labelTransmission("manual")).toBe("Manual");
    expect(labelTransmission("automatico")).toBe("Automático");
  });
});
