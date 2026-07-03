/**
 * Tests for useDeleteEntityItem hook.
 *
 * Covers:
 * - Success DELETE → 204, returned data === the passed EntityItem
 * - If-Match header sent verbatim from item.etag
 * - null etag → no If-Match header attached (addIfMatchHeader returns original request)
 * - Cache: removeQueries on entityItem.byUrl key after success
 * - Cache: invalidateQueries on entityItemCollection.forEntity after success
 * - Caller onSuccess runs after cache cleanup
 * - 409 integrity/required-relation → isError with ProblemDetailError
 * - 412 ETag mismatch → isError, ProblemDetailError status 412, DELETE handler hit exactly once (no retry)
 * - ABAC: absent delete template → mutate → isError (explicit guard throw)
 * - 404 not-found/entity-item → isError, ProblemDetailError status 404
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HalObject, type Link } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import { type ProblemDetail, ProblemDetailError } from "@contentgrid/problem-details";
import {
  invoiceDeleteTemplate,
  invoiceProfileBody,
  sampleInvoice,
} from "../../test-fixtures/hal/fixtures";
import { createDeleteHandler, createProblemHandler } from "../../test-fixtures/msw/handlers";
import { server } from "../../test-setup";
import { EntityItem } from "../accessors/entity-item";
import ProfileEntity from "../accessors/entity-profile";
import { queryKeys } from "../query-keys";
import type { EntityItemShape, ProfileEntityShape } from "../shapes";
import { useDeleteEntityItem } from "./item/use-delete-entity";
import { BASE, makeQueryClient, makeWrapper } from "./test-utils";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const INVOICE_PROFILE_URL = `${BASE}/profile/invoices`;
const INVOICE_ITEM_URL = `${BASE}/invoices/inv-001`;

// Build a ProfileEntity wrapping the invoice profile fixture
function makeInvoiceProfile(): ProfileEntity {
  const profileBody = {
    ...invoiceProfileBody,
    _links: {
      ...invoiceProfileBody._links,
      self: { href: INVOICE_PROFILE_URL },
      describes: [
        { href: `${BASE}/invoices`, name: "collection" },
        { href: `${BASE}/invoices/{id}`, name: "item", templated: true },
      ],
    },
  };
  const hal = new HalObject(profileBody as unknown as ProfileEntityShape);
  return new ProfileEntity(
    { href: INVOICE_PROFILE_URL, name: "invoice", title: "Invoice" } as unknown as Link,
    hal as HalObject<ProfileEntityShape>,
  );
}

// Build an EntityItem that has a delete template wired, with optional etag
function makeEntityItemWithDeleteTemplate(etag: string | null = '"v1"'): EntityItem {
  const profile = makeInvoiceProfile();
  const itemBody = {
    ...sampleInvoice,
    _links: {
      ...sampleInvoice._links,
      self: { href: INVOICE_ITEM_URL },
    },
    _templates: {
      delete: {
        ...invoiceDeleteTemplate,
        target: INVOICE_ITEM_URL,
      },
    },
  };
  const hal = new HalObject(itemBody as unknown as HalObjectShape<EntityItemShape>);
  return new EntityItem(hal, profile, etag);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useDeleteEntityItem — success DELETE → data is the EntityItem", () => {
  it("returns the deleted EntityItem on success", async () => {
    server.use(createDeleteHandler({ url: INVOICE_ITEM_URL }));

    const entityItem = makeEntityItemWithDeleteTemplate('"v1"');
    const { result } = renderHook(() => useDeleteEntityItem(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(entityItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeInstanceOf(EntityItem);
    expect(result.current.data).toBe(entityItem);
  });
});

describe("useDeleteEntityItem — If-Match header", () => {
  it("sends If-Match verbatim from item.etag", async () => {
    let capturedIfMatch: string | null = null;

    server.use(createDeleteHandler({ url: INVOICE_ITEM_URL }));

    // Override to capture the header
    const { http, HttpResponse } = await import("msw");
    server.use(
      http.delete(INVOICE_ITEM_URL, async ({ request }) => {
        capturedIfMatch = request.headers.get("If-Match");
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const entityItem = makeEntityItemWithDeleteTemplate('"v1"');
    const { result } = renderHook(() => useDeleteEntityItem(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(entityItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedIfMatch).toBe('"v1"');
  });

  it("sends no If-Match header when etag is null", async () => {
    let capturedIfMatch: string | null | undefined = undefined;

    const { http, HttpResponse } = await import("msw");
    server.use(
      http.delete(INVOICE_ITEM_URL, async ({ request }) => {
        capturedIfMatch = request.headers.get("If-Match");
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const entityItem = makeEntityItemWithDeleteTemplate(null);
    const { result } = renderHook(() => useDeleteEntityItem(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(entityItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedIfMatch).toBeNull();
  });
});

describe("useDeleteEntityItem — cache behaviour", () => {
  it("removes entityItem.byUrl query data after success", async () => {
    server.use(createDeleteHandler({ url: INVOICE_ITEM_URL }));

    const queryClient = makeQueryClient();
    const profile = makeInvoiceProfile();
    const entityItem = makeEntityItemWithDeleteTemplate('"v1"');

    // Pre-populate the item cache so we can verify removal
    queryClient.setQueryData(queryKeys.entityItem.byUrl(profile, INVOICE_ITEM_URL), entityItem);

    const { result } = renderHook(() => useDeleteEntityItem(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(entityItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = queryClient.getQueryData(queryKeys.entityItem.byUrl(profile, INVOICE_ITEM_URL));
    expect(cached).toBeUndefined();
  });

  it("invalidates entity collection queries after success", async () => {
    server.use(createDeleteHandler({ url: INVOICE_ITEM_URL }));

    const queryClient = makeQueryClient();
    const profile = makeInvoiceProfile();
    const entityItem = makeEntityItemWithDeleteTemplate('"v1"');

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteEntityItem(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(entityItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.entityItemCollection.forEntity(profile),
    });
  });

  it("calls caller onSuccess after cache is already cleaned up", async () => {
    server.use(createDeleteHandler({ url: INVOICE_ITEM_URL }));

    const queryClient = makeQueryClient();
    const profile = makeInvoiceProfile();
    const entityItem = makeEntityItemWithDeleteTemplate('"v1"');

    // Pre-populate so we can verify removal happened before onSuccess fires
    queryClient.setQueryData(queryKeys.entityItem.byUrl(profile, INVOICE_ITEM_URL), entityItem);

    let cacheAtCallTime: unknown = "NOT_CHECKED";
    const callerOnSuccess = vi.fn(async () => {
      cacheAtCallTime = queryClient.getQueryData(
        queryKeys.entityItem.byUrl(profile, INVOICE_ITEM_URL),
      );
    });

    const { result } = renderHook(
      () =>
        useDeleteEntityItem({
          mutationOptions: { onSuccess: callerOnSuccess },
        }),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate(entityItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(callerOnSuccess).toHaveBeenCalledOnce();
    // Cache must already be removed when caller onSuccess runs
    expect(cacheAtCallTime).toBeUndefined();
  });
});

describe("useDeleteEntityItem — error handling", () => {
  it("surfaces 409 integrity/required-relation as ProblemDetailError", async () => {
    server.use(
      createProblemHandler({
        method: "delete",
        url: INVOICE_ITEM_URL,
        status: 409,
        type: "https://contentgrid.cloud/problems/integrity/required-relation",
        title: "Required relation prevents deletion",
      }),
    );

    const entityItem = makeEntityItemWithDeleteTemplate('"v1"');
    const { result } = renderHook(() => useDeleteEntityItem(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(entityItem);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProblemDetailError);
    const problemError = result.current.error as ProblemDetailError<ProblemDetail>;
    expect(problemError.problemDetail.type).toContain("integrity/required-relation");
  });

  it("surfaces 412 as ProblemDetailError with status 412 and DELETE handler hit exactly once (no retry)", async () => {
    let deleteCallCount = 0;

    const { http, HttpResponse } = await import("msw");
    server.use(
      http.delete(INVOICE_ITEM_URL, () => {
        deleteCallCount++;
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

    const entityItem = makeEntityItemWithDeleteTemplate('"v1"');
    const { result } = renderHook(() => useDeleteEntityItem(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(entityItem);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProblemDetailError);
    expect((result.current.error as ProblemDetailError<ProblemDetail>).problemDetail.status).toBe(
      412,
    );
    // No retry — DELETE handler called exactly once
    expect(deleteCallCount).toBe(1);
  });
});

describe("useDeleteEntityItem — ABAC: absent delete template", () => {
  it("isError when entity item has no delete template (ABAC guard)", async () => {
    const profile = makeInvoiceProfile();
    // Build an EntityItem WITHOUT a delete template — simulates ABAC denial
    const itemBody = {
      ...sampleInvoice,
      _links: {
        ...sampleInvoice._links,
        self: { href: INVOICE_ITEM_URL },
      },
      // No _templates at all — delete template absent
    };
    const hal = new HalObject(itemBody as unknown as HalObjectShape<EntityItemShape>);
    const entityItem = new EntityItem(hal, profile, '"v1"');

    const { result } = renderHook(() => useDeleteEntityItem(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(entityItem);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain("delete");
  });
});

describe("useDeleteEntityItem — 404 not-found/entity-item", () => {
  it("isError with ProblemDetailError status 404 when server returns not-found/entity-item", async () => {
    server.use(
      createProblemHandler({
        method: "delete",
        url: INVOICE_ITEM_URL,
        status: 404,
        type: "https://contentgrid.cloud/problems/not-found/entity-item",
        title: "Entity item not found",
      }),
    );

    const entityItem = makeEntityItemWithDeleteTemplate('"v1"');
    const { result } = renderHook(() => useDeleteEntityItem(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(entityItem);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProblemDetailError);
    const problemError = result.current.error as ProblemDetailError<ProblemDetail>;
    expect(problemError.problemDetail.status).toBe(404);
    expect(problemError.problemDetail.type).toContain("not-found/entity-item");
  });
});
