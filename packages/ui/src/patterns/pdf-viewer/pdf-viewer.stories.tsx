import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import jsInPdfUrl from "./fixtures/js-in-pdf.pdf?url";
import minimalPdfUrl from "./fixtures/minimal.pdf?url";
import multiPagePdfUrl from "./fixtures/multi-page.pdf?url";
import sampleFormPdfUrl from "./fixtures/sample-form.pdf?url";
import sampleLandscapePdfUrl from "./fixtures/sample-landscape.pdf?url";
import sampleProtectedPdfUrl from "./fixtures/sample-protected.pdf?url";
import { PdfViewer } from "./pdf-viewer";
import { DEFAULT_PDF_VIEWER_LABELS } from "./pdf-viewer-labels";
import { PdfViewerHarness, StoryFrame, wasmUrl } from "./pdf-viewer-story-helpers";
import { PdfViewerToolbar } from "./pdf-viewer-toolbar";
import { type PdfViewerSearchActions, ZERO_SEARCH } from "./use-pdf-viewer-search";
import type { PdfViewerStateActions } from "./use-pdf-viewer-state";

// ---------------------------------------------------------------------------
// Mock toolbar state/actions — used by the "mocked" stories (`EngineFailure`,
// `SearchOpen`, `SearchNoResults`, `PrintReady`) that render
// `PdfViewerToolbar` directly against a hand-picked state instead of driving
// a real engine to it, matching the state exactly so the story is visually
// identical to what `PdfViewer` itself would render.
// ---------------------------------------------------------------------------

function makeMockActions(overrides: Partial<PdfViewerStateActions> = {}): PdfViewerStateActions {
  return {
    goToPage: fn(),
    previousPage: fn(),
    nextPage: fn(),
    zoomIn: fn(),
    zoomOut: fn(),
    setZoom: fn(),
    toggleFullscreen: fn(),
    print: fn(),
    ...overrides,
  };
}

function makeMockSearchActions(
  overrides: Partial<PdfViewerSearchActions> = {},
): PdfViewerSearchActions {
  return {
    setQuery: fn(),
    nextMatch: fn(),
    previousMatch: fn(),
    toggleMatchCase: fn(),
    toggleWholeWord: fn(),
    clearSearch: fn(),
    setOpen: fn(),
    ...overrides,
  };
}

const READY_PAGE = { current: 1, total: 1 };
const READY_ZOOM = { mode: "fit-width" as const, level: 100 };

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: "Patterns/PdfViewer",
  component: PdfViewer,
  tags: ["autodocs"],
  // Every story below supplies its own `render` and loads bytes itself
  // (a real engine can't take `args`-driven fixture bytes as a plain
  // control); these placeholders only satisfy the required-props shape.
  args: {
    bytes: new ArrayBuffer(0),
    filename: "document.pdf",
    wasmUrl: "",
  },
  parameters: {
    // Every story here mounts a real PDFium/WASM engine — give it room.
    chromatic: { pauseAnimationAtEnd: true },
  },
} satisfies Meta<typeof PdfViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Visual / a11y stories — no `play()`. Functional coverage (including the
// FR-026/SC-005 no-script-execution proof and the search/print controls) all
// lives in `WithInteraction` (`pdf-viewer.interaction.stories.tsx`), tagged
// `no-visual-test` and excluded from both the visual-regression and axe
// suites (a `play()`-bearing story races the a11y addon's own auto-scan
// against `AxeBuilder.analyze()` — see `apps/storybook/tests/accessibility.spec.ts`
// — and an in-flight `play()` mid-screenshot makes visual snapshots
// non-deterministic).
// ---------------------------------------------------------------------------

export const Default: Story = {
  // `async-content`: this story mounts a real PDFium/WASM engine — it is
  // `aria-busy` from its first commit (see `PdfViewerHarness`'s fixture-
  // loading placeholder) until the first page paints, and the visual harness
  // (`visual.spec.ts`) waits for that before screenshotting (ADR-009). Only
  // the stories that mount the real engine (`Default`, `MultiPage`,
  // `SampleForm`, `Landscape`, `ToolbarMinimal`, `Protected`, `Invalid`,
  // `JsInPdf`) carry this tag — the mocked stories below never
  // render `aria-busy="true"`, so the wait would be a pointless no-op there.
  tags: ["async-content"],
  render: () => (
    <StoryFrame>
      <PdfViewerHarness
        src={minimalPdfUrl}
        filename="minimal.pdf"
        wasmUrl={wasmUrl}
        onDownload={fn()}
        onDocumentOpened={fn()}
        onLoadError={fn()}
      />
    </StoryFrame>
  ),
};

/** Real engine on a two-page fixture ("Hello" / "World"): the toolbar shows "/ 2" with next enabled. */
export const MultiPage: Story = {
  // `async-content` — see `Default`.
  tags: ["async-content"],
  render: () => (
    <StoryFrame>
      <PdfViewerHarness
        src={multiPagePdfUrl}
        filename="multi-page.pdf"
        wasmUrl={wasmUrl}
        onDownload={fn()}
        onDocumentOpened={fn()}
        onLoadError={fn()}
      />
    </StoryFrame>
  ),
};

/**
 * Real engine on a one-page AcroForm fixture (text fields and a checkbox, no
 * JavaScript): shows how the viewer renders a document carrying form fields.
 */
export const SampleForm: Story = {
  // `async-content` — see `Default`.
  tags: ["async-content"],
  render: () => (
    <StoryFrame>
      <PdfViewerHarness
        src={sampleFormPdfUrl}
        filename="sample-form.pdf"
        wasmUrl={wasmUrl}
        onDownload={fn()}
        onDocumentOpened={fn()}
        onLoadError={fn()}
      />
    </StoryFrame>
  ),
};

/** Real engine on a one-page landscape (792 × 612 pt, US Letter) fixture. */
export const Landscape: Story = {
  // `async-content` — see `Default`.
  tags: ["async-content"],
  render: () => (
    <StoryFrame>
      <PdfViewerHarness
        src={sampleLandscapePdfUrl}
        filename="sample-landscape.pdf"
        wasmUrl={wasmUrl}
        onDownload={fn()}
        onDocumentOpened={fn()}
        onLoadError={fn()}
      />
    </StoryFrame>
  ),
};

export const ToolbarMinimal: Story = {
  // `async-content` — see `Default`.
  tags: ["async-content"],
  render: () => (
    <StoryFrame>
      <PdfViewerHarness
        src={minimalPdfUrl}
        filename="minimal.pdf"
        wasmUrl={wasmUrl}
        toolbar={{ zoom: false, fullscreen: false }}
      />
    </StoryFrame>
  ),
};

/**
 * Real engine on a password-protected fixture (standard security handler,
 * user password set): PDFium reports a password error, so the viewer settles
 * on its terminal `"protected"` state instead of painting a page.
 */
export const Protected: Story = {
  // `async-content` — see `Default` and `Invalid`: busy until the protected
  // message replaces the loading placeholder.
  tags: ["async-content"],
  render: () => (
    <StoryFrame>
      <PdfViewerHarness
        src={sampleProtectedPdfUrl}
        filename="sample-protected.pdf"
        wasmUrl={wasmUrl}
        onDownload={fn()}
        onLoadError={fn()}
      />
    </StoryFrame>
  ),
};

export const Invalid: Story = {
  // `async-content` — see `Default`. This one mounts the real engine too,
  // just to a terminal `"invalid"` state (busy until that message replaces
  // the loading placeholder) rather than a painted page.
  tags: ["async-content"],
  render: () => (
    <StoryFrame>
      <PdfViewer
        bytes={new TextEncoder().encode("not a pdf file, just garbage bytes").buffer}
        filename="garbage.pdf"
        wasmUrl={wasmUrl}
        onLoadError={fn()}
      />
    </StoryFrame>
  ),
};

/**
 * Mocked: verified empirically (real Chromium, ad-hoc Playwright run against
 * this story with a same-origin 404 `wasmUrl`) that a bad `wasmUrl` does
 * cause a genuine `WebAssembly.instantiate(): BufferSource argument is empty`
 * compile failure inside the engine's worker — but `usePdfiumEngine` (from
 * `@embedpdf/engines`) never surfaces it as `{ error }`: the hook's success
 * path recovers regardless, so `PdfEngineProvider`'s `status` reaches
 * `"ready"` anyway. This is the upstream #632 "engine-init failure gets
 * swallowed" issue this pattern's engine provider already documents (see
 * `pdf-engine-provider.tsx`) — there is no public prop that can deterministically
 * reproduce a `status: "error"` engine state through the real hook. This
 * story instead renders the exact fallback `PdfViewer` shows for that status.
 */
export const EngineFailure: Story = {
  render: () => (
    <StoryFrame>
      <div className="text-muted-foreground flex h-full w-full items-center justify-center p-8 text-center text-sm">
        {DEFAULT_PDF_VIEWER_LABELS.engineError}
      </div>
    </StoryFrame>
  ),
};

/**
 * Proves FR-026 / SC-005: PDFium is a WASM build with no JavaScript engine
 * compiled in, so an `/OpenAction` running `app.alert('x')` never executes.
 * The no-dialog assertion itself lives in `WithInteraction`'s `play()`; this
 * story stays a pure visual/a11y snapshot of the rendered document.
 */
export const JsInPdf: Story = {
  // `async-content` — see `Default`.
  tags: ["async-content"],
  render: () => (
    <StoryFrame>
      <PdfViewerHarness src={jsInPdfUrl} filename="js-in-pdf.pdf" wasmUrl={wasmUrl} />
    </StoryFrame>
  ),
};

/**
 * Mocked (see the note on the mock helpers above): shows the search popover open with
 * three matches found and the second one active.
 */
export const SearchOpen: Story = {
  render: () => (
    <StoryFrame>
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <PdfViewerToolbar
          showPageNavigation
          showZoom
          showSearch
          showPrint
          showFullscreen
          onDownload={fn()}
          documentState="ready"
          page={READY_PAGE}
          zoom={READY_ZOOM}
          search={{
            query: "Hello",
            total: 3,
            activeIndex: 1,
            matchCase: false,
            wholeWord: false,
            open: true,
          }}
          fullscreen={false}
          actions={makeMockActions()}
          searchActions={makeMockSearchActions()}
          labels={DEFAULT_PDF_VIEWER_LABELS}
        />
        <div className="bg-muted flex flex-1 items-center justify-center text-sm">Hello</div>
      </div>
    </StoryFrame>
  ),
};

/** Mocked (see the note on the mock helpers above): the search popover open with a query that matched nothing. */
export const SearchNoResults: Story = {
  render: () => (
    <StoryFrame>
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <PdfViewerToolbar
          showPageNavigation
          showZoom
          showSearch
          showPrint
          showFullscreen
          onDownload={fn()}
          documentState="ready"
          page={READY_PAGE}
          zoom={READY_ZOOM}
          search={{
            query: "notfound",
            total: 0,
            activeIndex: -1,
            matchCase: false,
            wholeWord: false,
            open: true,
          }}
          fullscreen={false}
          actions={makeMockActions()}
          searchActions={makeMockSearchActions()}
          labels={DEFAULT_PDF_VIEWER_LABELS}
        />
        <div className="bg-muted flex flex-1 items-center justify-center text-sm">Hello</div>
      </div>
    </StoryFrame>
  ),
};

/** Mocked (see the note on the mock helpers above): a ready document with the print control enabled. */
export const PrintReady: Story = {
  render: () => (
    <StoryFrame>
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <PdfViewerToolbar
          showPageNavigation
          showZoom
          showSearch
          showPrint
          showFullscreen
          onDownload={fn()}
          documentState="ready"
          page={READY_PAGE}
          zoom={READY_ZOOM}
          search={ZERO_SEARCH}
          fullscreen={false}
          actions={makeMockActions()}
          searchActions={makeMockSearchActions()}
          labels={DEFAULT_PDF_VIEWER_LABELS}
        />
        <div className="bg-muted flex flex-1 items-center justify-center text-sm">Hello</div>
      </div>
    </StoryFrame>
  ),
};
