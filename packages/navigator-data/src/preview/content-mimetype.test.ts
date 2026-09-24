import { describe, expect, it } from "vitest";
import { isPdfMimetype, needsRendition } from "./content-mimetype";

describe("isPdfMimetype", () => {
  it("returns true for a bare application/pdf mimetype", () => {
    expect(isPdfMimetype("application/pdf")).toBe(true);
  });

  it("returns true when parameters follow a semicolon", () => {
    expect(isPdfMimetype("application/pdf; charset=binary")).toBe(true);
  });

  it("returns true for mixed/upper case", () => {
    expect(isPdfMimetype("APPLICATION/PDF")).toBe(true);
    expect(isPdfMimetype("Application/Pdf; charset=UTF-8")).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    expect(isPdfMimetype("  application/pdf  ")).toBe(true);
  });

  it("returns false for a non-PDF mimetype", () => {
    expect(isPdfMimetype("image/png")).toBe(false);
    expect(
      isPdfMimetype("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ).toBe(false);
  });

  it("returns false for the generic octet-stream placeholders", () => {
    expect(isPdfMimetype("application/octet-stream")).toBe(false);
    expect(isPdfMimetype("binary/octet-stream")).toBe(false);
  });

  it("returns false for null or undefined", () => {
    expect(isPdfMimetype(null)).toBe(false);
    expect(isPdfMimetype(undefined)).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isPdfMimetype("")).toBe(false);
  });
});

describe("needsRendition", () => {
  it("returns false for a PDF mimetype", () => {
    expect(needsRendition("application/pdf")).toBe(false);
    expect(needsRendition("application/pdf; charset=binary")).toBe(false);
  });

  it("returns true for a non-PDF mimetype", () => {
    expect(needsRendition("image/png")).toBe(true);
    expect(
      needsRendition("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ).toBe(true);
  });

  it("returns true for the generic octet-stream placeholders", () => {
    expect(needsRendition("application/octet-stream")).toBe(true);
    expect(needsRendition("binary/octet-stream")).toBe(true);
  });

  it("returns true when the mimetype is missing", () => {
    expect(needsRendition(null)).toBe(true);
    expect(needsRendition(undefined)).toBe(true);
  });
});
