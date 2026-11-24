import { describe, expect, it } from "vitest";
import { PAGE_GUTTER_X, pagePaddingClass } from "./page-padding";

describe("pagePaddingClass", () => {
  it("gives full padding the side gutter plus top and bottom padding", () => {
    expect(pagePaddingClass(true)).toBe(`${PAGE_GUTTER_X} py-6`);
  });

  it("leaves the side gutter out for vertical-only and bottom-only padding", () => {
    expect(pagePaddingClass("vertical")).toBe("py-6");
    expect(pagePaddingClass("bottom")).toBe("pb-6");
  });

  it("gives no class when padding is off", () => {
    expect(pagePaddingClass(false)).toBeUndefined();
  });
});
