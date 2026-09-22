import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import jsInPdfUrl from "./fixtures/js-in-pdf.pdf?url";
import minimalPdfUrl from "./fixtures/minimal.pdf?url";
import { PdfViewer } from "./pdf-viewer";
import { DEFAULT_PDF_VIEWER_LABELS } from "./pdf-viewer-labels";
import { PdfViewerHarness, StoryFrame, wasmUrl } from "./pdf-viewer-story-helpers";
import { PdfViewerToolbar } from "./pdf-viewer-toolbar";
import { type PdfViewerSearchActions, ZERO_SEARCH } from "./use-pdf-viewer-search";
import type { PdfViewerStateActions } from "./use-pdf-viewer-state";

// ---------------------------------------------------------------------------
// Mock toolbar state/actions — used by the "mocked" stories (`Protected`,
// `EngineFailure`, `SearchOpen`, `SearchNoResults`, `PrintReady`) that render
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
  // the stories that mount the real engine (`Default`, `ToolbarMinimal`,
  // `Invalid`, `JsInPdf`) carry this tag — the mocked stories below never
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
 * Mocked: producing a genuinely password-protected PDF fixture requires
 * implementing the PDF standard security handler (RC4/AES key derivation)
 * by hand, which is out of scope here. This story instead renders the exact
 * toolbar + status-message pairing `PdfViewer` renders once the engine
 * reports `documentState: "protected"`, reusing the same `PdfViewerToolbar`
 * and default labels so it is visually identical to the real state.
 */
export const Protected: Story = {
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
          documentState="protected"
          page={{ current: 0, total: 0 }}
          zoom={{ mode: "fit-width", level: 100 }}
          search={ZERO_SEARCH}
          fullscreen={false}
          actions={makeMockActions()}
          searchActions={makeMockSearchActions()}
          labels={DEFAULT_PDF_VIEWER_LABELS}
        />
        <div className="text-muted-foreground flex flex-1 items-center justify-center p-8 text-center text-sm">
          {DEFAULT_PDF_VIEWER_LABELS.protectedDocument}
        </div>
      </div>
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
 * Mocked (same rationale as `Protected`): shows the search popover open with
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

/** Mocked (same rationale as `Protected`): the search popover open with a query that matched nothing. */
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

/** Mocked (same rationale as `Protected`): a ready document with the print control enabled. */
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
