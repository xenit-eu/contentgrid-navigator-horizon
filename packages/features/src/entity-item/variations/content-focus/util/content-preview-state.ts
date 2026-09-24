/**
 * Data-model.md's "Content preview panel state" — derived (never stored) from
 * `useContentPreview`'s query status × `PreviewSource`, or from the PDF viewer's own callbacks
 * (`cannotDisplay`/`protected`/`viewerFailure`). See spec `002-pdf-viewer` FR-024.
 *
 * Lives in `util/` (not `components/`) so `derive-content-preview-state.ts` — a pure function —
 * can share this type without a util module importing from `components/` (forbidden by
 * spec-001's `feature-layer-imports.md`). `ContentPreviewFrame` (a component) imports it from
 * here instead of declaring its own copy.
 */
export type ContentPreviewState =
  | "noFile"
  | "loading"
  | "preparingPreview"
  | "ready"
  | "previewUnavailable"
  | "couldNotPrepare"
  | "couldNotRetrieve"
  | "cannotDisplay"
  | "protected"
  | "viewerFailure";

/** The states data-model.md marks with an error message + optional Retry action. */
export type ErrorPreviewState = Exclude<
  ContentPreviewState,
  "noFile" | "loading" | "preparingPreview" | "ready"
>;

/** data-model.md's "Content preview panel state" table — which error states offer Retry. */
export const RETRYABLE_PREVIEW_STATES: ReadonlySet<ErrorPreviewState> = new Set([
  "couldNotPrepare",
  "couldNotRetrieve",
  "viewerFailure",
]);
