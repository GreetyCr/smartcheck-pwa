import { describe, expect, it } from "vitest";
import {
  clampInspectionStartAtLocal,
  fromDatetimeLocalValue,
  isInspectionStartAtInFuture,
  toDatetimeLocalValue,
} from "@/lib/datetime-local";

describe("inspection start datetime", () => {
  it("detecta hora futura", () => {
    const now = new Date("2026-07-25T11:17:00").getTime();
    const future = toDatetimeLocalValue(new Date("2026-07-25T11:18:00").getTime());
    const past = toDatetimeLocalValue(new Date("2026-07-25T11:16:00").getTime());
    expect(isInspectionStartAtInFuture(future, now)).toBe(true);
    expect(isInspectionStartAtInFuture(past, now)).toBe(false);
    expect(isInspectionStartAtInFuture("", now)).toBe(false);
  });

  it("recorta valor futuro a ahora", () => {
    const now = new Date("2026-07-25T11:17:30").getTime();
    const future = toDatetimeLocalValue(new Date("2026-07-25T11:18:00").getTime());
    expect(clampInspectionStartAtLocal(future, now)).toBe(
      toDatetimeLocalValue(now),
    );
  });

  it("roundtrip local value", () => {
    const local = "2026-07-25T11:17";
    expect(toDatetimeLocalValue(fromDatetimeLocalValue(local))).toBe(local);
  });
});
