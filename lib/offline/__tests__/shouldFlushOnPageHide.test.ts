import { describe, expect, test } from "vitest";
import { shouldFlushOnPageHide } from "@/lib/offline/shouldFlushOnPageHide";

describe("shouldFlushOnPageHide", () => {
  test("persisted false → flush a IDB", () => {
    expect(shouldFlushOnPageHide({ persisted: false })).toBe(true);
  });

  test("persisted true (bfcache) → no flush", () => {
    expect(shouldFlushOnPageHide({ persisted: true })).toBe(false);
  });
});
