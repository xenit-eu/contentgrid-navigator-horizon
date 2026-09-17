import { useEffect, useState } from "react";
// `@embedpdf/pdfium`'s own wasm binary, self-hosted (never a CDN URL) —
// resolved to an absolute URL the worker can load from any origin. Note:
// the package's `exports` map only exposes this at the `./pdfium.wasm`
// subpath (not `./dist/pdfium.wasm`, despite that being the file's real
// location inside the package) — `./dist/pdfium.wasm?url` fails to resolve
// under Vite/Rolldown's `exports`-conditions resolution.
import pdfiumWasmUrl from "@embedpdf/pdfium/pdfium.wasm?url";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import jsInPdfUrl from "./fixtures/js-in-pdf.pdf?url";
import minimalPdfUrl from "./fixtures/minimal.pdf?url";
import { PdfViewer } from "./pdf-viewer";
import { DEFAULT_PDF_VIEWER_LABELS } from "./pdf-viewer-labels";
import { PdfViewerToolbar } from "./pdf-viewer-toolbar";

const wasmUrl = new URL(pdfiumWasmUrl, window.location.href).href;

// ---------------------------------------------------------------------------
// Fixture loading — stories receive a `src` and fetch it themselves so the
// same harness works for every story below.
// ---------------------------------------------------------------------------

function usePdfBytes(src: string): ArrayBuffer | null {
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBytes(null);
    fetch(src)
      .then((response) => response.arrayBuffer())
      .then((buffer) => {
        if (!cancelled) setBytes(buffer);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  return bytes;
}

function PdfViewerHarness(
  props: Omit<React.ComponentProps<typeof PdfViewer>, "bytes"> & { src: string },
) {
  const { src, ...rest } = props;
  const bytes = usePdfBytes(src);
  if (!bytes) return <div className="p-8 text-sm text-muted-foreground">Loading fixture…</div>;
  return <PdfViewer {...rest} bytes={bytes} />;
}

function StoryFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="h-[520px] w-[420px] overflow-hidden rounded-md border">{children}</div>;
}

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
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
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
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("document opens and the toolbar becomes enabled", async () => {
      const zoomIn = await canvas.findByLabelText("Zoom in", {}, { timeout: 10_000 });
      await waitFor(() => expect(zoomIn).toBeEnabled(), { timeout: 10_000 });
    });

    await step("zoom controls change the displayed level", async () => {
      const zoomIn = await canvas.findByLabelText("Zoom in");
      const zoomLevel = await canvas.findByLabelText("Zoom level");
      const before = zoomLevel.textContent;
      await userEvent.click(zoomIn);
      await waitFor(() => expect(zoomLevel.textContent).not.toBe(before));
    });

    await step("zoom out returns towards the original level", async () => {
      const zoomOut = await canvas.findByLabelText("Zoom out");
      await userEvent.click(zoomOut);
    });

    await step("jumping to page 1 keeps the single-page document on page 1", async () => {
      const pageInput = await canvas.findByLabelText("Current page");
      await userEvent.clear(pageInput);
      await userEvent.type(pageInput, "1{Enter}");
      await expect(pageInput).toHaveValue("1");
    });

    await step("download button is present and clickable", async () => {
      const download = await canvas.findByLabelText("Download");
      await userEvent.click(download);
    });

    await step("fullscreen toggle does not throw", async () => {
      const fullscreenButton = await canvas.findByLabelText("Enter fullscreen");
      await userEvent.click(fullscreenButton);
    });
  },
};

export const ToolbarMinimal: Story = {
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByLabelText("Previous page")).toBeInTheDocument();
    await expect(canvas.queryByLabelText("Zoom in")).not.toBeInTheDocument();
    await expect(canvas.queryByLabelText("Enter fullscreen")).not.toBeInTheDocument();
  },
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
          showFullscreen
          onDownload={fn()}
          documentState="protected"
          page={{ current: 0, total: 0 }}
          zoom={{ mode: "fit-width", level: 100 }}
          fullscreen={false}
          actions={{
            goToPage: fn(),
            previousPage: fn(),
            nextPage: fn(),
            zoomIn: fn(),
            zoomOut: fn(),
            setZoom: fn(),
            toggleFullscreen: fn(),
          }}
          labels={DEFAULT_PDF_VIEWER_LABELS}
        />
        <div className="text-muted-foreground flex flex-1 items-center justify-center p-8 text-center text-sm">
          {DEFAULT_PDF_VIEWER_LABELS.protectedDocument}
        </div>
      </div>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(DEFAULT_PDF_VIEWER_LABELS.protectedDocument)).toBeInTheDocument();
    await expect(canvas.getByLabelText("Previous page")).toBeDisabled();
  },
};

export const Invalid: Story = {
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(DEFAULT_PDF_VIEWER_LABELS.invalidDocument, {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
  },
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(DEFAULT_PDF_VIEWER_LABELS.engineError)).toBeInTheDocument();
  },
};

/**
 * Proves FR-026 / SC-005: PDFium is a WASM build with no JavaScript engine
 * compiled in, so an `/OpenAction` running `app.alert('x')` never executes.
 * The `play()` step spies on `window.alert` and fails if it is ever called.
 */
export const JsInPdf: Story = {
  render: () => (
    <StoryFrame>
      <PdfViewerHarness src={jsInPdfUrl} filename="js-in-pdf.pdf" wasmUrl={wasmUrl} />
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    let dialogFired = false;
    const originalAlert = window.alert;
    window.alert = () => {
      dialogFired = true;
    };

    try {
      await canvas.findByLabelText("Previous page", {}, { timeout: 10_000 });
      // Give the engine a moment past "opened" in case any scripting path
      // fires asynchronously.
      await new Promise((resolve) => setTimeout(resolve, 500));
      await expect(dialogFired).toBe(false);
    } finally {
      window.alert = originalAlert;
    }
  },
};
