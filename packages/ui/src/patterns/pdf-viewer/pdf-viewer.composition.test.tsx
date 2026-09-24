/**
 * Mounts the real `PdfViewer` composition tree (`PdfViewerFromAmbientEngine`
 * -> `PdfViewerWithEngine` -> `PdfViewerBody` -> `PdfViewerActiveSession`/
 * `PdfViewerChrome`) with every `@embedpdf/*` plugin package/component and
 * the `use-pdf-viewer-state`/`use-pdf-viewer-document-lifecycle` hooks
 * replaced by trivial, controllable stubs. `pdf-viewer.test.tsx` already
 * covers each of those hooks (and the toolbar, error boundary, and
 * `PdfViewerStatusMessage`/`useFirstPagePainted`) in isolation — this file
 * exists only to exercise the composition/dispatch logic in `pdf-viewer.tsx`
 * itself (engine status dispatch, ambient-vs-own-provider, the `!documentId`
 * placeholder chrome, `onLoadError` wiring) that can't be reached without
 * mounting the real component tree.
 */
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Imported after the mocks above so the mocked modules are in place first.
import { PdfEngineProvider } from "./pdf-engine-provider";
import { PdfViewer } from "./pdf-viewer";
import { DEFAULT_PDF_VIEWER_LABELS } from "./pdf-viewer-labels";

// ---------------------------------------------------------------------------
// Controllable mocks (vi.hoisted so the vi.mock factories below, which are
// themselves hoisted above these imports/consts by Vitest, can close over
// them).
// ---------------------------------------------------------------------------

const {
  mockUsePdfiumEngine,
  mockUseDocumentLifecycle,
  mockUsePdfViewerActiveState,
  mockPluginsReady,
  NOOP_ACTIONS,
  NOOP_SEARCH_ACTIONS,
  ZERO_PAGE,
  ZERO_ZOOM,
  ZERO_SEARCH,
} = vi.hoisted(() => ({
  mockUsePdfiumEngine: vi.fn(),
  mockUseDocumentLifecycle: vi.fn(),
  mockUsePdfViewerActiveState: vi.fn(),
  mockPluginsReady: vi.fn(() => true),
  // Real values — plain data/no-ops, not part of what this file tests, but
  // `pdf-viewer.tsx` imports and uses them directly (the `!documentId`
  // fallback chrome, and `usePdfViewerPlugins`'s default-zoom-level calc).
  // Defined here (not as ordinary top-level consts) so the `vi.mock`
  // factories below — hoisted above everything else in this file — can
  // reference them without a temporal-dead-zone error.
  NOOP_ACTIONS: {
    goToPage: () => {},
    previousPage: () => {},
    nextPage: () => {},
    zoomIn: () => {},
    zoomOut: () => {},
    setZoom: () => {},
    toggleFullscreen: () => {},
    print: () => {},
  },
  NOOP_SEARCH_ACTIONS: {
    setQuery: () => {},
    nextMatch: () => {},
    previousMatch: () => {},
    toggleMatchCase: () => {},
    toggleWholeWord: () => {},
    clearSearch: () => {},
    setOpen: () => {},
  },
  ZERO_PAGE: { current: 0, total: 0 },
  ZERO_ZOOM: { mode: "fit-width" as const, level: 0 },
  ZERO_SEARCH: {
    query: "",
    total: 0,
    activeIndex: -1,
    matchCase: false,
    wholeWord: false,
    open: false,
  },
}));

vi.mock("@embedpdf/engines/react", () => ({
  usePdfiumEngine: (config: unknown) => mockUsePdfiumEngine(config),
}));

vi.mock("@embedpdf/core/react", () => ({
  EmbedPDF: ({ children }: { children: (arg: { pluginsReady: boolean }) => ReactNode }) =>
    children({ pluginsReady: mockPluginsReady() }),
}));

vi.mock("@embedpdf/plugin-document-manager/react", () => ({
  DocumentManagerPluginPackage: { id: "document-manager" },
}));

vi.mock("@embedpdf/plugin-interaction-manager/react", () => ({
  InteractionManagerPluginPackage: { id: "interaction-manager" },
  GlobalPointerProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="global-pointer-provider">{children}</div>
  ),
  PagePointerProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="page-pointer-provider">{children}</div>
  ),
}));

vi.mock("@embedpdf/plugin-print/react", () => ({
  PrintPluginPackage: { id: "print" },
}));

vi.mock("@embedpdf/plugin-render/react", () => ({
  RenderPluginPackage: { id: "render" },
  RenderLayer: () => <div data-testid="render-layer" />,
}));

vi.mock("@embedpdf/plugin-scroll/react", () => ({
  ScrollPluginPackage: { id: "scroll" },
  ScrollStrategy: { Vertical: "vertical" },
  // Calls `renderPage` once (page 0) so the RenderLayer/SelectionLayer/
  // SearchLayer stubs it wraps actually render, matching what the real
  // Scroller does once a document has pages.
  Scroller: ({ renderPage }: { renderPage: (arg: { pageIndex: number }) => ReactNode }) => (
    <div data-testid="scroller">{renderPage({ pageIndex: 0 })}</div>
  ),
}));

vi.mock("@embedpdf/plugin-search/react", () => ({
  SearchPluginPackage: { id: "search" },
  SearchLayer: () => <div data-testid="search-layer" />,
}));

vi.mock("@embedpdf/plugin-selection/react", () => ({
  SelectionPluginPackage: { id: "selection" },
  SelectionLayer: () => <div data-testid="selection-layer" />,
}));

vi.mock("@embedpdf/plugin-viewport/react", () => ({
  ViewportPluginPackage: { id: "viewport" },
  Viewport: ({ children }: { children: ReactNode }) => <div data-testid="viewport">{children}</div>,
}));

vi.mock("@embedpdf/plugin-zoom/react", () => ({
  ZoomPluginPackage: { id: "zoom" },
}));

vi.mock("./use-pdf-viewer-state", () => ({
  useDocumentLifecycle: (...args: unknown[]) => mockUseDocumentLifecycle(...args),
  usePdfViewerActiveState: (...args: unknown[]) => mockUsePdfViewerActiveState(...args),
  NOOP_ACTIONS,
  NOOP_SEARCH_ACTIONS,
  ZERO_PAGE,
  ZERO_ZOOM,
  ZERO_SEARCH,
  zoomInputToLevel: () => 1,
}));

const READY_ACTIVE_STATE = {
  page: { current: 1, total: 3 },
  zoom: { mode: "fit-width" as const, level: 100 },
  search: ZERO_SEARCH,
  fullscreen: false,
  actions: NOOP_ACTIONS,
  searchActions: NOOP_SEARCH_ACTIONS,
};

function mockEngineReady() {
  mockUsePdfiumEngine.mockReturnValue({
    engine: { id: "mock-engine" },
    isLoading: false,
    error: null,
  });
}

const BYTES = new ArrayBuffer(4);

beforeEach(() => {
  mockUsePdfiumEngine.mockReset();
  mockUseDocumentLifecycle.mockReset();
  mockUsePdfViewerActiveState.mockReset().mockReturnValue(READY_ACTIVE_STATE);
  mockPluginsReady.mockReset().mockReturnValue(true);
  mockEngineReady();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PdfViewer composition — engine status dispatch", () => {
  it("shows the opening message with aria-busy while the engine is still loading", () => {
    mockUsePdfiumEngine.mockReturnValue({ engine: null, isLoading: true, error: null });
    mockUseDocumentLifecycle.mockReturnValue({ documentId: null, documentState: "idle" });

    render(<PdfViewer bytes={BYTES} filename="a.pdf" wasmUrl="https://example.test/pdfium.wasm" />);

    const message = screen.getByText(DEFAULT_PDF_VIEWER_LABELS.openingDocument);
    expect(message).toHaveAttribute("aria-busy", "true");
  });

  it("shows the engine-error message (not busy) and calls onLoadError once with kind: engine", () => {
    mockUsePdfiumEngine.mockReturnValue({
      engine: null,
      isLoading: false,
      error: new Error("wasm fetch failed"),
    });
    mockUseDocumentLifecycle.mockReturnValue({ documentId: null, documentState: "idle" });
    const onLoadError = vi.fn();

    render(
      <PdfViewer
        bytes={BYTES}
        filename="a.pdf"
        wasmUrl="https://example.test/pdfium.wasm"
        onLoadError={onLoadError}
      />,
    );

    const message = screen.getByText(DEFAULT_PDF_VIEWER_LABELS.engineError);
    expect(message).toHaveAttribute("aria-busy", "false");
    expect(onLoadError).toHaveBeenCalledTimes(1);
    expect(onLoadError).toHaveBeenCalledWith({ kind: "engine" });
  });

  it("shows an opening PdfViewerStatusMessage while plugins are not yet ready, even though the engine is", () => {
    mockPluginsReady.mockReturnValue(false);
    mockUseDocumentLifecycle.mockReturnValue({ documentId: null, documentState: "idle" });

    render(<PdfViewer bytes={BYTES} filename="a.pdf" wasmUrl="https://example.test/pdfium.wasm" />);

    expect(screen.getByText(DEFAULT_PDF_VIEWER_LABELS.openingDocument)).toBeInTheDocument();
    // The document-lifecycle hook (and everything downstream of it) is never
    // reached until plugins are ready.
    expect(mockUseDocumentLifecycle).not.toHaveBeenCalled();
  });
});

describe("PdfViewer composition — document phases (plugins ready, no document id yet)", () => {
  it.each([
    ["protected", DEFAULT_PDF_VIEWER_LABELS.protectedDocument],
    ["invalid", DEFAULT_PDF_VIEWER_LABELS.invalidDocument],
    ["opening", DEFAULT_PDF_VIEWER_LABELS.openingDocument],
  ] as const)(
    "renders the %s status message and disables toolbar controls",
    (documentState, text) => {
      mockUseDocumentLifecycle.mockReturnValue({ documentId: null, documentState });

      render(
        <PdfViewer bytes={BYTES} filename="a.pdf" wasmUrl="https://example.test/pdfium.wasm" />,
      );

      expect(screen.getByText(text)).toBeInTheDocument();
      // The `!documentId` placeholder chrome (ZERO_PAGE/NOOP_ACTIONS) still
      // renders the toolbar — every control on it disabled, since `ready` is
      // false for every phase here.
      expect(screen.getByLabelText(DEFAULT_PDF_VIEWER_LABELS.previousPage)).toBeDisabled();
      expect(screen.getByLabelText(DEFAULT_PDF_VIEWER_LABELS.zoomIn)).toBeDisabled();
    },
  );

  it.each(["protected", "invalid"] as const)(
    "calls onLoadError exactly once with kind: %s, not again on re-render",
    (documentState) => {
      mockUseDocumentLifecycle.mockReturnValue({ documentId: null, documentState });
      const onLoadError = vi.fn();

      const { rerender } = render(
        <PdfViewer
          bytes={BYTES}
          filename="a.pdf"
          wasmUrl="https://example.test/pdfium.wasm"
          onLoadError={onLoadError}
        />,
      );
      rerender(
        <PdfViewer
          bytes={BYTES}
          filename="a.pdf"
          wasmUrl="https://example.test/pdfium.wasm"
          onLoadError={onLoadError}
        />,
      );

      expect(onLoadError).toHaveBeenCalledTimes(1);
      expect(onLoadError).toHaveBeenCalledWith({ kind: documentState });
    },
  );

  it("omits the toolbar entirely when toolbar={false}", () => {
    mockUseDocumentLifecycle.mockReturnValue({ documentId: null, documentState: "opening" });

    render(
      <PdfViewer
        bytes={BYTES}
        filename="a.pdf"
        wasmUrl="https://example.test/pdfium.wasm"
        toolbar={false}
      />,
    );

    expect(screen.queryByLabelText(DEFAULT_PDF_VIEWER_LABELS.previousPage)).not.toBeInTheDocument();
  });
});

describe("PdfViewer composition — ready document (real document id)", () => {
  beforeEach(() => {
    mockUseDocumentLifecycle.mockReturnValue({ documentId: "doc-1", documentState: "ready" });
  });

  it("marks the content area aria-busy until the first page paints", () => {
    render(<PdfViewer bytes={BYTES} filename="a.pdf" wasmUrl="https://example.test/pdfium.wasm" />);

    // `useFirstPagePainted` starts unpainted; nothing here dispatches an
    // <img> load, so the content-area div (the ancestor with `aria-busy` —
    // several stub layers up from the Scroller) stays busy for the life of
    // the test — asserting the initial (and only reachable-without-a-real
    // -image) state this composition can produce.
    const scroller = screen.getByTestId("scroller");
    const contentArea = scroller.closest("[aria-busy]");
    expect(contentArea).toHaveAttribute("aria-busy", "true");
  });

  it("mounts the real page tree (Viewport/Scroller/RenderLayer/SelectionLayer/SearchLayer) via PdfViewerActiveSession", () => {
    render(<PdfViewer bytes={BYTES} filename="a.pdf" wasmUrl="https://example.test/pdfium.wasm" />);

    expect(mockUsePdfViewerActiveState).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: "doc-1", documentState: "ready" }),
    );
    const viewport = screen.getByTestId("viewport");
    expect(within(viewport).getByTestId("render-layer")).toBeInTheDocument();
    expect(within(viewport).getByTestId("selection-layer")).toBeInTheDocument();
    expect(within(viewport).getByTestId("search-layer")).toBeInTheDocument();
  });

  it("enables toolbar controls once ready", () => {
    render(<PdfViewer bytes={BYTES} filename="a.pdf" wasmUrl="https://example.test/pdfium.wasm" />);

    expect(screen.getByLabelText(DEFAULT_PDF_VIEWER_LABELS.zoomIn)).toBeEnabled();
  });

  it("never reports onLoadError for a ready document", () => {
    const onLoadError = vi.fn();
    render(
      <PdfViewer
        bytes={BYTES}
        filename="a.pdf"
        wasmUrl="https://example.test/pdfium.wasm"
        onLoadError={onLoadError}
      />,
    );
    expect(onLoadError).not.toHaveBeenCalled();
  });
});

describe("PdfViewer composition — engine sharing (one engine per subtree)", () => {
  it("creates its own PdfEngineProvider when not already wrapped by one", () => {
    mockUseDocumentLifecycle.mockReturnValue({ documentId: null, documentState: "idle" });

    render(<PdfViewer bytes={BYTES} filename="a.pdf" wasmUrl="https://example.test/pdfium.wasm" />);

    expect(mockUsePdfiumEngine).toHaveBeenCalledTimes(1);
  });

  it("reuses the ambient engine instead of creating a second one when already wrapped", () => {
    mockUseDocumentLifecycle.mockReturnValue({ documentId: null, documentState: "idle" });

    render(
      <PdfEngineProvider wasmUrl="https://example.test/pdfium.wasm">
        <PdfViewer bytes={BYTES} filename="a.pdf" wasmUrl="unused-ambient-engine-present" />
      </PdfEngineProvider>,
    );

    // Exactly one engine for the whole subtree: the ambient provider's own
    // call. If `PdfViewer` ignored the ambient status and created a second
    // `PdfEngineProvider`, this would be 2.
    expect(mockUsePdfiumEngine).toHaveBeenCalledTimes(1);
  });

  it("two PdfViewers sharing one ambient PdfEngineProvider still create only one engine", () => {
    mockUseDocumentLifecycle.mockReturnValue({ documentId: null, documentState: "idle" });

    render(
      <PdfEngineProvider wasmUrl="https://example.test/pdfium.wasm">
        <PdfViewer bytes={BYTES} filename="a.pdf" wasmUrl="unused" />
        <PdfViewer bytes={BYTES} filename="b.pdf" wasmUrl="unused" />
      </PdfEngineProvider>,
    );

    expect(mockUsePdfiumEngine).toHaveBeenCalledTimes(1);
  });
});

describe("PdfViewer composition — labels override", () => {
  it("merges caller-supplied label overrides with the defaults", () => {
    mockUsePdfiumEngine.mockReturnValue({ engine: null, isLoading: true, error: null });
    mockUseDocumentLifecycle.mockReturnValue({ documentId: null, documentState: "idle" });

    render(
      <PdfViewer
        bytes={BYTES}
        filename="a.pdf"
        wasmUrl="https://example.test/pdfium.wasm"
        labels={{ openingDocument: "Custom loading…" }}
      />,
    );

    expect(screen.getByText("Custom loading…")).toBeInTheDocument();
    expect(screen.queryByText(DEFAULT_PDF_VIEWER_LABELS.openingDocument)).not.toBeInTheDocument();
  });
});
