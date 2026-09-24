/**
 * `pdf-viewer-story-helpers.tsx` has no engine dependency of its own — it
 * only fetches bytes and hands them to the real `PdfViewer` (mocked out
 * here, same as `pdf-viewer.composition.test.tsx` mocks the `@embedpdf/*`
 * packages it needs) — so it's exercised directly under jsdom rather than
 * only through a Storybook story.
 */
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfViewerHarness, StoryFrame, wasmUrl } from "./pdf-viewer-story-helpers";

vi.mock("./pdf-viewer", () => ({
  PdfViewer: ({ bytes }: { bytes: ArrayBuffer }) => (
    <div data-testid="pdf-viewer-stub">bytes:{bytes.byteLength}</div>
  ),
}));

describe("wasmUrl", () => {
  it("resolves to an absolute URL", () => {
    expect(() => new URL(wasmUrl)).not.toThrow();
    expect(wasmUrl.startsWith("http")).toBe(true);
  });
});

describe("StoryFrame", () => {
  it("renders its children inside the fixed-size frame", () => {
    render(
      <StoryFrame>
        <div data-testid="child" />
      </StoryFrame>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});

describe("PdfViewerHarness", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("shows a loading placeholder, then renders PdfViewer once the fetch resolves", async () => {
    let resolveArrayBuffer: ((buffer: ArrayBuffer) => void) | undefined;
    const arrayBufferPromise = new Promise<ArrayBuffer>((resolve) => {
      resolveArrayBuffer = resolve;
    });
    vi.mocked(global.fetch).mockResolvedValue({
      arrayBuffer: () => arrayBufferPromise,
    } as Response);

    render(<PdfViewerHarness src="/fixtures/minimal.pdf" filename="minimal.pdf" wasmUrl="x" />);

    // `aria-busy` here is what the `async-content` visual harness wait
    // relies on to stay busy from the story's first commit onward.
    expect(screen.getByText("Loading fixture…")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByTestId("pdf-viewer-stub")).not.toBeInTheDocument();

    await act(async () => {
      resolveArrayBuffer?.(new ArrayBuffer(8));
      // Let the fetch chain's two `.then`s and the resulting state update flush.
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("pdf-viewer-stub")).toHaveTextContent("bytes:8");
    expect(screen.queryByText("Loading fixture…")).not.toBeInTheDocument();
  });

  it("re-fetches when src changes, showing the placeholder again in between", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
    } as Response);

    const { rerender } = render(
      <PdfViewerHarness src="/fixtures/a.pdf" filename="a.pdf" wasmUrl="x" />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("pdf-viewer-stub")).toHaveTextContent("bytes:4");

    vi.mocked(global.fetch).mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(12)),
    } as Response);
    rerender(<PdfViewerHarness src="/fixtures/b.pdf" filename="b.pdf" wasmUrl="x" />);
    expect(screen.getByText("Loading fixture…")).toBeInTheDocument();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("pdf-viewer-stub")).toHaveTextContent("bytes:12");
    expect(global.fetch).toHaveBeenCalledWith("/fixtures/a.pdf");
    expect(global.fetch).toHaveBeenCalledWith("/fixtures/b.pdf");
  });
});
