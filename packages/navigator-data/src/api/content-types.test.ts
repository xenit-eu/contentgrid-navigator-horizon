import { describe, expect, it } from "vitest";
import { contentDispositionAttachment, parseContentDisposition } from "./content-types";

// ---------------------------------------------------------------------------
// contentDispositionAttachment
// ---------------------------------------------------------------------------

describe("contentDispositionAttachment — ASCII filenames", () => {
  it("emits quoted-string form for a plain ASCII filename", () => {
    expect(contentDispositionAttachment("invoice.pdf")).toBe('attachment; filename="invoice.pdf"');
  });

  it("backslash-escapes double-quote in ASCII filename", () => {
    expect(contentDispositionAttachment('say "hello".txt')).toBe(
      'attachment; filename="say \\"hello\\".txt"',
    );
  });

  it("backslash-escapes backslash in ASCII filename", () => {
    expect(contentDispositionAttachment("path\\file.txt")).toBe(
      'attachment; filename="path\\\\file.txt"',
    );
  });

  it("backslash-escapes both quote and backslash when both present", () => {
    expect(contentDispositionAttachment('a\\"b.txt')).toBe('attachment; filename="a\\\\\\"b.txt"');
  });
});

describe("contentDispositionAttachment — non-ASCII filenames (RFC 5987 / RFC 8187)", () => {
  it("emits filename*=UTF-8'' form for an accented filename", () => {
    expect(contentDispositionAttachment("facturé.pdf")).toBe(
      "attachment; filename*=UTF-8''factur%C3%A9.pdf",
    );
  });

  it("emits filename*=UTF-8'' form for a CJK filename", () => {
    expect(contentDispositionAttachment("請求書.pdf")).toBe(
      "attachment; filename*=UTF-8''%E8%AB%8B%E6%B1%82%E6%9B%B8.pdf",
    );
  });

  it("emits filename*=UTF-8'' form for an emoji filename", () => {
    expect(contentDispositionAttachment("report 🎉.txt")).toBe(
      "attachment; filename*=UTF-8''report%20%F0%9F%8E%89.txt",
    );
  });
});

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

// ---------------------------------------------------------------------------
// Round-trip: encode → parse
// ---------------------------------------------------------------------------

describe("contentDispositionAttachment + parseContentDisposition round-trip", () => {
  it("round-trips a plain ASCII filename", () => {
    const original = "invoice.pdf";
    expect(parseContentDisposition(contentDispositionAttachment(original))).toBe(original);
  });

  it("round-trips a filename with double-quote", () => {
    const original = 'say "hello".txt';
    expect(parseContentDisposition(contentDispositionAttachment(original))).toBe(original);
  });

  it("round-trips a filename with backslash", () => {
    const original = "path\\file.txt";
    expect(parseContentDisposition(contentDispositionAttachment(original))).toBe(original);
  });

  it("round-trips an accented filename via RFC 5987", () => {
    const original = "facturé.pdf";
    expect(parseContentDisposition(contentDispositionAttachment(original))).toBe(original);
  });

  it("round-trips a CJK filename via RFC 5987", () => {
    const original = "請求書.pdf";
    expect(parseContentDisposition(contentDispositionAttachment(original))).toBe(original);
  });
});
