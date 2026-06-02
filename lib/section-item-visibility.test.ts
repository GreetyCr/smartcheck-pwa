import { describe, expect, it } from "vitest";
import { getSectionConfig } from "@/lib/constants/sectionItems";
import {
  getVisibleSectionItems,
  isSectionItemVisible,
} from "@/lib/section-item-visibility";

describe("traccion section visibility", () => {
  const config = getSectionConfig("traccion")!;

  it("shows only tipo_traccion when 2wd", () => {
    const state = { tipo_traccion: { value: "2wd" } };
    const visible = getVisibleSectionItems(config, state);
    expect(visible.map((i) => i.key)).toEqual(["tipo_traccion"]);
  });

  it("shows all items when 4x4", () => {
    const state = { tipo_traccion: { value: "4x4" } };
    const visible = getVisibleSectionItems(config, state);
    expect(visible.length).toBe(5);
    expect(isSectionItemVisible(config.items[1]!, state)).toBe(true);
  });
});
