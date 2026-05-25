import { expect, test } from "vitest";
import { INSPECTION_PATCH_FIELD_KEYS } from "../../convex/inspections";
import {
  INSPECTION_DRAFT_PATCH_FIELD_KEYS,
  parseInspectionDraftPatch,
  safeParseInspectionDraftPatch,
} from "./inspectionDraft";
import {
  InspectionDraftValidationError,
  validateInspectionDraftPatch,
} from "../../convex/lib/validateInspectionDraft";

test("INSPECTION_DRAFT_PATCH_FIELD_KEYS coincide con Convex patchFields", () => {
  expect([...INSPECTION_DRAFT_PATCH_FIELD_KEYS].sort()).toEqual(
    [...INSPECTION_PATCH_FIELD_KEYS].sort(),
  );
});

test("parseInspectionDraftPatch: acepta payload parcial válido", () => {
  const parsed = parseInspectionDraftPatch({
    clientName: "Ana",
    captureSource: "referido",
    vehicleYear: 2020,
    mileageUnit: "km",
  });
  expect(parsed.clientName).toBe("Ana");
  expect(parsed.captureSource).toBe("referido");
});

test("safeParseInspectionDraftPatch: rechaza keys desconocidas", () => {
  const result = safeParseInspectionDraftPatch({
    clientName: "Ana",
    wizardDraft: { foo: 1 },
  });
  expect(result.success).toBe(false);
});

test("safeParseInspectionDraftPatch: rechaza enums obsoletos (countryOfOrigin legacy)", () => {
  const result = safeParseInspectionDraftPatch({
    countryOfOrigin: "estados_unidos",
  });
  expect(result.success).toBe(false);
});

test("safeParseInspectionDraftPatch: rechaza transmissionType inválido", () => {
  const result = safeParseInspectionDraftPatch({
    transmissionType: "automatico",
  });
  expect(result.success).toBe(false);
});

test("safeParseInspectionDraftPatch: acepta storage ids como string", () => {
  const result = safeParseInspectionDraftPatch({
    vehiclePhotoFront: "kg2abc123storageid",
  });
  expect(result.success).toBe(true);
});

test("validateInspectionDraftPatch (servidor): rechaza payload legacy", () => {
  expect(() =>
    validateInspectionDraftPatch({ countryOfOrigin: "estados_unidos" }),
  ).toThrow(InspectionDraftValidationError);
  expect(() =>
    validateInspectionDraftPatch({ clientName: "Ana", inspectionCount: 2 }),
  ).toThrow(InspectionDraftValidationError);
});
