/**
 * Tests for useUploadContent and useDownloadContent hooks.
 *
 * Covers:
 * - Upload success (PUT 204 → re-fetch GET → isSuccess, cache set + invalidated)
 * - Upload If-Match header sent verbatim from item.etag
 * - Upload 412 → isError, handler hit exactly once (no retry)
 * - Upload 415 → isError, ProblemDetailError
 * - Download success full (GET 200 + Blob → ContentDownload populated, isPartial false)
 * - Download range (Range header asserted, 206, isPartial true)
 * - Download 404 → isError
 * - Caller onSuccess runs after cache is populated (upload)
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { HalObject, type Link } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import { type ProblemDetail, ProblemDetailError } from "@contentgrid/problem-details";
import {
  createContentDownloadHandler,
  createContentUploadHandler,
  createProblemHandler,
} from "../../../test-fixtures/msw/handlers";
import { server } from "../../../test-setup";
import { EntityItem } from "../../accessors/entity-item";
import ProfileEntity from "../../accessors/entity-profile";
import { createContentClient } from "../../api/client";
import { queryKeys } from "../../query-keys";
import type { EntityItemShape, ProfileEntityShape } from "../../shapes";
import { BASE, makeQueryClient, makeWrapper, noopSupplier } from "../test-utils";
import { useDownloadContent, useUploadContent } from "./use-content";

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

/** Wire a GET handler for the re-fetch after upload success */
function wireRefetchHandler(etag = '"v2"') {
  server.use(
    http.get(INVOICE_ITEM_URL, () =>
      HttpResponse.json(
        {
          id: "inv-001",
          document: { filename: "file.pdf", mimetype: "application/pdf", length: 512 },
          _links: {
            self: { href: INVOICE_ITEM_URL },
            [CG_CONTENT_REL]: [{ href: CONTENT_URL, name: "document" }],
          },
        },
        { headers: { ETag: etag } },
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// useUploadContent — success
// ---------------------------------------------------------------------------

describe("useUploadContent — upload success (PUT 204 → re-fetch → cache)", () => {
  it("returns isSuccess on upload", async () => {
    server.use(createContentUploadHandler({ url: CONTENT_URL }));
    wireRefetchHandler('"v2"');

    const entityItem = makeEntityItemWithContentLink('"v1"');
    const { result } = renderHook(() => useUploadContent(entityItem, "document"), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({ file: new File(["hello"], "hello.txt", { type: "text/plain" }) });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeInstanceOf(EntityItem);
    expect(result.current.data?.etag).toBe('"v2"');
  });

  it("writes fresh item to setQueryData after upload success", async () => {
    server.use(createContentUploadHandler({ url: CONTENT_URL }));
    wireRefetchHandler('"v2"');

    const queryClient = makeQueryClient();
    const profile = makeInvoiceProfile();
    const entityItem = makeEntityItemWithContentLink('"v1"');

    const { result } = renderHook(() => useUploadContent(entityItem, "document"), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ file: new File(["hello"], "hello.txt", { type: "text/plain" }) });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = queryClient.getQueryData(queryKeys.entityItem.byUrl(profile, INVOICE_ITEM_URL));
    expect(cached).toBeInstanceOf(EntityItem);
  });

  it("invalidates entityItemCollection.forEntity on success", async () => {
    server.use(createContentUploadHandler({ url: CONTENT_URL }));
    wireRefetchHandler();

    const queryClient = makeQueryClient();
    const profile = makeInvoiceProfile();
    const entityItem = makeEntityItemWithContentLink('"v1"');
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUploadContent(entityItem, "document"), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ file: new File(["hello"], "hello.txt", { type: "text/plain" }) });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.entityItemCollection.forEntity(profile),
    });
  });

  it("calls caller onSuccess after cache is populated", async () => {
    server.use(createContentUploadHandler({ url: CONTENT_URL }));
    wireRefetchHandler();

    const queryClient = makeQueryClient();
    const profile = makeInvoiceProfile();
    const entityItem = makeEntityItemWithContentLink('"v1"');

    let cacheAtCallTime: unknown = "NOT_CHECKED";
    const callerOnSuccess = vi.fn(async () => {
      cacheAtCallTime = queryClient.getQueryData(
        queryKeys.entityItem.byUrl(profile, INVOICE_ITEM_URL),
      );
    });

    const { result } = renderHook(
      () =>
        useUploadContent(entityItem, "document", {
          mutationOptions: { onSuccess: callerOnSuccess },
        }),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate({ file: new File(["hello"], "hello.txt", { type: "text/plain" }) });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(callerOnSuccess).toHaveBeenCalledOnce();
    expect(cacheAtCallTime).toBeInstanceOf(EntityItem);
  });
});

// ---------------------------------------------------------------------------
// useUploadContent — If-Match header
// ---------------------------------------------------------------------------

describe("useUploadContent — If-Match header", () => {
  it("sends If-Match verbatim from item.etag", async () => {
    let capturedIfMatch: string | null = null;

    server.use(
      http.put(CONTENT_URL, async ({ request }) => {
        capturedIfMatch = request.headers.get("If-Match");
        return new HttpResponse(null, { status: 204 });
      }),
    );
    wireRefetchHandler();

    const entityItem = makeEntityItemWithContentLink('"v1"');
    const { result } = renderHook(() => useUploadContent(entityItem, "document"), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({ file: new File(["hello"], "hello.txt", { type: "text/plain" }) });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedIfMatch).toBe('"v1"');
  });

  it("omits If-Match when etag is null", async () => {
    let capturedIfMatch: string | null | undefined = undefined;

    server.use(
      http.put(CONTENT_URL, async ({ request }) => {
        capturedIfMatch = request.headers.get("If-Match");
        return new HttpResponse(null, { status: 204 });
      }),
    );
    wireRefetchHandler();

    const entityItem = makeEntityItemWithContentLink(null);
    const { result } = renderHook(() => useUploadContent(entityItem, "document"), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({ file: new File(["hello"], "hello.txt", { type: "text/plain" }) });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedIfMatch).toBeNull();
  });

  it("uses contentFetch (not apiFetch) for the PUT — confirms the binary client is used", async () => {
    // We inject a spy as contentFetch; the PUT must be routed through it.
    const realContentFetch = createContentClient(noopSupplier);
    const contentFetchSpy = vi.fn(realContentFetch);

    server.use(createContentUploadHandler({ url: CONTENT_URL }));
    wireRefetchHandler();

    const entityItem = makeEntityItemWithContentLink('"v1"');
    const { result } = renderHook(() => useUploadContent(entityItem, "document"), {
      wrapper: makeWrapper(makeQueryClient(), undefined, contentFetchSpy as never),
    });

    await act(async () => {
      result.current.mutate({ file: new File(["hello"], "hello.txt", { type: "text/plain" }) });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // contentFetch was called at least once (for the PUT)
    expect(contentFetchSpy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useUploadContent — 412 ETag mismatch
// ---------------------------------------------------------------------------

describe("useUploadContent — 412 ETag mismatch", () => {
  it("surfaces 412 as ProblemDetailError and PUT handler is hit exactly once (no retry)", async () => {
    let putCallCount = 0;

    server.use(
      http.put(CONTENT_URL, () => {
        putCallCount++;
        return HttpResponse.json(
          {
            status: 412,
            title: "Precondition Failed",
            type: "https://contentgrid.cloud/problems/unsatisfied-version",
          },
          { status: 412, headers: { "Content-Type": "application/problem+json" } },
        );
      }),
    );

    const entityItem = makeEntityItemWithContentLink('"v1"');
    const { result } = renderHook(() => useUploadContent(entityItem, "document"), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({ file: new File(["hello"], "hello.txt", { type: "text/plain" }) });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProblemDetailError);
    expect((result.current.error as ProblemDetailError<ProblemDetail>).problemDetail.status).toBe(
      412,
    );
    // No retry — PUT handler called exactly once
    expect(putCallCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// useUploadContent — 415 Unsupported Media Type
// ---------------------------------------------------------------------------

describe("useUploadContent — 415 Unsupported Media Type", () => {
  it("surfaces 415 as ProblemDetailError", async () => {
    server.use(
      createProblemHandler({
        method: "put",
        url: CONTENT_URL,
        status: 415,
        title: "Unsupported Media Type",
        type: "https://contentgrid.cloud/problems/unsupported-media-type",
      }),
    );

    const entityItem = makeEntityItemWithContentLink('"v1"');
    const { result } = renderHook(() => useUploadContent(entityItem, "document"), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({ file: new File(["hello"], "hello.txt", { type: "text/plain" }) });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProblemDetailError);
    expect((result.current.error as ProblemDetailError<ProblemDetail>).problemDetail.status).toBe(
      415,
    );
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
      result.current.mutate({ file: new File(["hello"], "hello.txt", { type: "text/plain" }) });
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
