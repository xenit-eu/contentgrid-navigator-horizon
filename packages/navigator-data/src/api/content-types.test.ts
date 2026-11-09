import { describe, expect, it } from "vitest";
import { parseContentDisposition } from "./content-types";

// ---------------------------------------------------------------------------
// parseContentDisposition
// ---------------------------------------------------------------------------

describe("parseContentDisposition", () => {
  it("returns null for null input", () => {
    expect(parseContentDisposition(null)).toBeNull();
  });

  it("returns null when no filename parameter", () => {
    expect(parseContentDisposition("attachment")).toBeNull();
  });

  it("parses an unquoted filename", () => {
    expect(parseContentDisposition("attachment; filename=invoice.pdf")).toBe("invoice.pdf");
  });

  it("parses a quoted filename without escapes", () => {
    expect(parseContentDisposition('attachment; filename="invoice.pdf"')).toBe("invoice.pdf");
  });

  it("parses a quoted filename with escaped double-quote", () => {
    expect(parseContentDisposition('attachment; filename="say \\"hello\\".txt"')).toBe(
      'say "hello".txt',
    );
  });

  it("parses a quoted filename with escaped backslash", () => {
    expect(parseContentDisposition('attachment; filename="path\\\\file.txt"')).toBe(
      "path\\file.txt",
    );
  });

  it("parses filename*=UTF-8'' extended notation (RFC 5987)", () => {
    expect(parseContentDisposition("attachment; filename*=UTF-8''factur%C3%A9.pdf")).toBe(
      "facturé.pdf",
    );
  });

  it("prefers filename* over filename when both are present", () => {
    expect(
      parseContentDisposition(
        "attachment; filename*=UTF-8''factur%C3%A9.pdf; filename=facture.pdf",
      ),
    ).toBe("facturé.pdf");
  });

  it("is case-insensitive for the filename parameter name", () => {
    expect(parseContentDisposition("attachment; FILENAME=invoice.pdf")).toBe("invoice.pdf");
  });
});
