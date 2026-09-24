/**
 * Tests for `ContentPreviewPanel`: real `useContentPreview`/`useDownloadContent` hooks against
 * MSW (per ADR-014), with `@contentgrid/ui`'s PDFium-backed `PdfViewer`/`PdfEngineProvider`
 * mocked — the engine cannot run in jsdom (`packages/navigator-data/CLAUDE.md`'s testing note,
 * `research.md` §8.8). `PdfViewerErrorBoundary` is left real: it is a plain React error boundary
 * with no engine dependency, so mounting it for real exercises the panel's actual fallback
 * wiring.
 *
 * `entityItem` is a duck-typed stub (`as unknown as EntityItem`), not a real `HalObject`-backed
 * instance — `@contentgrid/hal` is a forbidden import in `packages/features`
 * (`packages/features/CLAUDE.md`). The stub implements exactly the members the real hooks touch
 * (`attributes`, `etag`, `downloadContentRequest`), built from real navigator-data value classes
 * (`EntityItemAttributeContent`) — the same pattern `entity-item/attributes/
 * entity-item-attributes.test.tsx` already established for this package.
 */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  type EntityItem,
  EntityItemAttributeContent,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";
import {
  createContentDownloadHandler,
  createRenditionHandlers,
} from "@contentgrid/navigator-data/test-fixtures/msw/handlers";
import { server } from "../../../../../test-setup";
import { ContentPreviewPanel } from "./content-preview-panel";

const API_URL = "https://api.example.com";
const CONTENT_URL = `${API_URL}/orders/1/document`;
const PHOTO_CONTENT_URL = `${API_URL}/orders/1/photo`;
const RENDITION_URI_TEMPLATE = `${API_URL}/renditions/get/pdf{?url}`;
const RENDITION_REQUEST_URL = `${API_URL}/renditions/get/pdf`;
const JOB_URL = `${API_URL}/renditions/jobs/job-1`;

const noopSupplier: AuthenticationTokenSupplier = async () => null;

// ---- PDFium can't run in jsdom — mock @contentgrid/ui's viewer/engine, keep the plain React
// error boundary real (it has no engine dependency of its own). ----
vi.mock("@contentgrid/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/ui")>();
  return {
    ...actual,
    PdfEngineProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    PdfViewer: (props: {
      bytes: ArrayBuffer;
      filename: string;
      toolbar?: { start?: ReactNode; end?: ReactNode };
      onDownload?: () => void;
      onLoadError?: (error: { kind: "invalid" | "protected" | "engine" }) => void;
    }) => {
      if (props.filename === "throws.pdf") {
        throw new Error("simulated viewer render failure");
      }
      return (
        <div>
          <div>PDF viewer: {props.filename}</div>
          <div>toolbar-start: {props.toolbar?.start}</div>
          <div>toolbar-end: {props.toolbar?.end}</div>
          <button onClick={props.onDownload}>viewer download</button>
          <button onClick={() => props.onLoadError?.({ kind: "protected" })}>
            simulate protected
          </button>
          <button onClick={() => props.onLoadError?.({ kind: "invalid" })}>simulate invalid</button>
          <button onClick={() => props.onLoadError?.({ kind: "engine" })}>simulate engine</button>
        </div>
      );
    },
  };
});

function makeStubEntityItem(options: {
  attributeName: string;
  metadata: { filename: string | null; mimetype: string; length: number } | null;
  etag?: string | null;
}): EntityItem {
  const { attributeName, metadata, etag = '"v1"' } = options;
  const attributes = [
    {
      value: new EntityItemAttributeContent(attributeName, metadata, {
        href: CONTENT_URL,
      } as never),
    },
  ];
  return {
    attributes,
    // `getContentAttributeMetadata` calls the real `EntityItem.findAttribute` — mirror its
    // lookup here instead of hand-rolling a `.attributes.find(...)` in the stub.
    findAttribute: (name: string) => attributes.find((attr) => attr.value.name === name),
    etag,
    downloadContentRequest: (
      _attrName: string,
      opts?: { range?: { start: number; end?: number } },
    ) => {
      const headers: Record<string, string> = {};
      if (opts?.range) {
        headers.Range =
          opts.range.end === undefined
            ? `bytes=${opts.range.start}-`
            : `bytes=${opts.range.start}-${opts.range.end}`;
      }
      return new Request(CONTENT_URL, { method: "GET", headers });
    },
  } as unknown as EntityItem;
}

/**
 * Two-attribute variant of `makeStubEntityItem` — needed only by the FR-006/FR-021 tests below,
 * which switch `attributeName` on an already-mounted panel and must route
 * `downloadContentRequest` to whichever attribute's URL is current, unlike the single-attribute
 * stub above (which always targets `CONTENT_URL`).
 */
function makeStubEntityItemWithAttributes(
  attrs: readonly {
    name: string;
    metadata: { filename: string | null; mimetype: string; length: number } | null;
    url: string;
  }[],
  etag: string | null = '"v1"',
): EntityItem {
  const attributes = attrs.map((attr) => ({
    value: new EntityItemAttributeContent(attr.name, attr.metadata, { href: attr.url } as never),
  }));
  return {
    attributes,
    // See the matching comment in `makeStubEntityItem` above.
    findAttribute: (name: string) => attributes.find((attr) => attr.value.name === name),
    etag,
    downloadContentRequest: (
      attrName: string,
      opts?: { range?: { start: number; end?: number } },
    ) => {
      const match = attrs.find((attr) => attr.name === attrName);
      const url = match?.url ?? attrs[0].url;
      const headers: Record<string, string> = {};
      if (opts?.range) {
        headers.Range =
          opts.range.end === undefined
            ? `bytes=${opts.range.start}-`
            : `bytes=${opts.range.start}-${opts.range.end}`;
      }
      return new Request(url, { method: "GET", headers });
    },
  } as unknown as EntityItem;
}

function makeWrapper(renditionUri?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const apiFetch = createApiClient(noopSupplier);
  const contentFetch = createContentClient(noopSupplier);
  const renditionPolling = renditionUri ? { intervalMs: 5, timeoutMs: 200 } : undefined;

  return function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={apiFetch}
          contentFetch={contentFetch}
          profileUrl={`${API_URL}/profile`}
          renditionUri={renditionUri}
          renditionPolling={renditionPolling}
        >
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => {
  // jsdom doesn't implement Blob URLs — assign directly (not vi.spyOn, which requires the
  // property to already exist) rather than replacing the whole `URL` global, which would also
  // break the real `new URL(...)` constructor other code in this tree depends on.
  URL.createObjectURL = vi.fn(() => "blob:mock-url");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  // @ts-expect-error -- removing the jsdom-absent methods stubbed above, not a spy.
  delete URL.createObjectURL;
  // @ts-expect-error -- see above.
  delete URL.revokeObjectURL;
});

describe("ContentPreviewPanel", () => {
  it("renders the drop zone when the attribute holds no file", () => {
    const entityItem = makeStubEntityItem({ attributeName: "document", metadata: null });
    render(<ContentPreviewPanel entityItem={entityItem} attributeName="document" />, {
      wrapper: makeWrapper(),
    });

    expect(screen.getByText("No file")).toBeInTheDocument();
  });

  it("renders the stored PDF once the download resolves, and downloads it on demand", async () => {
    server.use(
      createContentDownloadHandler({
        url: CONTENT_URL,
        body: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        contentType: "application/pdf",
        filename: "server-name.pdf",
      }),
    );
    const entityItem = makeStubEntityItem({
      attributeName: "document",
      metadata: { filename: "order.pdf", mimetype: "application/pdf", length: 4 },
    });
    render(<ContentPreviewPanel entityItem={entityItem} attributeName="document" />, {
      wrapper: makeWrapper(),
    });

    await screen.findByText("PDF viewer: order.pdf");

    screen.getByRole("button", { name: "viewer download" }).click();

    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
    const anchorClick = vi.mocked(HTMLAnchorElement.prototype.click);
    expect(anchorClick).toHaveBeenCalledOnce();
  });

  it("shows previewUnavailable for a non-PDF file with no rendition endpoint configured", async () => {
    const entityItem = makeStubEntityItem({
      attributeName: "photo",
      metadata: { filename: "photo.png", mimetype: "image/png", length: 100 },
    });
    render(<ContentPreviewPanel entityItem={entityItem} attributeName="photo" />, {
      wrapper: makeWrapper(),
    });

    expect(await screen.findByText(/Preview isn't available/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("shows couldNotRetrieve with Retry on a stored-PDF download failure, and refetches", async () => {
    let requestCount = 0;
    server.use(
      http.get(CONTENT_URL, () => {
        requestCount += 1;
        return HttpResponse.json(
          { status: 500, title: "Internal Server Error" },
          { status: 500, headers: { "Content-Type": "application/problem+json" } },
        );
      }),
    );
    const entityItem = makeStubEntityItem({
      attributeName: "document",
      metadata: { filename: "order.pdf", mimetype: "application/pdf", length: 4 },
    });
    render(<ContentPreviewPanel entityItem={entityItem} attributeName="document" />, {
      wrapper: makeWrapper(),
    });

    // A real caught error means the frame renders the real ProblemAlert (title/detail from the
    // response) rather than its own generic "Couldn't retrieve this file" default message.
    expect(await screen.findByText("Internal Server Error")).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: "Retry" });

    await waitFor(() => expect(requestCount).toBe(1));
    retryButton.click();
    await waitFor(() => expect(requestCount).toBe(2));
  });

  it("shows a converted-preview badge for a rendition-backed non-PDF file", async () => {
    server.use(
      ...createRenditionHandlers({
        url: RENDITION_REQUEST_URL,
        jobUrl: JOB_URL,
        pendingPolls: 0,
        outcome: "ready",
      }),
    );
    const entityItem = makeStubEntityItem({
      attributeName: "photo",
      metadata: { filename: "photo.docx", mimetype: "application/msword", length: 100 },
    });
    render(<ContentPreviewPanel entityItem={entityItem} attributeName="photo" />, {
      wrapper: makeWrapper(RENDITION_URI_TEMPLATE),
    });

    await screen.findByText(/PDF viewer:/);
    expect(screen.getByText("Converted preview")).toBeInTheDocument();
  });

  it("renders the toolbarStart slot once the viewer mounts", async () => {
    server.use(
      createContentDownloadHandler({
        url: CONTENT_URL,
        body: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        contentType: "application/pdf",
      }),
    );
    const entityItem = makeStubEntityItem({
      attributeName: "document",
      metadata: { filename: "order.pdf", mimetype: "application/pdf", length: 4 },
    });
    render(
      <ContentPreviewPanel
        entityItem={entityItem}
        attributeName="document"
        toolbarStart={<span>attribute selector</span>}
      />,
      { wrapper: makeWrapper() },
    );

    expect(await screen.findByText("attribute selector")).toBeInTheDocument();
  });

  it("maps a viewer-reported protected/invalid load error, with no Retry button", async () => {
    server.use(
      createContentDownloadHandler({
        url: CONTENT_URL,
        body: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        contentType: "application/pdf",
      }),
    );
    const entityItem = makeStubEntityItem({
      attributeName: "document",
      metadata: { filename: "order.pdf", mimetype: "application/pdf", length: 4 },
    });
    render(<ContentPreviewPanel entityItem={entityItem} attributeName="document" />, {
      wrapper: makeWrapper(),
    });

    await screen.findByText("PDF viewer: order.pdf");
    screen.getByRole("button", { name: "simulate protected" }).click();

    expect(await screen.findByText("This file is password protected.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("maps a caught render exception (PdfViewerErrorBoundary) to viewerFailure, with a working Retry", async () => {
    server.use(
      createContentDownloadHandler({
        url: CONTENT_URL,
        body: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        contentType: "application/pdf",
        filename: "throws.pdf",
      }),
    );
    const entityItem = makeStubEntityItem({
      attributeName: "document",
      // metadata.filename flows into PreviewSource.filename for the stored path, and the mocked
      // PdfViewer throws when it receives exactly this filename.
      metadata: { filename: "throws.pdf", mimetype: "application/pdf", length: 4 },
    });
    render(<ContentPreviewPanel entityItem={entityItem} attributeName="document" />, {
      wrapper: makeWrapper(),
    });

    // The boundary's fallback attaches the real caught error as `problem`, so the frame renders
    // the ProblemAlert (the exception's own message) rather than its generic default text.
    expect(await screen.findByText("simulated viewer render failure")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows previewUnavailable naming the mimetype when the rendition service reports invalid-conversion", async () => {
    server.use(
      ...createRenditionHandlers({
        url: RENDITION_REQUEST_URL,
        jobUrl: JOB_URL,
        pendingPolls: 0,
        outcome: "invalid-conversion",
      }),
    );
    const entityItem = makeStubEntityItem({
      attributeName: "photo",
      metadata: { filename: "photo.tiff", mimetype: "image/x-tiff", length: 100 },
    });
    render(<ContentPreviewPanel entityItem={entityItem} attributeName="photo" />, {
      wrapper: makeWrapper(RENDITION_URI_TEMPLATE),
    });

    expect(
      await screen.findByText("Preview isn't available for image/x-tiff files."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("shows couldNotPrepare when the rendition job never reaches a terminal state (timeout)", async () => {
    server.use(
      ...createRenditionHandlers({
        url: RENDITION_REQUEST_URL,
        jobUrl: JOB_URL,
        pendingPolls: 0,
        outcome: "never",
      }),
    );
    const entityItem = makeStubEntityItem({
      attributeName: "photo",
      metadata: { filename: "photo.docx", mimetype: "application/msword", length: 100 },
    });
    render(<ContentPreviewPanel entityItem={entityItem} attributeName="photo" />, {
      wrapper: makeWrapper(RENDITION_URI_TEMPLATE),
    });

    // The wrapper's renditionPolling ceiling is 200ms — `RenditionTimeoutError` is a plain Error,
    // so `toProblemDisplayModel` maps it to the generic "Something went wrong" title, not a typed
    // problem's own title (packages/navigator-data/src/api/problem-details/display-model.ts).
    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows couldNotPrepare with the real problem detail on a generic rendition failure", async () => {
    server.use(
      ...createRenditionHandlers({
        url: RENDITION_REQUEST_URL,
        jobUrl: JOB_URL,
        pendingPolls: 0,
        outcome: "error",
      }),
    );
    const entityItem = makeStubEntityItem({
      attributeName: "photo",
      metadata: { filename: "photo.docx", mimetype: "application/msword", length: 100 },
    });
    render(<ContentPreviewPanel entityItem={entityItem} attributeName="photo" />, {
      wrapper: makeWrapper(RENDITION_URI_TEMPLATE),
    });

    expect(await screen.findByText("Internal Server Error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("never shows the previous attribute's viewer while the new selection is still loading (FR-006)", async () => {
    server.use(
      createContentDownloadHandler({
        url: CONTENT_URL,
        body: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        contentType: "application/pdf",
      }),
      // The rendition job for "photo" never reaches a terminal state (`outcome: "never"`) — this
      // test only cares about the instant right after switching, not about how the new
      // attribute's own state eventually settles.
      ...createRenditionHandlers({
        url: RENDITION_REQUEST_URL,
        jobUrl: `${JOB_URL}-photo`,
        pendingPolls: 0,
        outcome: "never",
      }),
    );
    const entityItem = makeStubEntityItemWithAttributes([
      {
        name: "document",
        metadata: { filename: "order.pdf", mimetype: "application/pdf", length: 4 },
        url: CONTENT_URL,
      },
      {
        name: "photo",
        metadata: { filename: "photo.docx", mimetype: "application/msword", length: 100 },
        url: PHOTO_CONTENT_URL,
      },
    ]);

    const { rerender } = render(
      <ContentPreviewPanel entityItem={entityItem} attributeName="document" />,
      { wrapper: makeWrapper(RENDITION_URI_TEMPLATE) },
    );
    await screen.findByText("PDF viewer: order.pdf");

    rerender(<ContentPreviewPanel entityItem={entityItem} attributeName="photo" />);

    // Synchronously after the switch — TanStack Query resets to its pending state on a query-key
    // change with no `keepPreviousData` — the old attribute's viewer must already be gone, never
    // shown together with (or in place of) the new attribute's own preparing state.
    expect(screen.queryByText("PDF viewer: order.pdf")).not.toBeInTheDocument();
    expect(await screen.findByText("Preparing preview…")).toBeInTheDocument();
  });

  it("aborts the in-flight rendition poll when the attribute switches away mid-poll (FR-021)", async () => {
    let photoPollCount = 0;
    server.use(
      createContentDownloadHandler({
        url: CONTENT_URL,
        body: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        contentType: "application/pdf",
      }),
      http.get(
        RENDITION_REQUEST_URL,
        () => new HttpResponse(null, { status: 202, headers: { Location: JOB_URL } }),
      ),
      http.get(JOB_URL, () => {
        photoPollCount += 1;
        // Never resolves — every poll is counted, so the assertion below can prove the loop
        // really stopped (a frozen count) rather than merely not-yet-having-fired-again.
        return new HttpResponse(null, { status: 202, headers: { Location: JOB_URL } });
      }),
    );
    const entityItem = makeStubEntityItemWithAttributes([
      {
        name: "document",
        metadata: { filename: "order.pdf", mimetype: "application/pdf", length: 4 },
        url: CONTENT_URL,
      },
      {
        name: "photo",
        metadata: { filename: "photo.docx", mimetype: "application/msword", length: 100 },
        url: PHOTO_CONTENT_URL,
      },
    ]);

    const { rerender } = render(
      <ContentPreviewPanel entityItem={entityItem} attributeName="photo" />,
      { wrapper: makeWrapper(RENDITION_URI_TEMPLATE) },
    );
    await screen.findByText("Preparing preview…");
    await waitFor(() => expect(photoPollCount).toBeGreaterThan(0));
    const countAtSwitch = photoPollCount;

    rerender(<ContentPreviewPanel entityItem={entityItem} attributeName="document" />);
    await screen.findByText("PDF viewer: order.pdf");

    // The wrapper's poll interval is 5ms — give any not-actually-aborted poll loop several
    // intervals' worth of time to (incorrectly) fire again before asserting it never did.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(photoPollCount).toBe(countAtSwitch);
  });
});
