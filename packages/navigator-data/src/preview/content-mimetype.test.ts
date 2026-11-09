import { describe, expect, it } from "vitest";
import { nativePreviewKind, needsRendition } from "./content-mimetype";

describe("nativePreviewKind", () => {
  it("recognises a PDF whatever its case, parameters or surrounding whitespace", () => {
    expect(nativePreviewKind("application/pdf")).toBe("pdf");
    expect(nativePreviewKind("Application/Pdf; charset=UTF-8")).toBe("pdf");
    expect(nativePreviewKind("  application/pdf  ")).toBe("pdf");
  });

  it("recognises any image/* or video/* mimetype, whatever its case or parameters", () => {
    expect(nativePreviewKind("image/png")).toBe("image");
    expect(nativePreviewKind(" IMAGE/JPEG; q=0.9 ")).toBe("image");
    expect(nativePreviewKind("video/mp4")).toBe("video");
    expect(nativePreviewKind("Video/WebM; codecs=vp9")).toBe("video");
  });

  it("returns undefined for any other, generic or missing mimetype", () => {
    expect(
      nativePreviewKind("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ).toBeUndefined();
    expect(nativePreviewKind("audio/mpeg")).toBeUndefined();
    expect(nativePreviewKind("application/octet-stream")).toBeUndefined();
    expect(nativePreviewKind("")).toBeUndefined();
    expect(nativePreviewKind(null)).toBeUndefined();
    expect(nativePreviewKind(undefined)).toBeUndefined();
  });
});

describe("needsRendition", () => {
  it("returns false for a PDF mimetype", () => {
    expect(needsRendition("application/pdf")).toBe(false);
    expect(needsRendition("application/pdf; charset=binary")).toBe(false);
  });

  it("returns true for any other mimetype", () => {
    expect(
      needsRendition("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ).toBe(true);
    expect(needsRendition("text/plain")).toBe(true);
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
