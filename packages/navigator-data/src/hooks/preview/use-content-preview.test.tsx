/**
 * Tests for `useContentPreview`.
 *
 * Covers:
 * - Stored PDF success
 * - 404 on the stored download → noFile
 * - null metadata → noFile without any request
 * - Rendition ready → pdf/origin:"rendition"
 * - Rendition invalid-conversion → unsupported
 * - No renditionUri configured → unavailable (no request at all)
 * - Rendition "never" outcome → RenditionTimeoutError after the ceiling
 * - A poll-time 500 → isError (ProblemDetailError)
 * - Key change (attribute/item switch) aborts in-flight polling — no further handler calls
 * - ETag change produces a new key — the item is re-fetched, not served from cache
 * - contentFetch is used; apiFetch is never called
 * - Throws synchronously for a non-content attribute name
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HalObject } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import {
  createContentDownloadHandler,
  createProblemHandler,
  createRenditionHandlers,
} from "../../../test-fixtures/msw/handlers";
import { server } from "../../../test-setup";
import { EntityItem } from "../../accessors/entity-item";
import { createApiClient, createContentClient } from "../../api/client";
import {
  DEFAULT_RENDITION_POLL_INTERVAL_MS,
  DEFAULT_RENDITION_TIMEOUT_MS,
} from "../../preview/rendition-job";
import type { EntityItemShape } from "../../shapes";
import {
  BASE,
  loadDumpProfile,
  makeProfileEntity,
  makeQueryClient,
  makeWrapper,
  noopSupplier,
} from "../test-utils";
import { useContentPreview } from "./use-content-preview";

const CG_CONTENT_REL = "https://contentgrid.cloud/rels/contentgrid/content";
const RENDITION_REQUEST_URL = `${BASE}/renditions/get/pdf`;
const RENDITION_JOB_URL = `${BASE}/renditions/jobs/job-1`;
const RENDITION_URI_TEMPLATE = `${RENDITION_REQUEST_URL}{?url}`;
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

afterEach(() => {
  vi.useRealTimers();
});

function allAttributeProfile() {
  return makeProfileEntity(loadDumpProfile("all-attribute"), "all-attributes", "all-attribute");
}

interface MakeItemOptions {
  itemId?: string;
  metadata?: { filename: string | null; mimetype: string; length: number } | null;
  etag?: string | null;
}

function makeItem(options: MakeItemOptions = {}): EntityItem {
  const {
    itemId = "item-1",
    metadata = { filename: "report.pdf", mimetype: "application/pdf", length: 1024 },
    etag = '"v1"',
  } = options;
  const profile = allAttributeProfile();
  const itemUrl = `${BASE}/all-attributes/${itemId}`;
  const itemBody = {
    id: itemId,
    content: metadata,
    _links: {
      self: { href: itemUrl },
      [CG_CONTENT_REL]: [{ href: `${itemUrl}/content`, name: "content" }],
    },
  };
  const hal = new HalObject(itemBody as unknown as HalObjectShape<EntityItemShape>);
  return new EntityItem(hal, profile, etag);
}

function contentUrlFor(itemId: string): string {
  return `${BASE}/all-attributes/${itemId}/content`;
}

// ---------------------------------------------------------------------------
// Stored PDF
// ---------------------------------------------------------------------------

describe("useContentPreview — stored PDF", () => {
  it("returns { kind: 'pdf', origin: 'stored' } for a PDF content attribute", async () => {
    server.use(
      createContentDownloadHandler({
        url: contentUrlFor("item-1"),
        body: PDF_BYTES,
        contentType: "application/pdf",
        filename: "report.pdf",
      }),
    );

    const entityItem = makeItem();
    const { result } = renderHook(() => useContentPreview(entityItem, "content"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      kind: "pdf",
      bytes: expect.any(ArrayBuffer),
      filename: "report.pdf",
      origin: "stored",
    });
  });

  it("falls back to metadata.filename, then document.pdf", async () => {
    server.use(
      createContentDownloadHandler({
        url: contentUrlFor("item-1"),
        body: PDF_BYTES,
        contentType: "application/pdf",
      }),
    );

    const entityItem = makeItem({
      metadata: { filename: null, mimetype: "application/pdf", length: 4 },
    });
    const { result } = renderHook(() => useContentPreview(entityItem, "content"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ kind: "pdf", filename: "document.pdf" });
  });
});

describe("useContentPreview — noFile", () => {
  it("returns noFile when the stored download 404s", async () => {
    server.use(
      createProblemHandler({
        method: "get",
        url: contentUrlFor("item-1"),
        status: 404,
        title: "Not Found",
        type: "https://contentgrid.cloud/problems/not-found/content",
      }),
    );

    const entityItem = makeItem();
    const { result } = renderHook(() => useContentPreview(entityItem, "content"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ kind: "noFile" });
  });

  it("returns noFile without making any request when metadata is null", async () => {
    let requested = false;
    server.use(
      http.get(contentUrlFor("item-1"), () => {
        requested = true;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const entityItem = makeItem({ metadata: null });
    const { result } = renderHook(() => useContentPreview(entityItem, "content"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ kind: "noFile" });
    expect(requested).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Non-PDF: unavailable / rendition
// ---------------------------------------------------------------------------

describe("useContentPreview — no renditionUri configured", () => {
  it("returns unavailable without any request", async () => {
    const entityItem = makeItem({
      metadata: { filename: "report.docx", mimetype: "application/msword", length: 10 },
    });
    const { result } = renderHook(() => useContentPreview(entityItem, "content"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ kind: "unavailable", mimetype: "application/msword" });
  });
});

describe("useContentPreview — rendition ready", () => {
  it("returns { kind: 'pdf', origin: 'rendition' } when the rendition succeeds", async () => {
    server.use(
      ...createRenditionHandlers({
        url: RENDITION_REQUEST_URL,
        jobUrl: RENDITION_JOB_URL,
        pendingPolls: 0,
        outcome: "ready",
        pdfBytes: PDF_BYTES,
      }),
    );

    const entityItem = makeItem({
      metadata: { filename: "report.docx", mimetype: "application/msword", length: 10 },
    });
    const { result } = renderHook(() => useContentPreview(entityItem, "content"), {
      wrapper: makeWrapper(makeQueryClient(), undefined, undefined, RENDITION_URI_TEMPLATE),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      kind: "pdf",
      bytes: expect.any(ArrayBuffer),
      filename: "report.docx",
      origin: "rendition",
    });
  });
});

describe("useContentPreview — rendition invalid-conversion", () => {
  it("returns { kind: 'unsupported' } when the rendition service cannot convert the file", async () => {
    server.use(
      ...createRenditionHandlers({
        url: RENDITION_REQUEST_URL,
        jobUrl: RENDITION_JOB_URL,
        pendingPolls: 0,
        outcome: "invalid-conversion",
      }),
    );

    const entityItem = makeItem({
      metadata: { filename: "report.docx", mimetype: "application/msword", length: 10 },
    });
    const { result } = renderHook(() => useContentPreview(entityItem, "content"), {
      wrapper: makeWrapper(makeQueryClient(), undefined, undefined, RENDITION_URI_TEMPLATE),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ kind: "unsupported", mimetype: "application/msword" });
  });
});

describe("useContentPreview — rendition failure (poll-time 500)", () => {
  it("surfaces isError with the underlying problem", async () => {
    server.use(
      ...createRenditionHandlers({
        url: RENDITION_REQUEST_URL,
        jobUrl: RENDITION_JOB_URL,
        pendingPolls: 0,
        outcome: "error",
      }),
    );

    const entityItem = makeItem({
      metadata: { filename: "report.docx", mimetype: "application/msword", length: 10 },
    });
    const { result } = renderHook(() => useContentPreview(entityItem, "content"), {
      wrapper: makeWrapper(makeQueryClient(), undefined, undefined, RENDITION_URI_TEMPLATE),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe("useContentPreview — rendition timeout", () => {
  it("rejects with RenditionTimeoutError once the ceiling is reached", async () => {
    vi.useFakeTimers();
    server.use(
      ...createRenditionHandlers({
        url: RENDITION_REQUEST_URL,
        jobUrl: RENDITION_JOB_URL,
        pendingPolls: 0,
        outcome: "never",
      }),
    );

    const entityItem = makeItem({
      metadata: { filename: "report.docx", mimetype: "application/msword", length: 10 },
    });
    const { result } = renderHook(() => useContentPreview(entityItem, "content"), {
      wrapper: makeWrapper(makeQueryClient(), undefined, undefined, RENDITION_URI_TEMPLATE),
    });

    const pollsToExceedCeiling =
      Math.ceil(DEFAULT_RENDITION_TIMEOUT_MS / DEFAULT_RENDITION_POLL_INTERVAL_MS) + 1;
    for (let i = 0; i < pollsToExceedCeiling; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DEFAULT_RENDITION_POLL_INTERVAL_MS);
      });
    }

    expect(result.current.isError).toBe(true);
    expect(result.current.error?.name).toBe("RenditionTimeoutError");
  });
});

// ---------------------------------------------------------------------------
// Key change aborts polling
// ---------------------------------------------------------------------------

describe("useContentPreview — key change aborts in-flight polling", () => {
  it("stops polling the old job once the entity item (and its content href) changes", async () => {
    vi.useFakeTimers();

    let pollCountItem1 = 0;
    let pollCountItem2 = 0;
    const jobUrlFor1 = `${BASE}/renditions/jobs/job-item-1`;
    const jobUrlFor2 = `${BASE}/renditions/jobs/job-item-2`;

    server.use(
      http.get(RENDITION_REQUEST_URL, ({ request }) => {
        const contentHref = new URL(request.url).searchParams.get("url") ?? "";
        const jobUrl = contentHref.includes("item-2") ? jobUrlFor2 : jobUrlFor1;
        return new HttpResponse(null, { status: 202, headers: { Location: jobUrl } });
      }),
      http.get(jobUrlFor1, () => {
        pollCountItem1 += 1;
        return new HttpResponse(null, { status: 202, headers: { Location: jobUrlFor1 } });
      }),
      http.get(jobUrlFor2, () => {
        pollCountItem2 += 1;
        return new HttpResponse(null, { status: 202, headers: { Location: jobUrlFor2 } });
      }),
    );

    const item1 = makeItem({
      itemId: "item-1",
      metadata: { filename: "a.docx", mimetype: "application/msword", length: 10 },
    });
    const item2 = makeItem({
      itemId: "item-2",
      metadata: { filename: "b.docx", mimetype: "application/msword", length: 10 },
    });

    const { rerender } = renderHook(({ item }) => useContentPreview(item, "content"), {
      initialProps: { item: item1 },
      wrapper: makeWrapper(makeQueryClient(), undefined, undefined, RENDITION_URI_TEMPLATE),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_RENDITION_POLL_INTERVAL_MS * 2);
    });
    const pollCountAtSwitch = pollCountItem1;
    expect(pollCountAtSwitch).toBeGreaterThan(0);

    rerender({ item: item2 });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_RENDITION_POLL_INTERVAL_MS * 3);
    });

    // The old query's polling loop must not have produced any further calls after the
    // key changed — its `signal` was aborted, so it never reaches another `fetchStep`.
    expect(pollCountItem1).toBe(pollCountAtSwitch);
    // The new key's own polling is a separate, unrelated loop — it may or may not have
    // polled yet; not asserted here beyond "did not error the test".
    expect(pollCountItem2).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// ETag change → new key
// ---------------------------------------------------------------------------

describe("useContentPreview — ETag change produces a new key", () => {
  it("re-fetches (does not reuse the cache) when only the ETag changes", async () => {
    let downloadCount = 0;
    server.use(
      http.get(contentUrlFor("item-1"), () => {
        downloadCount += 1;
        return new HttpResponse(PDF_BYTES, {
          status: 200,
          headers: { "Content-Type": "application/pdf" },
        });
      }),
    );

    const itemV1 = makeItem({ etag: '"v1"' });
    const { result, rerender } = renderHook(({ item }) => useContentPreview(item, "content"), {
      initialProps: { item: itemV1 },
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(downloadCount).toBe(1);

    const itemV2 = makeItem({ etag: '"v2"' });
    rerender({ item: itemV2 });

    await waitFor(() => expect(downloadCount).toBe(2));
  });
});

// ---------------------------------------------------------------------------
// contentFetch used, apiFetch never
// ---------------------------------------------------------------------------

describe("useContentPreview — uses contentFetch, never apiFetch", () => {
  it("routes the download through contentFetch and never calls apiFetch", async () => {
    const contentFetchSpy = vi.fn(createContentClient(noopSupplier));
    const apiFetchSpy = vi.fn(createApiClient(noopSupplier));

    server.use(
      createContentDownloadHandler({
        url: contentUrlFor("item-1"),
        body: PDF_BYTES,
        contentType: "application/pdf",
      }),
    );

    const entityItem = makeItem();
    const { result } = renderHook(() => useContentPreview(entityItem, "content"), {
      wrapper: makeWrapper(makeQueryClient(), apiFetchSpy as never, contentFetchSpy as never),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(contentFetchSpy).toHaveBeenCalled();
    expect(apiFetchSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Non-content attribute name → synchronous throw
// ---------------------------------------------------------------------------

describe("useContentPreview — non-content attribute name", () => {
  it("throws synchronously when attributeName is not a content attribute", () => {
    const entityItem = makeItem();
    expect(() =>
      renderHook(() => useContentPreview(entityItem, "text"), { wrapper: makeWrapper() }),
    ).toThrow(/not a content attribute/);
  });
});
