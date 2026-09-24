import { describe, expect, it } from "vitest";
import { deriveContentPreviewState } from "./derive-content-preview-state";

const BASE = {
  queryStatus: "pending" as const,
  previewSource: undefined,
  queryError: null,
  expectedOrigin: null,
  viewerLoadErrorKind: null,
};

describe("deriveContentPreviewState", () => {
  it("maps a pending query with no file to noFile", () => {
    expect(deriveContentPreviewState({ ...BASE, expectedOrigin: null })).toEqual({
      state: "noFile",
    });
  });

  it("maps a pending query expecting a stored PDF to loading", () => {
    expect(deriveContentPreviewState({ ...BASE, expectedOrigin: "stored" })).toEqual({
      state: "loading",
    });
  });

  it("maps a pending query expecting a rendition to preparingPreview", () => {
    expect(deriveContentPreviewState({ ...BASE, expectedOrigin: "rendition" })).toEqual({
      state: "preparingPreview",
    });
  });

  it("maps a successful pdf PreviewSource to ready", () => {
    expect(
      deriveContentPreviewState({
        ...BASE,
        queryStatus: "success",
        previewSource: {
          kind: "pdf",
          bytes: new ArrayBuffer(0),
          filename: "a.pdf",
          origin: "stored",
        },
      }),
    ).toEqual({ state: "ready" });
  });

  it("maps a successful noFile PreviewSource to noFile", () => {
    expect(
      deriveContentPreviewState({
        ...BASE,
        queryStatus: "success",
        previewSource: { kind: "noFile" },
      }),
    ).toEqual({ state: "noFile" });
  });

  it("maps unavailable and unsupported PreviewSource to previewUnavailable, carrying the mimetype", () => {
    expect(
      deriveContentPreviewState({
        ...BASE,
        queryStatus: "success",
        previewSource: { kind: "unavailable", mimetype: "image/png" },
      }),
    ).toEqual({ state: "previewUnavailable", mimetype: "image/png" });
    expect(
      deriveContentPreviewState({
        ...BASE,
        queryStatus: "success",
        previewSource: { kind: "unsupported", mimetype: "image/x-tiff" },
      }),
    ).toEqual({ state: "previewUnavailable", mimetype: "image/x-tiff" });
  });

  it("carries a null mimetype through unchanged when the file's mimetype is unknown", () => {
    expect(
      deriveContentPreviewState({
        ...BASE,
        queryStatus: "success",
        previewSource: { kind: "unavailable", mimetype: null },
      }),
    ).toEqual({ state: "previewUnavailable", mimetype: null });
  });

  it("maps a query error expecting a stored PDF to couldNotRetrieve, with the problem attached", () => {
    const error = new Error("boom");
    const result = deriveContentPreviewState({
      ...BASE,
      queryStatus: "error",
      queryError: error,
      expectedOrigin: "stored",
    });
    expect(result.state).toBe("couldNotRetrieve");
    expect(result.problem?.kind).toBe("unknown");
  });

  it("maps a query error expecting a rendition to couldNotPrepare", () => {
    const result = deriveContentPreviewState({
      ...BASE,
      queryStatus: "error",
      queryError: new Error("timed out"),
      expectedOrigin: "rendition",
    });
    expect(result.state).toBe("couldNotPrepare");
  });

  it("maps each viewer load-error kind, taking precedence over the query status", () => {
    expect(
      deriveContentPreviewState({
        ...BASE,
        queryStatus: "success",
        previewSource: {
          kind: "pdf",
          bytes: new ArrayBuffer(0),
          filename: "a.pdf",
          origin: "stored",
        },
        viewerLoadErrorKind: "protected",
      }),
    ).toEqual({ state: "protected" });

    expect(
      deriveContentPreviewState({
        ...BASE,
        queryStatus: "success",
        previewSource: {
          kind: "pdf",
          bytes: new ArrayBuffer(0),
          filename: "a.pdf",
          origin: "stored",
        },
        viewerLoadErrorKind: "invalid",
      }),
    ).toEqual({ state: "cannotDisplay" });

    expect(
      deriveContentPreviewState({
        ...BASE,
        queryStatus: "success",
        previewSource: {
          kind: "pdf",
          bytes: new ArrayBuffer(0),
          filename: "a.pdf",
          origin: "stored",
        },
        viewerLoadErrorKind: "engine",
      }),
    ).toEqual({ state: "viewerFailure" });
  });
});
