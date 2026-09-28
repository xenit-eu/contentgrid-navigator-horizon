import {
  type PreviewSource,
  type ProblemDisplayModel,
  toProblemDisplayModel,
} from "@contentgrid/navigator-data";
import type { ContentPreviewState } from "./content-preview-state";

/** Which resource `useContentPreview` was expected to resolve, known synchronously from the
 * content attribute's own metadata (mimetype) — before the query itself has an answer. Drives
 * the `loading` vs `preparingPreview` distinction while pending, and the `couldNotRetrieve` vs
 * `couldNotPrepare` distinction on error (data-model.md's panel-state table). `null` when the
 * attribute holds no file at all. */
export type ContentPreviewOrigin = "stored" | "rendition";

/** The three outcomes the PDF viewer's own `onLoadError` callback reports (mirrors
 * `@contentgrid/ui`'s `PdfLoadError["kind"]` structurally — this module stays decoupled from
 * `@contentgrid/ui` types per the util layer's "no UI import" rule). */
export type ViewerLoadErrorKind = "invalid" | "protected" | "engine";

export interface DeriveContentPreviewStateInput {
  readonly queryStatus: "pending" | "error" | "success";
  readonly previewSource: PreviewSource | undefined;
  readonly queryError: Error | null;
  readonly expectedOrigin: ContentPreviewOrigin | null;
  /** Set once the mounted `PdfViewer` reports a load problem; `null` otherwise (including after
   * it has been reset for a new attribute/item — see `content-preview-panel.tsx`). */
  readonly viewerLoadErrorKind: ViewerLoadErrorKind | null;
}

export interface DerivedContentPreviewState {
  readonly state: ContentPreviewState;
  /** Present only for the two states backed by a caught query error. */
  readonly problem?: ProblemDisplayModel;
  /** Present only for `previewUnavailable` — the file's own mimetype (from `PreviewSource.
   * unavailable`/`.unsupported`), so the panel can name the file type in its message instead of
   * a generic "this file type". */
  readonly mimetype?: string | null;
}

/**
 * Pure mapping from `useContentPreview`'s query state (plus the PDF viewer's own load-error
 * callback) to data-model.md's "Content preview panel state" (FR-024). No fetching, no React.
 *
 * Order of precedence: a viewer-reported load error always wins (it can only occur once
 * `previewSource.kind === "pdf"` was already showing, so it is never stale relative to the query
 * status); then the query's own success/error/pending status.
 */
export function deriveContentPreviewState(
  input: DeriveContentPreviewStateInput,
): DerivedContentPreviewState {
  const { queryStatus, previewSource, queryError, expectedOrigin, viewerLoadErrorKind } = input;

  if (viewerLoadErrorKind !== null) {
    switch (viewerLoadErrorKind) {
      case "protected":
        return { state: "protected" };
      case "invalid":
        return { state: "cannotDisplay" };
      case "engine":
        return { state: "viewerFailure" };
    }
  }

  if (queryStatus === "success" && previewSource !== undefined) {
    switch (previewSource.kind) {
      case "pdf":
        return { state: "ready" };
      case "noFile":
        return { state: "noFile" };
      case "unavailable":
      case "unsupported":
        return { state: "previewUnavailable", mimetype: previewSource.mimetype };
    }
  }

  if (queryStatus === "error") {
    const problem = queryError ? toProblemDisplayModel(queryError) : undefined;
    // A rendition-path failure (timeout, invalid-conversion-adjacent 5xx, network) is
    // "couldNotPrepare"; a stored-PDF download failure (anything but 404 — 404 already resolves
    // the query to `noFile` inside useContentPreview, never rejects) is "couldNotRetrieve".
    return expectedOrigin === "rendition"
      ? { state: "couldNotPrepare", problem }
      : { state: "couldNotRetrieve", problem };
  }

  // Pending: no file at all resolves to `noFile` immediately in practice (useContentPreview's
  // queryFn returns synchronously for `metadata === null`), so there is nothing to "load".
  if (expectedOrigin === null) {
    return { state: "noFile" };
  }
  return expectedOrigin === "rendition" ? { state: "preparingPreview" } : { state: "loading" };
}
