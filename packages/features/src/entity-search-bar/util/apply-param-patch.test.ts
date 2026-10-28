import { describe, expect, it } from "vitest";
import { applyParamPatch } from "./apply-param-patch";

describe("applyParamPatch", () => {
  const filters = { "title~prefix": "Al", urgent: "true" };

  it("adds and replaces values", () => {
    expect(applyParamPatch(filters, { "title~prefix": "Be", quantity: "3" })).toEqual({
      "title~prefix": "Be",
      urgent: "true",
      quantity: "3",
    });
  });

  it("removes keys set to undefined or an empty string", () => {
    expect(applyParamPatch(filters, { urgent: undefined, "title~prefix": "" })).toEqual({});
  });

  it("does not mutate the input", () => {
    applyParamPatch(filters, { urgent: undefined });
    expect(filters).toEqual({ "title~prefix": "Al", urgent: "true" });
  });
});
