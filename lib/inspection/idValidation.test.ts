import { expect, test } from "vitest";
import { isUuidV4, looksLikeConvexInspectionId } from "./idValidation";

test("isUuidV4: acepta UUID v4 canónico y variantes de espacio/mayúsculas", () => {
  expect(isUuidV4("  550e8400-e29b-11d4-a716-446655440004  ")).toBe(false); // versión ≠ 4
  expect(isUuidV4("  550e8400-e29b-41d4-a716-446655440004  ")).toBe(true);
  expect(isUuidV4("AAAAAAAA-BBBB-4CCC-BAAA-AAAAAAAAAAAA")).toBe(true);
});

test("looksLikeConvexInspectionId: forma típica Convex (sin guiones)", () => {
  expect(looksLikeConvexInspectionId("30pszp69d7c6k54554wwx9h89gycxhr")).toBe(
    true,
  );
  expect(looksLikeConvexInspectionId("  30pszp69d7c6k54554wwx9h89gycxhr  ")).toBe(
    true,
  );
});

test("string que no es UUID v4 ni id Convex por forma", () => {
  expect(isUuidV4("not-a-uuid")).toBe(false);
  expect(looksLikeConvexInspectionId("has-hyphen-30pszp69d7c6k54554wwx9h89")).toBe(
    false,
  );
  expect(looksLikeConvexInspectionId("short")).toBe(false);
  expect(isUuidV4("30pszp69d7c6k54554wwx9h89gycxhr")).toBe(false);
});
