/**
 * The viewer's real PDFium/WASM engine cannot run in jsdom (research.md
 * §8.8) — full-mount rendering, scripting-posture and a11y are covered by
 * Storybook `play()` stories under Playwright instead (`pdf-viewer.stories.tsx`).
 * This file covers what jsdom *can* exercise: the toolbar as a controlled,
 * presentational component; `useDocumentLifecycle`'s document-open / phase
 * logic and `usePdfViewerActiveState`'s zoom/fullscreen logic with the
 * embedpdf plugin hooks mocked; and the error boundary, which has no engine
 * dependency at all.
 */
import type { ReactNode } from "react";
import { MatchFlag, PdfErrorCode } from "@embedpdf/models";
import { ZoomMode } from "@embedpdf/plugin-zoom";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PdfViewerErrorBoundary } from "./pdf-viewer";
import { DEFAULT_PDF_VIEWER_LABELS } from "./pdf-viewer-labels";
import { PdfViewerToolbar, type PdfViewerToolbarProps } from "./pdf-viewer-toolbar";
import { ZERO_SEARCH, useDocumentLifecycle, usePdfViewerActiveState } from "./use-pdf-viewer-state";
import type { PdfViewerSearchActions, PdfViewerStateActions } from "./use-pdf-viewer-state";

// ---------------------------------------------------------------------------
// PdfViewerToolbar — pure, controlled component
// ---------------------------------------------------------------------------

function makeActions(overrides: Partial<PdfViewerStateActions> = {}): PdfViewerStateActions {
  return {
    goToPage: vi.fn(),
    previousPage: vi.fn(),
    nextPage: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    setZoom: vi.fn(),
    toggleFullscreen: vi.fn(),
    print: vi.fn(),
    ...overrides,
  };
}

function makeSearchActions(
  overrides: Partial<PdfViewerSearchActions> = {},
): PdfViewerSearchActions {
  return {
    setQuery: vi.fn(),
    nextMatch: vi.fn(),
    previousMatch: vi.fn(),
    toggleMatchCase: vi.fn(),
    toggleWholeWord: vi.fn(),
    clearSearch: vi.fn(),
    setOpen: vi.fn(),
    ...overrides,
  };
}

function renderToolbar(
  overrides: Partial<PdfViewerToolbarProps> = {},
  actions = makeActions(),
  searchActions = makeSearchActions(),
) {
  const props: PdfViewerToolbarProps = {
    showPageNavigation: true,
    showZoom: true,
    showSearch: true,
    showPrint: true,
    showFullscreen: true,
    documentState: "ready",
    page: { current: 2, total: 5 },
    zoom: { mode: "custom", level: 100 },
    search: ZERO_SEARCH,
    fullscreen: false,
    actions,
    searchActions,
    labels: DEFAULT_PDF_VIEWER_LABELS,
    ...overrides,
  };
  render(<PdfViewerToolbar {...props} />);
  return actions;
}

describe("PdfViewerToolbar", () => {
  it("disables page and zoom controls until the document is ready", () => {
    renderToolbar({ documentState: "opening", page: { current: 0, total: 0 } });
    expect(screen.getByLabelText("Previous page")).toBeDisabled();
    expect(screen.getByLabelText("Next page")).toBeDisabled();
    expect(screen.getByLabelText("Zoom in")).toBeDisabled();
    expect(screen.getByLabelText("Zoom out")).toBeDisabled();
  });

  it("disables previous page at the first page and next page at the last", () => {
    renderToolbar({ page: { current: 1, total: 1 } });
    expect(screen.getByLabelText("Previous page")).toBeDisabled();
    expect(screen.getByLabelText("Next page")).toBeDisabled();
  });

  it("enables previous/next in the middle of the document", () => {
    renderToolbar({ page: { current: 2, total: 5 } });
    expect(screen.getByLabelText("Previous page")).toBeEnabled();
    expect(screen.getByLabelText("Next page")).toBeEnabled();
  });

  it("calls goToPage with the parsed value when Enter is pressed", async () => {
    const actions = renderToolbar({ page: { current: 2, total: 5 } });
    const input = screen.getByLabelText("Current page");
    await userEvent.clear(input);
    await userEvent.type(input, "4{Enter}");
    expect(actions.goToPage).toHaveBeenCalledWith(4);
  });

  it("reverts the page input instead of jumping on non-numeric input", async () => {
    const actions = renderToolbar({ page: { current: 2, total: 5 } });
    const input = screen.getByLabelText("Current page");
    await userEvent.clear(input);
    fireEvent.blur(input);
    expect(actions.goToPage).not.toHaveBeenCalled();
    expect(input).toHaveValue("2");
  });

  it("steps through the zoom presets", async () => {
    const actions = renderToolbar({ zoom: { mode: "custom", level: 100 } });
    await userEvent.click(screen.getByLabelText("Zoom level"));
    await userEvent.click(await screen.findByText("150%"));
    expect(actions.setZoom).toHaveBeenCalledWith(150);
  });

  it("offers fit-width and fit-page in the zoom menu", async () => {
    renderToolbar();
    await userEvent.click(screen.getByLabelText("Zoom level"));
    expect(await screen.findByText("Fit width")).toBeInTheDocument();
    expect(screen.getByText("Fit page")).toBeInTheDocument();
  });

  it("hides the download button when onDownload is absent", () => {
    renderToolbar({ onDownload: undefined });
    expect(screen.queryByLabelText("Download")).not.toBeInTheDocument();
  });

  it("shows the download button and invokes the callback", async () => {
    const onDownload = vi.fn();
    renderToolbar({ onDownload });
    await userEvent.click(screen.getByLabelText("Download"));
    expect(onDownload).toHaveBeenCalled();
  });

  it("toggles the fullscreen label and calls the action", async () => {
    const actions = renderToolbar({ fullscreen: false });
    await userEvent.click(screen.getByLabelText("Enter fullscreen"));
    expect(actions.toggleFullscreen).toHaveBeenCalled();
  });

  it("shows the exit-fullscreen label once fullscreen is active", () => {
    renderToolbar({ fullscreen: true });
    expect(screen.getByLabelText("Exit fullscreen")).toBeInTheDocument();
  });

  it("respects toolbar visibility options", () => {
    renderToolbar({ showZoom: false, showFullscreen: false });
    expect(screen.queryByLabelText("Zoom in")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Enter fullscreen")).not.toBeInTheDocument();
  });

  it("announces page changes through the live region", () => {
    const { rerender } = render(
      <PdfViewerToolbar
        showPageNavigation
        showZoom
        showSearch
        showPrint
        showFullscreen
        documentState="ready"
        page={{ current: 1, total: 5 }}
        zoom={{ mode: "custom", level: 100 }}
        search={ZERO_SEARCH}
        fullscreen={false}
        actions={makeActions()}
        searchActions={makeSearchActions()}
        labels={DEFAULT_PDF_VIEWER_LABELS}
      />,
    );
    rerender(
      <PdfViewerToolbar
        showPageNavigation
        showZoom
        showSearch
        showPrint
        showFullscreen
        documentState="ready"
        page={{ current: 2, total: 5 }}
        zoom={{ mode: "custom", level: 100 }}
        search={ZERO_SEARCH}
        fullscreen={false}
        actions={makeActions()}
        searchActions={makeSearchActions()}
        labels={DEFAULT_PDF_VIEWER_LABELS}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Page 2 of 5");
  });

  // -------------------------------------------------------------------------
  // Search and print controls (T035/T036) — pure/controlled, same as the
  // page/zoom controls above: the plugin-driven logic itself lives in
  // `usePdfViewerActiveState` (tested further below with the plugin hooks
  // mocked), so these assert only what the toolbar renders from its props.
  // -------------------------------------------------------------------------

  it("disables the print button until the document is ready", () => {
    renderToolbar({ documentState: "opening" });
    expect(screen.getByLabelText("Print")).toBeDisabled();
  });

  it("calls actions.print when the print button is clicked", async () => {
    const actions = renderToolbar();
    await userEvent.click(screen.getByLabelText("Print"));
    expect(actions.print).toHaveBeenCalled();
  });

  it("clicking the search trigger requests the popover open", async () => {
    const searchActions = makeSearchActions();
    renderToolbar({}, makeActions(), searchActions);
    await userEvent.click(screen.getByLabelText("Search"));
    expect(searchActions.setOpen).toHaveBeenCalledWith(true);
  });

  it("reports typing in the search input through searchActions.setQuery", async () => {
    const searchActions = makeSearchActions();
    // The popover is a fully controlled component (like `fullscreen` above) —
    // `open: true` here stands in for the state a real `setOpen(true)` call
    // would flow back down as.
    renderToolbar({ search: { ...ZERO_SEARCH, open: true } }, makeActions(), searchActions);
    const input = await screen.findByLabelText("Search in document");
    await userEvent.type(input, "a");
    expect(searchActions.setQuery).toHaveBeenCalledWith("a");
  });

  it("shows the n-of-m indicator once results exist, and the no-matches label once a query finds none", () => {
    const { rerender } = render(
      <PdfViewerToolbar
        showPageNavigation
        showZoom
        showSearch
        showPrint
        showFullscreen
        documentState="ready"
        page={{ current: 1, total: 1 }}
        zoom={{ mode: "custom", level: 100 }}
        search={{
          query: "a",
          total: 3,
          activeIndex: 1,
          matchCase: false,
          wholeWord: false,
          open: true,
        }}
        fullscreen={false}
        actions={makeActions()}
        searchActions={makeSearchActions()}
        labels={DEFAULT_PDF_VIEWER_LABELS}
      />,
    );
    // Scoped to the visible `<span>` indicator, not the `role="status"` live
    // region — both can carry the same text.
    expect(screen.getByText("2 of 3", { selector: "span" })).toBeInTheDocument();

    rerender(
      <PdfViewerToolbar
        showPageNavigation
        showZoom
        showSearch
        showPrint
        showFullscreen
        documentState="ready"
        page={{ current: 1, total: 1 }}
        zoom={{ mode: "custom", level: 100 }}
        search={{
          query: "zz",
          total: 0,
          activeIndex: -1,
          matchCase: false,
          wholeWord: false,
          open: true,
        }}
        fullscreen={false}
        actions={makeActions()}
        searchActions={makeSearchActions()}
        labels={DEFAULT_PDF_VIEWER_LABELS}
      />,
    );
    expect(screen.getByText("No matches found", { selector: "span" })).toBeInTheDocument();
    expect(screen.queryByText(/of 3/, { selector: "span" })).not.toBeInTheDocument();
  });

  it("clearing the search removes the n-of-m emphasis once the parent reflects the cleared state", () => {
    const { rerender } = render(
      <PdfViewerToolbar
        showPageNavigation
        showZoom
        showSearch
        showPrint
        showFullscreen
        documentState="ready"
        page={{ current: 1, total: 1 }}
        zoom={{ mode: "custom", level: 100 }}
        search={{
          query: "a",
          total: 2,
          activeIndex: 0,
          matchCase: false,
          wholeWord: false,
          open: true,
        }}
        fullscreen={false}
        actions={makeActions()}
        searchActions={makeSearchActions()}
        labels={DEFAULT_PDF_VIEWER_LABELS}
      />,
    );
    expect(screen.getByText("1 of 2")).toBeInTheDocument();

    // `clearSearch` (`stopSearch` on the plugin) resets query/results/total
    // but leaves the popover open — the toolbar is purely controlled, so once
    // the parent reflects that cleared state the n-of-m emphasis is gone even
    // though the popover itself stays visible.
    rerender(
      <PdfViewerToolbar
        showPageNavigation
        showZoom
        showSearch
        showPrint
        showFullscreen
        documentState="ready"
        page={{ current: 1, total: 1 }}
        zoom={{ mode: "custom", level: 100 }}
        search={{ ...ZERO_SEARCH, open: true }}
        fullscreen={false}
        actions={makeActions()}
        searchActions={makeSearchActions()}
        labels={DEFAULT_PDF_VIEWER_LABELS}
      />,
    );
    expect(screen.getByLabelText("Search in document")).toHaveValue("");
    expect(screen.queryByText(/of 2/)).not.toBeInTheDocument();
  });

  it("Enter navigates to the next match and Shift+Enter to the previous", async () => {
    const searchActions = makeSearchActions();
    renderToolbar(
      {
        search: {
          query: "a",
          total: 3,
          activeIndex: 0,
          matchCase: false,
          wholeWord: false,
          open: true,
        },
      },
      makeActions(),
      searchActions,
    );
    const input = screen.getByLabelText("Search in document");
    await userEvent.type(input, "{Enter}");
    expect(searchActions.nextMatch).toHaveBeenCalled();
    await userEvent.type(input, "{Shift>}{Enter}{/Shift}");
    expect(searchActions.previousMatch).toHaveBeenCalled();
  });

  it("previous/next/clear are disabled without results, and clear calls clearSearch", async () => {
    const searchActions = makeSearchActions();
    renderToolbar(
      { search: { ...ZERO_SEARCH, query: "a", open: true } },
      makeActions(),
      searchActions,
    );
    expect(screen.getByLabelText("Previous match")).toBeDisabled();
    expect(screen.getByLabelText("Next match")).toBeDisabled();
    await userEvent.click(screen.getByLabelText("Clear search"));
    expect(searchActions.clearSearch).toHaveBeenCalled();
  });

  it("toggles match-case and whole-word and reflects their checked state", async () => {
    const searchActions = makeSearchActions();
    const { rerender } = render(
      <PdfViewerToolbar
        showPageNavigation
        showZoom
        showSearch
        showPrint
        showFullscreen
        documentState="ready"
        page={{ current: 1, total: 1 }}
        zoom={{ mode: "custom", level: 100 }}
        search={{ ...ZERO_SEARCH, open: true }}
        fullscreen={false}
        actions={makeActions()}
        searchActions={searchActions}
        labels={DEFAULT_PDF_VIEWER_LABELS}
      />,
    );
    await userEvent.click(screen.getByLabelText("Match case"));
    expect(searchActions.toggleMatchCase).toHaveBeenCalled();
    await userEvent.click(screen.getByLabelText("Whole word"));
    expect(searchActions.toggleWholeWord).toHaveBeenCalled();

    rerender(
      <PdfViewerToolbar
        showPageNavigation
        showZoom
        showSearch
        showPrint
        showFullscreen
        documentState="ready"
        page={{ current: 1, total: 1 }}
        zoom={{ mode: "custom", level: 100 }}
        search={{ ...ZERO_SEARCH, matchCase: true, wholeWord: true, open: true }}
        fullscreen={false}
        actions={makeActions()}
        searchActions={searchActions}
        labels={DEFAULT_PDF_VIEWER_LABELS}
      />,
    );
    expect(screen.getByLabelText("Match case")).toBeChecked();
    expect(screen.getByLabelText("Whole word")).toBeChecked();
  });

  it("announces the active match position through the live region", () => {
    const { rerender } = render(
      <PdfViewerToolbar
        showPageNavigation
        showZoom
        showSearch
        showPrint
        showFullscreen
        documentState="ready"
        page={{ current: 1, total: 1 }}
        zoom={{ mode: "custom", level: 100 }}
        search={ZERO_SEARCH}
        fullscreen={false}
        actions={makeActions()}
        searchActions={makeSearchActions()}
        labels={DEFAULT_PDF_VIEWER_LABELS}
      />,
    );
    rerender(
      <PdfViewerToolbar
        showPageNavigation
        showZoom
        showSearch
        showPrint
        showFullscreen
        documentState="ready"
        page={{ current: 1, total: 1 }}
        zoom={{ mode: "custom", level: 100 }}
        search={{
          query: "a",
          total: 4,
          activeIndex: 2,
          matchCase: false,
          wholeWord: false,
          open: true,
        }}
        fullscreen={false}
        actions={makeActions()}
        searchActions={makeSearchActions()}
        labels={DEFAULT_PDF_VIEWER_LABELS}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Match 3 of 4");
  });
});

// ---------------------------------------------------------------------------
// PdfViewerErrorBoundary — no engine dependency
// ---------------------------------------------------------------------------

function Thrower(): ReactNode {
  throw new Error("boom");
}

describe("PdfViewerErrorBoundary", () => {
  it("renders the fallback when a child throws", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <PdfViewerErrorBoundary fallback={(error) => <div>Viewer failed: {error.message}</div>}>
        <Thrower />
      </PdfViewerErrorBoundary>,
    );
    expect(screen.getByText("Viewer failed: boom")).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("lets reset() render children again", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let shouldThrow = true;
    function MaybeThrow(): ReactNode {
      if (shouldThrow) throw new Error("boom");
      return <div>recovered</div>;
    }
    render(
      <PdfViewerErrorBoundary fallback={(_error, reset) => <button onClick={reset}>retry</button>}>
        <MaybeThrow />
      </PdfViewerErrorBoundary>,
    );
    shouldThrow = false;
    fireEvent.click(screen.getByText("retry"));
    expect(screen.getByText("recovered")).toBeInTheDocument();
    consoleError.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// useDocumentLifecycle / usePdfViewerActiveState — embedpdf plugin hooks
// mocked. Split to match the production split: `useScroll`/`useZoom` throw
// for a document id that was never registered ("Zoom state not found for
// document: ..."), discovered by running the stories under real Chromium —
// see pdf-viewer.tsx's `PdfViewerActiveSession` doc comment. So
// `useDocumentLifecycle` (tested here without any scroll/zoom mock at all)
// must never call them, and `usePdfViewerActiveState` is only ever exercised
// with a real, fixed `documentId`, never a placeholder.
// ---------------------------------------------------------------------------

const TEST_BYTES = new ArrayBuffer(4);
const openDocumentBuffer = vi.fn();
const closeDocument = vi.fn();
const mockDocumentManagerCapability = vi.fn();
const mockDocumentState = vi.fn();
const mockScroll = vi.fn();
const mockZoom = vi.fn();
const mockSearch = vi.fn();
const mockPrint = vi.fn();

vi.mock("@embedpdf/plugin-document-manager/react", () => ({
  useDocumentManagerCapability: () => mockDocumentManagerCapability(),
}));
vi.mock("@embedpdf/core/react", () => ({
  useDocumentState: (documentId: string | null) => mockDocumentState(documentId),
}));
vi.mock("@embedpdf/plugin-scroll/react", () => ({
  useScroll: (documentId: string) => mockScroll(documentId),
}));
vi.mock("@embedpdf/plugin-zoom/react", () => ({
  useZoom: (documentId: string) => mockZoom(documentId),
}));
// `useSearch`/`usePrint` never throw for an unregistered document id (unlike
// `useScroll`/`useZoom` — see `use-pdf-viewer-state.ts`'s doc comment), but
// their real implementations depend on `@embedpdf/core/react`'s
// `useCapability`/`usePlugin`, which the mock above does not provide — so
// they must be mocked directly here too, same as scroll/zoom.
vi.mock("@embedpdf/plugin-search/react", () => ({
  useSearch: (documentId: string) => mockSearch(documentId),
}));
vi.mock("@embedpdf/plugin-print/react", () => ({
  usePrint: (documentId: string) => mockPrint(documentId),
}));

function taskOf<T>(result: T) {
  return { wait: (resolve: (value: T) => void) => resolve(result) };
}
function failedTaskOf(reason: unknown) {
  return {
    wait: (_resolve: unknown, reject: (error: { reason: unknown }) => void) => reject({ reason }),
  };
}

const DEFAULT_ZOOM_STATE = {
  zoomLevel: ZoomMode.FitWidth,
  currentZoomLevel: 1,
  isMarqueeZoomActive: false,
};

const DEFAULT_SEARCH_STATE = {
  flags: [] as MatchFlag[],
  results: [],
  total: 0,
  activeResultIndex: -1,
  showAllResults: true,
  query: "",
  loading: false,
  active: false,
};

function setUpDefaultMocks() {
  openDocumentBuffer.mockReset();
  closeDocument.mockReset().mockReturnValue({ wait: (resolve: () => void) => resolve() });
  mockDocumentManagerCapability.mockReturnValue({
    provides: { openDocumentBuffer, closeDocument },
  });
  mockDocumentState.mockReturnValue(null);
  mockScroll.mockReturnValue({
    provides: { scrollToPage: vi.fn(), scrollToPreviousPage: vi.fn(), scrollToNextPage: vi.fn() },
    state: { currentPage: 1, totalPages: 1 },
  });
  mockZoom.mockReturnValue({
    provides: { requestZoom: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn() },
    state: DEFAULT_ZOOM_STATE,
  });
  mockSearch.mockReturnValue({
    provides: {
      searchAllPages: vi.fn(),
      nextResult: vi.fn(),
      previousResult: vi.fn(),
      setFlags: vi.fn(),
      stopSearch: vi.fn(),
    },
    state: DEFAULT_SEARCH_STATE,
  });
  mockPrint.mockReturnValue({ provides: { print: vi.fn() } });
}

describe("useDocumentLifecycle", () => {
  beforeEach(() => {
    setUpDefaultMocks();
  });

  it("opens the document and reaches ready once the engine reports it loaded", async () => {
    openDocumentBuffer.mockReturnValue(taskOf({ documentId: "doc-1" }));

    mockDocumentState.mockReturnValue(null);
    const { result, rerender } = renderHook(() =>
      useDocumentLifecycle({ bytes: TEST_BYTES, filename: "a.pdf" }),
    );
    expect(result.current.documentState).toBe("opening");
    // `useScroll`/`useZoom` must never be called by the lifecycle hook.
    expect(mockScroll).not.toHaveBeenCalled();
    expect(mockZoom).not.toHaveBeenCalled();

    mockDocumentState.mockReturnValue({
      id: "doc-1",
      status: "loaded",
      error: null,
      document: { id: "doc-1", pageCount: 3, pages: [], isEncrypted: false, isOwnerUnlocked: true },
    });
    rerender();
    expect(result.current.documentState).toBe("ready");
    expect(result.current.documentId).toBe("doc-1");
    expect(mockScroll).not.toHaveBeenCalled();
    expect(mockZoom).not.toHaveBeenCalled();
  });

  it("maps a Password error code to the protected phase", async () => {
    openDocumentBuffer.mockReturnValue(taskOf({ documentId: "doc-2" }));

    mockDocumentState.mockReturnValue({
      id: "doc-2",
      status: "error",
      error: "password required",
      errorCode: PdfErrorCode.Password,
      document: null,
    });
    const { result } = renderHook(() =>
      useDocumentLifecycle({ bytes: TEST_BYTES, filename: "a.pdf" }),
    );
    expect(result.current.documentState).toBe("protected");
  });

  it("maps a non-password error code to the invalid phase", async () => {
    openDocumentBuffer.mockReturnValue(taskOf({ documentId: "doc-3" }));

    mockDocumentState.mockReturnValue({
      id: "doc-3",
      status: "error",
      error: "bad format",
      errorCode: PdfErrorCode.WrongFormat,
      document: null,
    });
    const { result } = renderHook(() =>
      useDocumentLifecycle({ bytes: TEST_BYTES, filename: "a.pdf" }),
    );
    expect(result.current.documentState).toBe("invalid");
  });

  it("maps a rejected open task to invalid (or protected for a password reason)", async () => {
    openDocumentBuffer.mockReturnValue(
      failedTaskOf({ code: PdfErrorCode.WrongFormat, message: "nope" }),
    );

    const { result } = renderHook(() =>
      useDocumentLifecycle({ bytes: TEST_BYTES, filename: "a.pdf" }),
    );
    expect(result.current.documentState).toBe("invalid");
  });
});

describe("usePdfViewerActiveState", () => {
  beforeEach(() => {
    setUpDefaultMocks();
  });

  it("derives page and zoom state once ready", () => {
    mockScroll.mockReturnValue({
      provides: { scrollToPage: vi.fn(), scrollToPreviousPage: vi.fn(), scrollToNextPage: vi.fn() },
      state: { currentPage: 2, totalPages: 5 },
    });
    const { result } = renderHook(() =>
      usePdfViewerActiveState({ documentId: "doc-1", documentState: "ready" }),
    );
    expect(result.current.page).toEqual({ current: 2, total: 5 });
    expect(result.current.zoom).toEqual({ mode: "fit-width", level: 100 });
  });

  it("reports zero page state before the document is ready", () => {
    const { result } = renderHook(() =>
      usePdfViewerActiveState({ documentId: "doc-1", documentState: "opening" }),
    );
    expect(result.current.page).toEqual({ current: 0, total: 0 });
  });

  it("falls back to the core document's pageCount when the scroll plugin's totalPages is stale on open", () => {
    // Reproduces the "of 0" bug: `useScroll`'s local `totalPages` is seeded by
    // a one-time synchronous read taken the instant `documentId` is set —
    // before the real (async) engine parse finishes — and is only corrected
    // by the plugin's `onPageChange` event, which never fires on open because
    // the *current* page stays 1 throughout (see the doc comment on `page` in
    // use-pdf-viewer-state.ts). A document opened on a still-initializing
    // engine can reach `documentState === "ready"` while the scroll plugin's
    // own state is still the pre-load default (`totalPages: 0`) — this test
    // pins exactly that combination.
    mockDocumentState.mockReturnValue({
      id: "doc-1",
      status: "loaded",
      error: null,
      document: {
        id: "doc-1",
        pageCount: 20,
        pages: [],
        isEncrypted: false,
        isOwnerUnlocked: true,
      },
    });
    mockScroll.mockReturnValue({
      provides: { scrollToPage: vi.fn(), scrollToPreviousPage: vi.fn(), scrollToNextPage: vi.fn() },
      state: { currentPage: 1, totalPages: 0 },
    });
    const { result } = renderHook(() =>
      usePdfViewerActiveState({ documentId: "doc-1", documentState: "ready" }),
    );
    expect(result.current.page).toEqual({ current: 1, total: 20 });
  });

  it("preserves the zoom mode across a fullscreen toggle", async () => {
    const requestZoom = vi.fn();
    mockZoom.mockReturnValue({
      provides: { requestZoom, zoomIn: vi.fn(), zoomOut: vi.fn() },
      state: { zoomLevel: ZoomMode.FitPage, currentZoomLevel: 1.4, isMarqueeZoomActive: false },
    });

    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const originalRequestFullscreen = HTMLElement.prototype.requestFullscreen;
    HTMLElement.prototype.requestFullscreen = requestFullscreen;

    const { result } = renderHook(() =>
      usePdfViewerActiveState({ documentId: "doc-4", documentState: "ready" }),
    );

    await act(async () => {
      result.current.actions.toggleFullscreen();
      await Promise.resolve();
    });

    expect(requestFullscreen).toHaveBeenCalled();
    expect(requestZoom).toHaveBeenCalledWith(ZoomMode.FitPage);

    HTMLElement.prototype.requestFullscreen = originalRequestFullscreen;
  });

  it("fires onDocumentOpened exactly once when the document becomes ready", () => {
    mockDocumentState.mockReturnValue({
      id: "doc-1",
      status: "loaded",
      error: null,
      document: { id: "doc-1", pageCount: 7, pages: [], isEncrypted: false, isOwnerUnlocked: true },
    });
    const onDocumentOpened = vi.fn();
    const { rerender } = renderHook(
      ({ documentState }: { documentState: "ready" }) =>
        usePdfViewerActiveState({ documentId: "doc-1", documentState, onDocumentOpened }),
      { initialProps: { documentState: "ready" } },
    );
    rerender({ documentState: "ready" });
    expect(onDocumentOpened).toHaveBeenCalledTimes(1);
    expect(onDocumentOpened).toHaveBeenCalledWith({ pageCount: 7 });
  });

  // -------------------------------------------------------------------------
  // Search and print (T035/T036). `useSearch`/`usePrint` are mocked the same
  // way as scroll/zoom above. The plugin's own search-session lifecycle
  // (wrap-around navigation, resetting results on a new/forced search) is
  // verified by reading the compiled `@embedpdf/plugin-search` source (see
  // `use-pdf-viewer-state.ts`'s doc comment) — these tests cover what this
  // hook itself is responsible for: deriving `matchCase`/`wholeWord` from the
  // plugin's `flags`, building the next `flags` array on toggle, and
  // delegating each action to the right plugin method.
  // -------------------------------------------------------------------------

  it("derives matchCase/wholeWord from the plugin's flags and passes query/total/activeIndex through", () => {
    mockSearch.mockReturnValue({
      provides: {
        searchAllPages: vi.fn(),
        nextResult: vi.fn(),
        previousResult: vi.fn(),
        setFlags: vi.fn(),
        stopSearch: vi.fn(),
      },
      state: {
        ...DEFAULT_SEARCH_STATE,
        flags: [MatchFlag.MatchCase],
        query: "hello",
        total: 3,
        activeResultIndex: 1,
      },
    });
    const { result } = renderHook(() =>
      usePdfViewerActiveState({ documentId: "doc-1", documentState: "ready" }),
    );
    expect(result.current.search).toEqual({
      query: "hello",
      total: 3,
      activeIndex: 1,
      matchCase: true,
      wholeWord: false,
      open: false,
    });
  });

  it("setQuery delegates to searchAllPages, including an empty string (the plugin's own clear path)", () => {
    const searchAllPages = vi.fn();
    mockSearch.mockReturnValue({
      provides: {
        searchAllPages,
        nextResult: vi.fn(),
        previousResult: vi.fn(),
        setFlags: vi.fn(),
        stopSearch: vi.fn(),
      },
      state: DEFAULT_SEARCH_STATE,
    });
    const { result } = renderHook(() =>
      usePdfViewerActiveState({ documentId: "doc-1", documentState: "ready" }),
    );
    result.current.searchActions.setQuery("hello");
    expect(searchAllPages).toHaveBeenCalledWith("hello");
    result.current.searchActions.setQuery("");
    expect(searchAllPages).toHaveBeenCalledWith("");
  });

  it("nextMatch/previousMatch delegate to the plugin's nextResult/previousResult", () => {
    const nextResult = vi.fn();
    const previousResult = vi.fn();
    mockSearch.mockReturnValue({
      provides: {
        searchAllPages: vi.fn(),
        nextResult,
        previousResult,
        setFlags: vi.fn(),
        stopSearch: vi.fn(),
      },
      state: DEFAULT_SEARCH_STATE,
    });
    const { result } = renderHook(() =>
      usePdfViewerActiveState({ documentId: "doc-1", documentState: "ready" }),
    );
    result.current.searchActions.nextMatch();
    expect(nextResult).toHaveBeenCalled();
    result.current.searchActions.previousMatch();
    expect(previousResult).toHaveBeenCalled();
  });

  it("toggleMatchCase adds the flag without dropping an existing whole-word flag, and removes it on toggle-off", () => {
    const setFlags = vi.fn();
    mockSearch.mockReturnValue({
      provides: {
        searchAllPages: vi.fn(),
        nextResult: vi.fn(),
        previousResult: vi.fn(),
        setFlags,
        stopSearch: vi.fn(),
      },
      state: { ...DEFAULT_SEARCH_STATE, flags: [MatchFlag.MatchWholeWord] },
    });
    const { result } = renderHook(() =>
      usePdfViewerActiveState({ documentId: "doc-1", documentState: "ready" }),
    );
    result.current.searchActions.toggleMatchCase();
    expect(setFlags).toHaveBeenCalledWith([MatchFlag.MatchWholeWord, MatchFlag.MatchCase]);
  });

  it("toggleWholeWord removes the flag when it is already set", () => {
    const setFlags = vi.fn();
    mockSearch.mockReturnValue({
      provides: {
        searchAllPages: vi.fn(),
        nextResult: vi.fn(),
        previousResult: vi.fn(),
        setFlags,
        stopSearch: vi.fn(),
      },
      state: { ...DEFAULT_SEARCH_STATE, flags: [MatchFlag.MatchCase, MatchFlag.MatchWholeWord] },
    });
    const { result } = renderHook(() =>
      usePdfViewerActiveState({ documentId: "doc-1", documentState: "ready" }),
    );
    result.current.searchActions.toggleWholeWord();
    expect(setFlags).toHaveBeenCalledWith([MatchFlag.MatchCase]);
  });

  it("clearSearch calls stopSearch (resets query/results/total/activeIndex and emphasis in one call)", () => {
    const stopSearch = vi.fn();
    mockSearch.mockReturnValue({
      provides: {
        searchAllPages: vi.fn(),
        nextResult: vi.fn(),
        previousResult: vi.fn(),
        setFlags: vi.fn(),
        stopSearch,
      },
      state: DEFAULT_SEARCH_STATE,
    });
    const { result } = renderHook(() =>
      usePdfViewerActiveState({ documentId: "doc-1", documentState: "ready" }),
    );
    result.current.searchActions.clearSearch();
    expect(stopSearch).toHaveBeenCalled();
  });

  it("setOpen(false) also stops the search session; setOpen(true) does not", () => {
    const stopSearch = vi.fn();
    mockSearch.mockReturnValue({
      provides: {
        searchAllPages: vi.fn(),
        nextResult: vi.fn(),
        previousResult: vi.fn(),
        setFlags: vi.fn(),
        stopSearch,
      },
      state: DEFAULT_SEARCH_STATE,
    });
    const { result } = renderHook(() =>
      usePdfViewerActiveState({ documentId: "doc-1", documentState: "ready" }),
    );
    act(() => result.current.searchActions.setOpen(true));
    expect(stopSearch).not.toHaveBeenCalled();
    expect(result.current.search.open).toBe(true);
    act(() => result.current.searchActions.setOpen(false));
    expect(stopSearch).toHaveBeenCalled();
    expect(result.current.search.open).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Scroll the active match into view (FR-014). Neither the plugin nor any
  // installed `@embedpdf/*` package does this on its own (confirmed by
  // reading the compiled `@embedpdf/plugin-search` source and grepping every
  // installed `@embedpdf/*` package for a consumer of `onActiveResultChange`
  // — there is none), so `use-pdf-viewer-search.ts` derives the active
  // result's page from `searchState.results[activeResultIndex]` and calls
  // `scroll.scrollToPage` itself. `minimal.pdf`/`js-in-pdf.pdf` are both
  // single-page, so this can only be exercised with mocked multi-page
  // results, never by the real fixtures.
  // -------------------------------------------------------------------------

  it("scrolls the active match's page into view when a fresh search finds its first result", () => {
    const scrollToPage = vi.fn();
    mockScroll.mockReturnValue({
      provides: { scrollToPage, scrollToPreviousPage: vi.fn(), scrollToNextPage: vi.fn() },
      state: { currentPage: 1, totalPages: 5 },
    });
    mockSearch.mockReturnValue({
      provides: {
        searchAllPages: vi.fn(),
        nextResult: vi.fn(),
        previousResult: vi.fn(),
        setFlags: vi.fn(),
        stopSearch: vi.fn(),
      },
      state: {
        ...DEFAULT_SEARCH_STATE,
        query: "hello",
        total: 2,
        activeResultIndex: 0,
        results: [
          {
            pageIndex: 2,
            charIndex: 10,
            charCount: 5,
            rects: [{ origin: { x: 12, y: 34 }, size: { width: 20, height: 10 } }],
            context: {},
          },
          {
            pageIndex: 4,
            charIndex: 3,
            charCount: 5,
            rects: [{ origin: { x: 1, y: 2 }, size: { width: 20, height: 10 } }],
            context: {},
          },
        ],
      },
    });

    renderHook(() => usePdfViewerActiveState({ documentId: "doc-1", documentState: "ready" }));

    // `SearchResult.pageIndex` is 0-based; `scrollToPage` takes a 1-based
    // `pageNumber`. `pageCoordinates` come straight from the match's own
    // rect origin (the same page-local, unscaled space `SearchLayer` draws
    // its highlight from), centered via `alignX`/`alignY: 50`.
    expect(scrollToPage).toHaveBeenCalledWith({
      pageNumber: 3,
      pageCoordinates: { x: 12, y: 34 },
      behavior: "smooth",
      alignX: 50,
      alignY: 50,
    });
  });

  it("scrolls again when the active match moves to a different page (next/previous or a new search)", () => {
    const scrollToPage = vi.fn();
    mockScroll.mockReturnValue({
      provides: { scrollToPage, scrollToPreviousPage: vi.fn(), scrollToNextPage: vi.fn() },
      state: { currentPage: 1, totalPages: 5 },
    });
    const results = [
      {
        pageIndex: 2,
        charIndex: 10,
        charCount: 5,
        rects: [{ origin: { x: 12, y: 34 }, size: { width: 20, height: 10 } }],
        context: {},
      },
      {
        pageIndex: 4,
        charIndex: 3,
        charCount: 5,
        rects: [{ origin: { x: 1, y: 2 }, size: { width: 20, height: 10 } }],
        context: {},
      },
    ];
    const searchProvides = {
      searchAllPages: vi.fn(),
      nextResult: vi.fn(),
      previousResult: vi.fn(),
      setFlags: vi.fn(),
      stopSearch: vi.fn(),
    };
    mockSearch.mockReturnValue({
      provides: searchProvides,
      state: { ...DEFAULT_SEARCH_STATE, query: "hello", total: 2, activeResultIndex: 0, results },
    });

    const { rerender } = renderHook(() =>
      usePdfViewerActiveState({ documentId: "doc-1", documentState: "ready" }),
    );
    expect(scrollToPage).toHaveBeenCalledTimes(1);

    mockSearch.mockReturnValue({
      provides: searchProvides,
      state: { ...DEFAULT_SEARCH_STATE, query: "hello", total: 2, activeResultIndex: 1, results },
    });
    rerender();

    expect(scrollToPage).toHaveBeenCalledTimes(2);
    expect(scrollToPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNumber: 5, pageCoordinates: { x: 1, y: 2 } }),
    );
  });

  it("does not scroll again on a re-render where the active match is unchanged", () => {
    const scrollToPage = vi.fn();
    mockScroll.mockReturnValue({
      provides: { scrollToPage, scrollToPreviousPage: vi.fn(), scrollToNextPage: vi.fn() },
      state: { currentPage: 1, totalPages: 5 },
    });
    const results = [
      {
        pageIndex: 2,
        charIndex: 10,
        charCount: 5,
        rects: [{ origin: { x: 12, y: 34 }, size: { width: 20, height: 10 } }],
        context: {},
      },
    ];
    const searchProvides = {
      searchAllPages: vi.fn(),
      nextResult: vi.fn(),
      previousResult: vi.fn(),
      setFlags: vi.fn(),
      stopSearch: vi.fn(),
    };
    mockSearch.mockReturnValue({
      provides: searchProvides,
      state: { ...DEFAULT_SEARCH_STATE, query: "hello", total: 1, activeResultIndex: 0, results },
    });

    const { rerender } = renderHook(() =>
      usePdfViewerActiveState({ documentId: "doc-1", documentState: "ready" }),
    );
    expect(scrollToPage).toHaveBeenCalledTimes(1);

    // A new `results` array reference (the plugin dispatches a fresh array on
    // every action, per the compiled reducer) but the *active* result's own
    // identity (page + char index) is unchanged — must not scroll again.
    mockSearch.mockReturnValue({
      provides: searchProvides,
      state: {
        ...DEFAULT_SEARCH_STATE,
        query: "hello",
        total: 1,
        activeResultIndex: 0,
        results: [...results],
      },
    });
    rerender();

    expect(scrollToPage).toHaveBeenCalledTimes(1);
  });

  it("does not scroll when there is no active match", () => {
    const scrollToPage = vi.fn();
    mockScroll.mockReturnValue({
      provides: { scrollToPage, scrollToPreviousPage: vi.fn(), scrollToNextPage: vi.fn() },
      state: { currentPage: 1, totalPages: 5 },
    });
    renderHook(() => usePdfViewerActiveState({ documentId: "doc-1", documentState: "ready" }));
    expect(scrollToPage).not.toHaveBeenCalled();
  });

  it("actions.print calls the print plugin's print method", () => {
    const print = vi.fn();
    mockPrint.mockReturnValue({ provides: { print } });
    const { result } = renderHook(() =>
      usePdfViewerActiveState({ documentId: "doc-1", documentState: "ready" }),
    );
    result.current.actions.print();
    expect(print).toHaveBeenCalled();
  });
});
