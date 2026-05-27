import { describe, expect, it } from "vitest";
import {
  digitsOnlyAmountInput,
  parseDigitsToAmount,
} from "@/lib/amount-input";

describe("amount-input", () => {
  it("strip non-digits", () => {
    expect(digitsOnlyAmountInput("69.000")).toBe("69000");
    expect(digitsOnlyAmountInput("-1 234")).toBe("1234");
  });

  it("parse digits to amount", () => {
    expect(parseDigitsToAmount("69000")).toBe(69000);
    expect(parseDigitsToAmount("")).toBeUndefined();
  });
});
