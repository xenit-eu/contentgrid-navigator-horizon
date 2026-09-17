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
import { PdfErrorCode } from "@embedpdf/models";
import { ZoomMode } from "@embedpdf/plugin-zoom";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PdfViewerErrorBoundary } from "./pdf-viewer";
import { DEFAULT_PDF_VIEWER_LABELS } from "./pdf-viewer-labels";
import { PdfViewerToolbar, type PdfViewerToolbarProps } from "./pdf-viewer-toolbar";
import { useDocumentLifecycle, usePdfViewerActiveState } from "./use-pdf-viewer-state";
import type { PdfViewerStateActions } from "./use-pdf-viewer-state";

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
    ...overrides,
  };
}

function renderToolbar(overrides: Partial<PdfViewerToolbarProps> = {}, actions = makeActions()) {
  const props: PdfViewerToolbarProps = {
    showPageNavigation: true,
    showZoom: true,
    showFullscreen: true,
    documentState: "ready",
    page: { current: 2, total: 5 },
    zoom: { mode: "custom", level: 100 },
    fullscreen: false,
    actions,
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
        showFullscreen
        documentState="ready"
        page={{ current: 1, total: 5 }}
        zoom={{ mode: "custom", level: 100 }}
        fullscreen={false}
        actions={makeActions()}
        labels={DEFAULT_PDF_VIEWER_LABELS}
      />,
    );
    rerender(
      <PdfViewerToolbar
        showPageNavigation
        showZoom
        showFullscreen
        documentState="ready"
        page={{ current: 2, total: 5 }}
        zoom={{ mode: "custom", level: 100 }}
        fullscreen={false}
        actions={makeActions()}
        labels={DEFAULT_PDF_VIEWER_LABELS}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Page 2 of 5");
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
});
