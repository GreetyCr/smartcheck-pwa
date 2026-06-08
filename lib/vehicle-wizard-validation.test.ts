import { describe, expect, it } from "vitest";
import { isValidPlateCr } from "@/lib/vehicle-form";
import { validateVehicleWizardForm } from "@/lib/vehicle-wizard-validation";
import type { InspectionDraft } from "@/types/inspection-draft";

const baseDraft: VehicleDraft = {
  plate: "ABC123",
  vinInput: "",
  yearInput: "2020",
  brand: "Toyota",
  model: "Corolla",
  mileageInput: "50000",
  countryOfOrigin: "nacional",
  engineCategory: "combustion",
  combustionFuel: "gasolina",
  vehiclePhotoFrontFile: {} as File,
  vehiclePhotoSideLeftFile: {} as File,
  vehiclePhotoSideRightFile: {} as File,
  vehiclePhotoRearFile: {} as File,
};

type VehicleDraft = Pick<
  InspectionDraft,
  | "plate"
  | "vinInput"
  | "yearInput"
  | "brand"
  | "model"
  | "mileageInput"
  | "countryOfOrigin"
  | "engineCategory"
  | "combustionFuel"
  | "vehiclePhotoFrontFile"
  | "vehiclePhotoSideLeftFile"
  | "vehiclePhotoSideRightFile"
  | "vehiclePhotoRearFile"
>;

describe("plate length", () => {
  it("accepts 6 to 8 alphanumeric characters", () => {
    expect(isValidPlateCr("ABC123")).toBe(true);
    expect(isValidPlateCr("12345678")).toBe(true);
    expect(isValidPlateCr("ABC12")).toBe(false);
    expect(isValidPlateCr("123456789")).toBe(false);
  });
});

describe("validateVehicleWizardForm", () => {
  it("passes with valid plate and required fields", () => {
    const r = validateVehicleWizardForm({ draft: baseDraft });
    expect(r.ok).toBe(true);
  });

  it("flags missing brand", () => {
    const r = validateVehicleWizardForm({
      draft: { ...baseDraft, brand: "" },
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.key === "brand")).toBe(true);
  });
});
