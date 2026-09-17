# Contract: `PdfViewer` pattern (`@contentgrid/ui`)

Plain values and callbacks only; no Navigator data types (spec-001 `ui-standalone` contract).

```ts
export interface PdfViewerProps {
  readonly bytes: ArrayBuffer; // the document; a new reference reopens the document
  readonly filename: string; // used for print title and download label
  readonly wasmUrl: string; // absolute URL of the self-hosted pdfium.wasm
  readonly toolbar?: PdfViewerToolbarOptions | false;
  readonly initialZoom?: "fit-width" | "fit-page" | number; // default "fit-width"
  readonly onDownload?: () => void; // Download button; absent → button hidden
  readonly onDocumentOpened?: (info: { pageCount: number }) => void;
  readonly onLoadError?: (error: PdfLoadError) => void; // { kind: "invalid" | "protected" | "engine" }
  readonly fullscreenTarget?: RefObject<HTMLElement>; // element to make fullscreen; default: viewer root
  readonly labels?: Partial<PdfViewerLabels>; // all user-visible strings, translatable
  readonly className?: string;
}

export interface PdfViewerToolbarOptions {
  readonly start?: ReactNode; // slot before page navigation (feature puts the attribute selector here)
  readonly pageNavigation?: boolean; // default true
  readonly zoom?: boolean; // default true
  readonly search?: boolean; // default true
  readonly print?: boolean; // default true
  readonly fullscreen?: boolean; // default true
  readonly end?: ReactNode; // slot after the built-in actions
}
```

Also exported: `PdfEngineProvider({ wasmUrl, children })` (one engine per subtree; the viewer creates
one when not wrapped), `PdfViewerErrorBoundary` (renders `fallback(error, reset)`), `PdfViewerLabels`.

## Behaviour

- Toolbar order (mockup): `start` slot · previous page · "current / total" (editable, Enter jumps) ·
  next page · zoom out · level · zoom in · zoom menu (25–400 %, fit width, fit page) · spacer · search ·
  print · download · fullscreen · `end` slot.
- Page indicator follows scrolling; previous/next disabled at bounds; controls disabled until opened.
- Search: popover with input, "n of m", previous/next, Enter / Shift+Enter, match-case and whole-word
  toggles, clear; active match scrolled into view; search emphasis styled distinctly from selection.
- Print prints the displayed document (all pages) through the print plugin.
- Fullscreen uses the native Fullscreen API; zoom mode is preserved across enter/exit.
- Text selection and copy enabled (selection plugin); no annotation, form or editing plugin loaded.
- Scripting: the engine is PDFium/WASM; the story `js-in-pdf` proves no script executes (FR-026).
- Accessibility: every control is a `<button>`/`<input>` with a label; focus visible; page/zoom/search
  changes announced through an `aria-live="polite"` region; keyboard shortcuts documented in labels.
- Failure containment: any exception thrown by the engine or plugins is caught by
  `PdfViewerErrorBoundary`; the host renders its own fallback (FR-025).

## Non-goals

No fetching (bytes are handed in), no knowledge of content attributes, entities, renditions or
authentication; no persistence of viewer state.

## Stories (Storybook, `pdf-viewer.stories.tsx`)

`Default`, `ToolbarMinimal`, `SearchOpen`, `Protected`, `Invalid`, `EngineFailure`, `JsInPdf`
(asserts no dialog), each with `play()` exercising the controls; visual snapshots at large and small
viewports; a11y run over all.
