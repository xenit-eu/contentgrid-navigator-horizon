import { describe, expect, it } from "vitest";
import { getRecordTableGridTemplate } from "./grid-template";

describe("getRecordTableGridTemplate", () => {
  it("returns an empty string for zero columns", () => {
    expect(getRecordTableGridTemplate(0)).toBe("");
  });

  it("gives the first column a wider track and every other data column a real minimum width", () => {
    expect(getRecordTableGridTemplate(3)).toBe(
      "minmax(200px, 1.6fr) minmax(140px, 1fr) minmax(140px, 1fr)",
    );
  });

  it("appends a fixed 72px track for the actions column when hasActions is set", () => {
    expect(getRecordTableGridTemplate(2, { hasActions: true })).toBe(
      "minmax(200px, 1.6fr) minmax(140px, 1fr) 72px",
    );
  });

  it("omits the actions track when hasActions is absent", () => {
    expect(getRecordTableGridTemplate(2)).toBe("minmax(200px, 1.6fr) minmax(140px, 1fr)");
  });
});
