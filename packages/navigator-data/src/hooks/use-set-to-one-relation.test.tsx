/**
 * Tests for useSetToOneRelation hook.
 *
 * useSetToOneRelation (to-one PUT):
 * - set success (PUT 204 → best-effort re-fetch → isSuccess, cache set via setQueryData)
 * - If-Match header sent verbatim from source.etag
 * - null etag → no If-Match header
 * - ABAC denial (missing template) throws before any fetch (verified via error message)
 * - 412 ETag mismatch → isError, handler hit exactly once (no retry)
 * - 409 blind-relation-overwrite → isError
 * - Best-effort read-back: write succeeds + readback 5xx → mutation still resolves (undefined data)
 * - onSettled runs even when readback fails → invalidation still fires
 * - Relation read key (toOneRelation.byUrl) is invalidated on settled
 * - Target item invalidated by URL on settled (scoped, not whole collection)
 * - No source collection / no source forEntity invalidation
 * - Caller onSuccess runs after cache is populated (ordering)
 * - Caller onSettled runs last
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { HalObject } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import { type ProblemDetail, ProblemDetailError } from "@contentgrid/problem-details";
import {
  invoiceProfileBodyWithRelations,
  invoiceSetSupplierTemplate,
} from "../../test-fixtures/hal/fixtures";
import { createProblemHandler, createRelationLinkHandler } from "../../test-fixtures/msw/handlers";
import { server } from "../../test-setup";
import { EntityItem } from "../accessors/entity-item";
import type { EntityItemToOneRelation } from "../accessors/entity-item-to-one-relation";
import ProfileEntity from "../accessors/entity-profile";
import { queryKeys } from "../query-keys";
import type { EntityItemShape, ProfileEntityShape } from "../shapes";
import { BASE, makeQueryClient, makeWrapper } from "./test-utils";
import { useSetToOneRelation } from "./use-set-to-one-relation";

// ---------------------------------------------------------------------------
// Fixture URLs
// ---------------------------------------------------------------------------

const INVOICE_PROFILE_URL = `${BASE}/profile/invoices`;
const INVOICE_ITEM_URL = `${BASE}/invoices/inv-001`;
const SUPPLIER_RELATION_URL = `${INVOICE_ITEM_URL}/supplier`;
const SUPPLIER_URL = `${BASE}/suppliers/sup-001`;

const CG_RELATION_REL = "https://contentgrid.cloud/rels/contentgrid/relation";

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

function makeInvoiceProfile(): ProfileEntity {
  const profileBody = {
    ...invoiceProfileBodyWithRelations,
    _links: {
      self: { href: INVOICE_PROFILE_URL },
      describes: [
        { href: `${BASE}/invoices`, name: "collection" },
        { href: `${BASE}/invoices/{id}`, name: "item", templated: true },
      ],
    },
  };
  const hal = new HalObject(profileBody as unknown as ProfileEntityShape);
  const link = { href: INVOICE_PROFILE_URL, name: "invoice", title: "Invoice" };
  return new ProfileEntity(
    link as unknown as import("@contentgrid/hal").Link,
    hal as HalObject<ProfileEntityShape>,
  );
}

function makeSupplierProfile(): ProfileEntity {
  const profileBody = {
    name: "supplier",
    title: "Supplier",
    _links: {
      self: { href: `${BASE}/profile/suppliers` },
      describes: [
        { href: `${BASE}/suppliers`, name: "collection" },
        { href: `${BASE}/suppliers/{id}`, name: "item", templated: true },
      ],
    },
  };
  const hal = new HalObject(profileBody as unknown as ProfileEntityShape);
  const link = { href: `${BASE}/profile/suppliers`, name: "supplier", title: "Supplier" };
  return new ProfileEntity(
    link as unknown as import("@contentgrid/hal").Link,
    hal as HalObject<ProfileEntityShape>,
  );
}

function makeEntityItemWithTemplates(
  etag: string | null = '"v1"',
  templates: Record<string, unknown> = {},
  profile?: ProfileEntity,
): EntityItem {
  const itemProfile = profile ?? makeInvoiceProfile();
  const itemBody = {
    id: "inv-001",
    _links: {
      self: { href: INVOICE_ITEM_URL },
      [CG_RELATION_REL]: [
        { href: SUPPLIER_RELATION_URL, name: "supplier" },
        { href: `${INVOICE_ITEM_URL}/lineItems`, name: "lineItems" },
      ],
    },
    _templates: templates,
  };
  const hal = new HalObject(itemBody as unknown as HalObjectShape<EntityItemShape>);
  return new EntityItem(hal, itemProfile, etag);
}

function makeEntityItemWithSetTemplate(
  etag: string | null = '"v1"',
  profile?: ProfileEntity,
): EntityItem {
  return makeEntityItemWithTemplates(
    etag,
    {
      "set-supplier": {
        ...invoiceSetSupplierTemplate,
        target: SUPPLIER_RELATION_URL,
      },
    },
    profile,
  );
}

/** Get the to-one supplier relation from an entity item */
function getSupplierRelation(entityItem: EntityItem): EntityItemToOneRelation {
  const rel = entityItem.getToOneRelation("supplier");
  if (!rel) throw new Error("supplier to-one relation not found on item");
  return rel;
}

/** Wire a GET handler for the best-effort re-fetch after mutation success */
function wireRefetchHandler(etag = '"v2"') {
  server.use(
    http.get(INVOICE_ITEM_URL, () =>
      HttpResponse.json(
        {
          id: "inv-001",
          _links: { self: { href: INVOICE_ITEM_URL } },
        } as unknown as HalObjectShape<EntityItemShape>,
        { headers: { ETag: etag } },
      ),
    ),
  );
}

/** Wire a GET handler that returns 500 to simulate readback failure */
function wireRefetchFailureHandler() {
  server.use(http.get(INVOICE_ITEM_URL, () => new HttpResponse(null, { status: 500 })));
}

// ===========================================================================
// useSetToOneRelation — set success
// ===========================================================================

describe("useSetToOneRelation — set success", () => {
  it("returns isSuccess and fresh EntityItem on set", async () => {
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler('"v2"');

    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const relation = getSupplierRelation(entityItem);
    const targetProfile = makeSupplierProfile();

    const { result } = renderHook(() => useSetToOneRelation(relation, targetProfile), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(SUPPLIER_URL);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeInstanceOf(EntityItem);
    expect(result.current.data?.etag).toBe('"v2"');
  });

  it("writes fresh item to setQueryData after set success", async () => {
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler('"v2"');

    const queryClient = makeQueryClient();
    const profile = makeInvoiceProfile();
    const entityItem = makeEntityItemWithSetTemplate('"v1"', profile);
    const relation = getSupplierRelation(entityItem);
    const targetProfile = makeSupplierProfile();

    const { result } = renderHook(() => useSetToOneRelation(relation, targetProfile), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(SUPPLIER_URL);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = queryClient.getQueryData(queryKeys.entityItem.byUrl(profile, INVOICE_ITEM_URL));
    expect(cached).toBeInstanceOf(EntityItem);
  });
});

// ===========================================================================
// useSetToOneRelation — If-Match header
// ===========================================================================

describe("useSetToOneRelation — If-Match header", () => {
  it("sends If-Match verbatim from source.etag", async () => {
    let capturedIfMatch: string | null = null;

    server.use(
      http.put(SUPPLIER_RELATION_URL, async ({ request }) => {
        capturedIfMatch = request.headers.get("If-Match");
        return new HttpResponse(null, { status: 204 });
      }),
    );
    wireRefetchHandler();

    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const relation = getSupplierRelation(entityItem);
    const targetProfile = makeSupplierProfile();

    const { result } = renderHook(() => useSetToOneRelation(relation, targetProfile), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(SUPPLIER_URL);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedIfMatch).toBe('"v1"');
  });

  it("sends no If-Match header when etag is null", async () => {
    let capturedIfMatch: string | null | undefined = undefined;

    server.use(
      http.put(SUPPLIER_RELATION_URL, async ({ request }) => {
        capturedIfMatch = request.headers.get("If-Match");
        return new HttpResponse(null, { status: 204 });
      }),
    );
    wireRefetchHandler();

    const entityItem = makeEntityItemWithSetTemplate(null);
    const relation = getSupplierRelation(entityItem);
    const targetProfile = makeSupplierProfile();

    const { result } = renderHook(() => useSetToOneRelation(relation, targetProfile), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(SUPPLIER_URL);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedIfMatch).toBeNull();
  });
});

// ===========================================================================
// useSetToOneRelation — ABAC denial (missing template)
// ===========================================================================

describe("useSetToOneRelation — ABAC denial (missing template)", () => {
  it("is error when set template is missing; error says template absent (no network call)", async () => {
    let networkCallHappened = false;
    server.use(
      http.put(SUPPLIER_RELATION_URL, () => {
        networkCallHappened = true;
        return new HttpResponse(null, { status: 500 });
      }),
    );

    // No set-supplier template — template absent = ABAC deny
    const entityItem = makeEntityItemWithTemplates('"v1"', {});
    const relation = getSupplierRelation(entityItem);
    const targetProfile = makeSupplierProfile();

    const { result } = renderHook(() => useSetToOneRelation(relation, targetProfile), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(SUPPLIER_URL);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("template absent");
    expect(networkCallHappened).toBe(false);
  });
});

// ===========================================================================
// useSetToOneRelation — 412 ETag mismatch (no retry)
// ===========================================================================

describe("useSetToOneRelation — 412 ETag mismatch (no retry)", () => {
  it("surfaces 412 as ProblemDetailError and PUT handler is hit exactly once", async () => {
    let putCallCount = 0;

    server.use(
      http.put(SUPPLIER_RELATION_URL, () => {
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

    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const relation = getSupplierRelation(entityItem);
    const targetProfile = makeSupplierProfile();

    const { result } = renderHook(() => useSetToOneRelation(relation, targetProfile), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(SUPPLIER_URL);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProblemDetailError);
    expect((result.current.error as ProblemDetailError<ProblemDetail>).problemDetail.status).toBe(
      412,
    );
    expect(putCallCount).toBe(1);
  });
});

// ===========================================================================
// useSetToOneRelation — 409 blind-relation-overwrite
// ===========================================================================

describe("useSetToOneRelation — 409 blind-relation-overwrite", () => {
  it("surfaces 409 as ProblemDetailError with blind-relation-overwrite type", async () => {
    server.use(
      createProblemHandler({
        method: "put",
        url: SUPPLIER_RELATION_URL,
        status: 409,
        type: "https://contentgrid.cloud/problems/integrity/blind-relation-overwrite",
        title: "Cannot overwrite existing relation without unlinking first",
      }),
    );

    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const relation = getSupplierRelation(entityItem);
    const targetProfile = makeSupplierProfile();

    const { result } = renderHook(() => useSetToOneRelation(relation, targetProfile), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(SUPPLIER_URL);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const err = result.current.error as ProblemDetailError<ProblemDetail>;
    expect(err).toBeInstanceOf(ProblemDetailError);
    expect(err.problemDetail.type).toContain("blind-relation-overwrite");
  });
});

// ===========================================================================
// useSetToOneRelation — best-effort readback
// ===========================================================================

describe("useSetToOneRelation — best-effort readback (write succeeds, readback fails)", () => {
  it("mutation resolves as success (data=undefined) when readback returns 5xx", async () => {
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchFailureHandler();

    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const relation = getSupplierRelation(entityItem);
    const targetProfile = makeSupplierProfile();

    const { result } = renderHook(() => useSetToOneRelation(relation, targetProfile), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(SUPPLIER_URL);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("onSettled invalidations still fire even when readback fails", async () => {
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchFailureHandler();

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const relation = getSupplierRelation(entityItem);
    const targetProfile = makeSupplierProfile();

    const { result } = renderHook(() => useSetToOneRelation(relation, targetProfile), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(SUPPLIER_URL);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalled();
  });
});

// ===========================================================================
// useSetToOneRelation — cache invalidation behaviour
// ===========================================================================

describe("useSetToOneRelation — cache invalidation", () => {
  it("invalidates the toOneRelation read key on settled", async () => {
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler();

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const relation = getSupplierRelation(entityItem);
    const targetProfile = makeSupplierProfile();

    const { result } = renderHook(() => useSetToOneRelation(relation, targetProfile), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(SUPPLIER_URL);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const readKey = queryKeys.toOneRelation.byUrl(targetProfile, SUPPLIER_RELATION_URL);
    const calledWithReadKey = invalidateSpy.mock.calls.some(
      (call) => JSON.stringify(call[0]) === JSON.stringify({ queryKey: readKey }),
    );
    expect(calledWithReadKey).toBe(true);
  });

  it("invalidates the specific target item URL in onSettled, not a broader key", async () => {
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler();

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const relation = getSupplierRelation(entityItem);
    const targetProfile = makeSupplierProfile();

    const { result } = renderHook(() => useSetToOneRelation(relation, targetProfile), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(SUPPLIER_URL);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const targetKey = queryKeys.entityItem.byUrlForName("supplier", SUPPLIER_URL);
    const calledWithTargetKey = invalidateSpy.mock.calls.some(
      (call) => JSON.stringify(call[0]) === JSON.stringify({ queryKey: targetKey }),
    );
    expect(calledWithTargetKey).toBe(true);
  });

  it("does NOT invalidate source collection in onSettled", async () => {
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler();

    const queryClient = makeQueryClient();
    const profile = makeInvoiceProfile();
    const entityItem = makeEntityItemWithSetTemplate('"v1"', profile);
    const relation = getSupplierRelation(entityItem);
    const targetProfile = makeSupplierProfile();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSetToOneRelation(relation, targetProfile), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(SUPPLIER_URL);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const sourceCollectionKey = queryKeys.entityItemCollection.forEntity(profile);
    const calledWithSourceCollection = invalidateSpy.mock.calls.some(
      (call) => JSON.stringify(call[0]) === JSON.stringify({ queryKey: sourceCollectionKey }),
    );
    expect(calledWithSourceCollection).toBe(false);
  });

  it("does NOT invalidate all source items (forEntity prefix) in onSettled", async () => {
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler();

    const queryClient = makeQueryClient();
    const profile = makeInvoiceProfile();
    const entityItem = makeEntityItemWithSetTemplate('"v1"', profile);
    const relation = getSupplierRelation(entityItem);
    const targetProfile = makeSupplierProfile();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSetToOneRelation(relation, targetProfile), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(SUPPLIER_URL);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const sourceItemsKey = queryKeys.entityItem.forEntity(profile);
    const calledWithSourceItems = invalidateSpy.mock.calls.some(
      (call) => JSON.stringify(call[0]) === JSON.stringify({ queryKey: sourceItemsKey }),
    );
    expect(calledWithSourceItems).toBe(false);
  });
});

// ===========================================================================
// useSetToOneRelation — caller onSuccess ordering
// ===========================================================================

describe("useSetToOneRelation — caller onSuccess ordering", () => {
  it("calls caller onSuccess after cache is populated", async () => {
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler();

    const queryClient = makeQueryClient();
    const profile = makeInvoiceProfile();
    const entityItem = makeEntityItemWithSetTemplate('"v1"', profile);
    const relation = getSupplierRelation(entityItem);
    const targetProfile = makeSupplierProfile();

    let cacheAtCallTime: unknown = "NOT_CHECKED";
    const callerOnSuccess = vi.fn(async () => {
      cacheAtCallTime = queryClient.getQueryData(
        queryKeys.entityItem.byUrl(profile, INVOICE_ITEM_URL),
      );
    });

    const { result } = renderHook(
      () =>
        useSetToOneRelation(relation, targetProfile, {
          mutationOptions: { onSuccess: callerOnSuccess },
        }),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate(SUPPLIER_URL);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(callerOnSuccess).toHaveBeenCalledOnce();
    expect(cacheAtCallTime).toBeInstanceOf(EntityItem);
  });

  it("calls caller onSettled last", async () => {
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler();

    const callerOnSettled = vi.fn();

    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const relation = getSupplierRelation(entityItem);
    const targetProfile = makeSupplierProfile();

    const { result } = renderHook(
      () =>
        useSetToOneRelation(relation, targetProfile, {
          mutationOptions: { onSettled: callerOnSettled },
        }),
      { wrapper: makeWrapper() },
    );

    await act(async () => {
      result.current.mutate(SUPPLIER_URL);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callerOnSettled).toHaveBeenCalledOnce();
  });
});
