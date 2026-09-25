/**
 * Tests for useUploadContent and useDownloadContent hooks.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HalObject, type Link } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import { type ProblemDetail, ProblemDetailError } from "@contentgrid/problem-details";
import {
  createContentDownloadHandler,
  createContentUploadHandler,
  createProblemHandler,
} from "../../../test-fixtures/msw/handlers";
import { assertXhrExists, makeFakeXhr } from "../../../test-fixtures/xhr";
import { server } from "../../../test-setup";
import { EntityItem } from "../../accessors/entity-item";
import ProfileEntity from "../../accessors/entity-profile";
import { createContentClient } from "../../api/client";
import { queryKeys } from "../../query-keys";
import type { EntityItemShape, ProfileEntityShape } from "../../shapes";
import { BASE, makeQueryClient, makeWrapper, noopSupplier } from "../test-utils";
import { useDownloadContent, useUploadContent } from "./use-content";

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Fixture URLs
// ---------------------------------------------------------------------------

const INVOICE_PROFILE_URL = `${BASE}/profile/invoices`;
const INVOICE_ITEM_URL = `${BASE}/invoices/inv-001`;
const CONTENT_URL = `${INVOICE_ITEM_URL}/document`;
const CG_CONTENT_REL = "https://contentgrid.cloud/rels/contentgrid/content";

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

function makeInvoiceProfile(): ProfileEntity {
  const profileBody = {
    name: "invoice",
    title: "invoice",
    _links: {
      self: { href: INVOICE_PROFILE_URL },
      describes: [
        { href: `${BASE}/invoices`, name: "collection" },
        { href: `${BASE}/invoices/{id}`, name: "item", templated: true },
      ],
    },
  };
  const hal = new HalObject(profileBody as unknown as ProfileEntityShape);
  return new ProfileEntity(
    { href: INVOICE_PROFILE_URL, name: "invoice", title: "invoice" } as unknown as Link,
    hal as HalObject<ProfileEntityShape>,
  );
}

function makeEntityItemWithContentLink(etag: string | null = '"v1"'): EntityItem {
  const profile = makeInvoiceProfile();
  const itemBody = {
    id: "inv-001",
    document: { filename: "file.pdf", mimetype: "application/pdf", length: 1024 },
    _links: {
      self: { href: INVOICE_ITEM_URL },
      [CG_CONTENT_REL]: [{ href: CONTENT_URL, name: "document" }],
    },
  };
  const hal = new HalObject(itemBody as unknown as HalObjectShape<EntityItemShape>);
  return new EntityItem(hal, profile, etag);
}

const FILE = () => new File(["hello"], "hello.txt", { type: "text/plain" });

// ---------------------------------------------------------------------------
// useUploadContent — success
// ---------------------------------------------------------------------------

describe("useUploadContent — success (PUT 204 → invalidate)", () => {
  it("invalidates the entity item and its collections before the caller's onSuccess runs", async () => {
    server.use(createContentUploadHandler({ url: CONTENT_URL }));

    const queryClient = makeQueryClient();
    const profile = makeInvoiceProfile();
    const entityItem = makeEntityItemWithContentLink('"v1"');
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    let invalidatedKeysAtCallTime: unknown[] = [];
    const callerOnSuccess = vi.fn(() => {
      invalidatedKeysAtCallTime = invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey);
    });

    const { result } = renderHook(
      () =>
        useUploadContent(entityItem, "document", {
          mutationOptions: { onSuccess: callerOnSuccess },
        }),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate({ file: FILE() });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(callerOnSuccess).toHaveBeenCalledOnce();
    expect(invalidatedKeysAtCallTime).toEqual(
      expect.arrayContaining([
        queryKeys.entityItem.byUrl(profile, INVOICE_ITEM_URL),
        queryKeys.entityItemCollection.forEntity(profile),
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// useUploadContent — progress and cancel
//
// These drive the underlying XMLHttpRequest by hand (via the makeFakeXhr stub)
// because progress events are a transport-level detail MSW cannot synthesize.
// ---------------------------------------------------------------------------

describe("useUploadContent — progress", () => {
  it("starts at 0 and tracks XHR upload progress events", async () => {
    const { FakeXMLHttpRequest, getLastXhr } = makeFakeXhr();
    vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);

    const entityItem = makeEntityItemWithContentLink('"v1"');
    const { result } = renderHook(() => useUploadContent(entityItem, "document"), {
      wrapper: makeWrapper(),
    });

    expect(result.current.progress).toBe(0);

    await act(async () => {
      result.current.mutate({ file: FILE() });
    });

    await waitFor(() => expect(getLastXhr()?.send).toHaveBeenCalled());
    const xhr = getLastXhr();
    assertXhrExists(xhr);

    act(() => {
      xhr.upload.onprogress?.({ lengthComputable: true, loaded: 40, total: 100 });
    });
    expect(result.current.progress).toBe(40);
  });
});

describe("useUploadContent — cancel", () => {
  it("aborts the in-flight upload, leaves the hook idle and never reports the abort to onError", async () => {
    const { FakeXMLHttpRequest, getLastXhr } = makeFakeXhr();
    vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);

    const queryClient = makeQueryClient();
    const entityItem = makeEntityItemWithContentLink('"v1"');
    const onError = vi.fn();
    const { result } = renderHook(
      () => useUploadContent(entityItem, "document", { mutationOptions: { onError } }),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate({ file: FILE() });
    });

    await waitFor(() => expect(getLastXhr()?.send).toHaveBeenCalled());
    const xhr = getLastXhr();
    assertXhrExists(xhr);

    act(() => {
      result.current.cancel();
    });

    expect(xhr.abort).toHaveBeenCalled();
    // The aborted mutation has fully settled (its onError included) once nothing is pending.
    await waitFor(() => expect(queryClient.isMutating()).toBe(0));
    expect(result.current.isIdle).toBe(true);
    expect(onError).not.toHaveBeenCalled();
  });

  it("does not let a cancelled attempt's late rejection corrupt a newer attempt started right after it", async () => {
    const { FakeXMLHttpRequest, getLastXhr } = makeFakeXhr();
    vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);

    const queryClient = makeQueryClient();
    const entityItem = makeEntityItemWithContentLink('"v1"');
    const onError = vi.fn();
    const { result } = renderHook(
      () => useUploadContent(entityItem, "document", { mutationOptions: { onError } }),
      { wrapper: makeWrapper(queryClient) },
    );

    // Start attempt A and cancel it.
    await act(async () => {
      result.current.mutate({ file: new File(["a"], "a.txt", { type: "text/plain" }) });
    });
    await waitFor(() => expect(getLastXhr()?.send).toHaveBeenCalled());
    const xhrA = getLastXhr();
    act(() => {
      result.current.cancel();
    });

    // Immediately start attempt B, before A's aborted request has settled.
    await act(async () => {
      result.current.mutate({ file: new File(["b"], "b.txt", { type: "text/plain" }) });
    });
    await waitFor(() => expect(getLastXhr()).not.toBe(xhrA));
    const xhrB = getLastXhr();
    assertXhrExists(xhrB);
    await waitFor(() => expect(xhrB.send).toHaveBeenCalled());

    act(() => {
      xhrB.upload.onprogress?.({ lengthComputable: true, loaded: 30, total: 100 });
    });

    // A has settled once only B is still pending.
    await waitFor(() => expect(queryClient.isMutating()).toBe(1));
    expect(result.current.progress).toBe(30);
    expect(result.current.isPending).toBe(true);
    expect(onError).not.toHaveBeenCalled();

    // A settling must not have dropped B's abort handle.
    act(() => {
      result.current.cancel();
    });
    expect(xhrB.abort).toHaveBeenCalled();
  });

  it("invalidates the entity item's cached query — an abort can't confirm the server didn't already commit the write", async () => {
    const { FakeXMLHttpRequest, getLastXhr } = makeFakeXhr();
    vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);

    const queryClient = makeQueryClient();
    const profile = makeInvoiceProfile();
    const entityItem = makeEntityItemWithContentLink('"v1"');
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUploadContent(entityItem, "document"), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ file: FILE() });
    });

    await waitFor(() => expect(getLastXhr()?.send).toHaveBeenCalled());

    act(() => {
      result.current.cancel();
    });

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.entityItem.byUrl(profile, INVOICE_ITEM_URL),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// useUploadContent — 415 Unsupported Media Type
// ---------------------------------------------------------------------------

describe("useUploadContent — 415 Unsupported Media Type", () => {
  it("surfaces 415 as ProblemDetailError, no retry", async () => {
    let putCallCount = 0;

    server.use(
      http.put(CONTENT_URL, () => {
        putCallCount++;
        return HttpResponse.json(
          {
            status: 415,
            title: "Unsupported Media Type",
            type: "https://contentgrid.cloud/problems/unsupported-media-type",
          },
          { status: 415, headers: { "Content-Type": "application/problem+json" } },
        );
      }),
    );

    const entityItem = makeEntityItemWithContentLink('"v1"');
    const { result } = renderHook(() => useUploadContent(entityItem, "document"), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({ file: FILE() });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProblemDetailError);
    expect((result.current.error as ProblemDetailError<ProblemDetail>).problemDetail.status).toBe(
      415,
    );
    // No retry — PUT handler called exactly once
    expect(putCallCount).toBe(1);
  });

  it("invalidates the entity item's cached query on failure — the displayed metadata could be stale if the write raced through anyway", async () => {
    server.use(
      createProblemHandler({
        method: "put",
        url: CONTENT_URL,
        status: 415,
        title: "Unsupported Media Type",
        type: "https://contentgrid.cloud/problems/unsupported-media-type",
      }),
    );

    const queryClient = makeQueryClient();
    const profile = makeInvoiceProfile();
    const entityItem = makeEntityItemWithContentLink('"v1"');
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUploadContent(entityItem, "document"), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ file: FILE() });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.entityItem.byUrl(profile, INVOICE_ITEM_URL),
    });
  });
});

// ---------------------------------------------------------------------------
// useDownloadContent — full download (200)
// ---------------------------------------------------------------------------

describe("useDownloadContent — full download success (GET 200)", () => {
  it("returns isSuccess with ContentDownload populated", async () => {
    server.use(
      createContentDownloadHandler({
        url: CONTENT_URL,
        body: new Uint8Array([0x25, 0x50, 0x44, 0x46]), // %PDF header
        contentType: "application/pdf",
        filename: "invoice.pdf",
      }),
    );

    const entityItem = makeEntityItemWithContentLink();
    const { result } = renderHook(() => useDownloadContent(entityItem, "document"), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    // Blob identity can differ between jsdom and Node environments; check size > 0 as a proxy.
    expect(data.blob).toBeTruthy();
    expect(data.blob.size).toBeGreaterThan(0);
    expect(data.mimetype).toBe("application/pdf");
    expect(data.filename).toBe("invoice.pdf");
    expect(data.isPartial).toBe(false);
  });

  it("sets contentLength from Content-Length header", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    server.use(
      createContentDownloadHandler({
        url: CONTENT_URL,
        body: bytes,
        contentType: "application/octet-stream",
      }),
    );

    const entityItem = makeEntityItemWithContentLink();
    const { result } = renderHook(() => useDownloadContent(entityItem, "document"), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Content-Length is set by the handler to body.length
    expect(result.current.data?.contentLength).toBe(4);
  });

  it("sets filename to null when Content-Disposition is absent", async () => {
    server.use(
      createContentDownloadHandler({
        url: CONTENT_URL,
        body: new Uint8Array([0x00]),
        contentType: "application/octet-stream",
        // no filename
      }),
    );

    const entityItem = makeEntityItemWithContentLink();
    const { result } = renderHook(() => useDownloadContent(entityItem, "document"), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.filename).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// useDownloadContent — range download (206)
// ---------------------------------------------------------------------------

describe("useDownloadContent — range download (206 Partial Content)", () => {
  it("sends Range header and returns isPartial=true on 206", async () => {
    let capturedRange: string | null = null;

    server.use(
      http.get(CONTENT_URL, ({ request }) => {
        capturedRange = request.headers.get("Range");
        return new HttpResponse(new Uint8Array([1, 2, 3]), {
          status: 206,
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Range": "bytes 0-2/1024",
            "Content-Length": "3",
          },
        });
      }),
    );

    const entityItem = makeEntityItemWithContentLink();
    const { result } = renderHook(() => useDownloadContent(entityItem, "document"), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({ range: { start: 0, end: 2 } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedRange).toBe("bytes=0-2");
    expect(result.current.data?.isPartial).toBe(true);
    // Blob identity can differ between jsdom and Node environments; check size > 0 as a proxy.
    expect(result.current.data?.blob).toBeTruthy();
    expect(result.current.data?.blob.size).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// useDownloadContent — 404
// ---------------------------------------------------------------------------

describe("useDownloadContent — 404 Not Found", () => {
  it("surfaces 404 as ProblemDetailError", async () => {
    server.use(
      createProblemHandler({
        method: "get",
        url: CONTENT_URL,
        status: 404,
        title: "Not Found",
        type: "https://contentgrid.cloud/problems/not-found/entity-item",
      }),
    );

    const entityItem = makeEntityItemWithContentLink();
    const { result } = renderHook(() => useDownloadContent(entityItem, "document"), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProblemDetailError);
    expect((result.current.error as ProblemDetailError<ProblemDetail>).problemDetail.status).toBe(
      404,
    );
  });
});

// ---------------------------------------------------------------------------
// useDownloadContent — uses contentFetch (binary client)
// ---------------------------------------------------------------------------

describe("useDownloadContent — uses contentFetch not apiFetch", () => {
  it("routes GET through contentFetch (binary client)", async () => {
    const realContentFetch = createContentClient(noopSupplier);
    const contentFetchSpy = vi.fn(realContentFetch);

    server.use(
      createContentDownloadHandler({
        url: CONTENT_URL,
        body: new Uint8Array([0x00]),
        contentType: "application/octet-stream",
      }),
    );

    const entityItem = makeEntityItemWithContentLink();
    const { result } = renderHook(() => useDownloadContent(entityItem, "document"), {
      wrapper: makeWrapper(makeQueryClient(), undefined, contentFetchSpy as never),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(contentFetchSpy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ABAC: cg:content link absent — hooks must surface isError
// ---------------------------------------------------------------------------

function makeEntityItemWithoutContentLink(): EntityItem {
  const profile = makeInvoiceProfile();
  const itemBody = {
    id: "inv-002",
    document: null,
    _links: {
      self: { href: INVOICE_ITEM_URL },
      // no cg:content link → ABAC deny
    },
  };
  const hal = new HalObject(itemBody as unknown as HalObjectShape<EntityItemShape>);
  return new EntityItem(hal, profile, '"v1"');
}

describe("useUploadContent — ABAC: cg:content link absent", () => {
  it("surfaces isError when the entity item has no cg:content link", async () => {
    const entityItem = makeEntityItemWithoutContentLink();
    const { result } = renderHook(() => useUploadContent(entityItem, "document"), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({ file: FILE() });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toMatch(/cg:content link absent/);
  });
});

describe("useDownloadContent — ABAC: cg:content link absent", () => {
  it("surfaces isError when the entity item has no cg:content link", async () => {
    const entityItem = makeEntityItemWithoutContentLink();
    const { result } = renderHook(() => useDownloadContent(entityItem, "document"), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toMatch(/cg:content link absent/);
  });
});
