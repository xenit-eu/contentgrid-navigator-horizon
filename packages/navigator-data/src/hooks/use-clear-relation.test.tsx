/**
 * Tests for useClearRelation hook.
 *
 * useClearRelation (DELETE):
 * - clear success for to-one relation (DELETE 204 → re-fetch → isSuccess)
 * - clear success for to-many relation (DELETE 204 → re-fetch → isSuccess)
 * - populates setQueryData after successful clear + readback
 * - 412 no retry
 * - 409 integrity/required-relation → isError
 * - Relation read key (toOneRelation.byUrl for to-one) is invalidated on settled
 * - Relation read key (toManyRelation.byUrl for to-many) is invalidated on settled
 * - No target invalidation on clear (previously-linked hrefs unknown)
 * - Caller onSettled runs last
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { HalObject } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import { type ProblemDetail, ProblemDetailError } from "@contentgrid/problem-details";
import {
  invoiceClearSupplierTemplate,
  invoiceProfileBodyWithRelations,
} from "../../test-fixtures/hal/fixtures";
import {
  createProblemHandler,
  createRelationUnlinkHandler,
} from "../../test-fixtures/msw/handlers";
import { server } from "../../test-setup";
import { EntityItem } from "../accessors/entity-item";
import type { EntityItemToManyRelation } from "../accessors/entity-item-to-many-relation";
import type { EntityItemToOneRelation } from "../accessors/entity-item-to-one-relation";
import ProfileEntity from "../accessors/entity-profile";
import { queryKeys } from "../query-keys";
import type { EntityItemShape, ProfileEntityShape } from "../shapes";
import { BASE, makeQueryClient, makeWrapper } from "./test-utils";
import { useClearRelation } from "./use-clear-relation";

// ---------------------------------------------------------------------------
// Fixture URLs
// ---------------------------------------------------------------------------

const INVOICE_PROFILE_URL = `${BASE}/profile/invoices`;
const INVOICE_ITEM_URL = `${BASE}/invoices/inv-001`;
const SUPPLIER_RELATION_URL = `${INVOICE_ITEM_URL}/supplier`;
const LINE_ITEMS_RELATION_URL = `${INVOICE_ITEM_URL}/lineItems`;

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

function makeLineItemProfile(): ProfileEntity {
  const profileBody = {
    name: "lineItem",
    title: "Line Item",
    _links: {
      self: { href: `${BASE}/profile/line-items` },
      describes: [
        { href: `${BASE}/line-items`, name: "collection" },
        { href: `${BASE}/line-items/{id}`, name: "item", templated: true },
      ],
    },
  };
  const hal = new HalObject(profileBody as unknown as ProfileEntityShape);
  const link = { href: `${BASE}/profile/line-items`, name: "lineItem", title: "Line Item" };
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
        { href: LINE_ITEMS_RELATION_URL, name: "lineItems" },
      ],
    },
    _templates: templates,
  };
  const hal = new HalObject(itemBody as unknown as HalObjectShape<EntityItemShape>);
  return new EntityItem(hal, itemProfile, etag);
}

function makeEntityItemWithClearSupplierTemplate(
  etag: string | null = '"v1"',
  profile?: ProfileEntity,
): EntityItem {
  return makeEntityItemWithTemplates(
    etag,
    {
      "clear-supplier": {
        ...invoiceClearSupplierTemplate,
        target: SUPPLIER_RELATION_URL,
      },
    },
    profile,
  );
}

function makeEntityItemWithClearLineItemsTemplate(
  etag: string | null = '"v1"',
  profile?: ProfileEntity,
): EntityItem {
  // clear-lineItems template — DELETE on the to-many relation
  return makeEntityItemWithTemplates(
    etag,
    {
      "clear-lineItems": {
        method: "DELETE",
        target: LINE_ITEMS_RELATION_URL,
        properties: [],
      },
    },
    profile,
  );
}

/** Get the to-one supplier relation (needs a clear template) */
function getSupplierToOneRelation(entityItem: EntityItem): EntityItemToOneRelation {
  const rel = entityItem.getToOneRelation("supplier");
  if (!rel) throw new Error("supplier to-one relation not found on item");
  return rel;
}

/** Get the to-many lineItems relation (needs a clear template) */
function getLineItemsToManyRelation(entityItem: EntityItem): EntityItemToManyRelation {
  const rel = entityItem.getToManyRelation("lineItems");
  if (!rel) throw new Error("lineItems to-many relation not found on item");
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

// ===========================================================================
// useClearRelation — clear success (to-one)
// ===========================================================================

describe("useClearRelation — clear success (to-one)", () => {
  it("returns isSuccess on clear of a to-one relation", async () => {
    server.use(createRelationUnlinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler();

    const entityItem = makeEntityItemWithClearSupplierTemplate('"v1"');
    const relation = getSupplierToOneRelation(entityItem);
    const targetProfile = makeSupplierProfile();

    const { result } = renderHook(() => useClearRelation(relation, targetProfile), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("populates setQueryData after successful clear + readback", async () => {
    server.use(createRelationUnlinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler('"v3"');

    const queryClient = makeQueryClient();
    const profile = makeInvoiceProfile();
    const entityItem = makeEntityItemWithClearSupplierTemplate('"v1"', profile);
    const relation = getSupplierToOneRelation(entityItem);
    const targetProfile = makeSupplierProfile();

    const { result } = renderHook(() => useClearRelation(relation, targetProfile), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = queryClient.getQueryData(queryKeys.entityItem.byUrl(profile, INVOICE_ITEM_URL));
    expect(cached).toBeInstanceOf(EntityItem);
    expect((cached as EntityItem).etag).toBe('"v3"');
  });
});

// ===========================================================================
// useClearRelation — clear success (to-many)
// ===========================================================================

describe("useClearRelation — clear success (to-many)", () => {
  it("returns isSuccess on clear of a to-many relation", async () => {
    server.use(createRelationUnlinkHandler({ url: LINE_ITEMS_RELATION_URL }));
    wireRefetchHandler();

    const entityItem = makeEntityItemWithClearLineItemsTemplate('"v1"');
    const relation = getLineItemsToManyRelation(entityItem);
    const targetProfile = makeLineItemProfile();

    const { result } = renderHook(() => useClearRelation(relation, targetProfile), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

// ===========================================================================
// useClearRelation — 412 no retry
// ===========================================================================

describe("useClearRelation — 412 no retry", () => {
  it("surfaces 412 as ProblemDetailError and DELETE handler hit exactly once", async () => {
    let deleteCallCount = 0;

    server.use(
      http.delete(SUPPLIER_RELATION_URL, () => {
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

    const entityItem = makeEntityItemWithClearSupplierTemplate('"v1"');
    const relation = getSupplierToOneRelation(entityItem);
    const targetProfile = makeSupplierProfile();

    const { result } = renderHook(() => useClearRelation(relation, targetProfile), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProblemDetailError);
    expect((result.current.error as ProblemDetailError<ProblemDetail>).problemDetail.status).toBe(
      412,
    );
    expect(deleteCallCount).toBe(1);
  });
});

// ===========================================================================
// useClearRelation — 409 integrity/required-relation
// ===========================================================================

describe("useClearRelation — 409 integrity/required-relation", () => {
  it("surfaces 409 required-relation as ProblemDetailError with status 409", async () => {
    server.use(
      createProblemHandler({
        method: "delete",
        url: SUPPLIER_RELATION_URL,
        status: 409,
        type: "https://contentgrid.cloud/problems/integrity/required-relation",
        title: "Cannot clear required relation",
      }),
    );

    const entityItem = makeEntityItemWithClearSupplierTemplate('"v1"');
    const relation = getSupplierToOneRelation(entityItem);
    const targetProfile = makeSupplierProfile();

    const { result } = renderHook(() => useClearRelation(relation, targetProfile), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const err = result.current.error as ProblemDetailError<ProblemDetail>;
    expect(err).toBeInstanceOf(ProblemDetailError);
    expect(err.problemDetail.status).toBe(409);
    expect(err.problemDetail.type).toContain("required-relation");
  });
});

// ===========================================================================
// useClearRelation — relation read key invalidation
// ===========================================================================

describe("useClearRelation — relation read key invalidation", () => {
  it("invalidates the toOneRelation read key on settled (to-one clear)", async () => {
    server.use(createRelationUnlinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler();

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const entityItem = makeEntityItemWithClearSupplierTemplate('"v1"');
    const relation = getSupplierToOneRelation(entityItem);
    const targetProfile = makeSupplierProfile();

    const { result } = renderHook(() => useClearRelation(relation, targetProfile), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const readKey = queryKeys.toOneRelation.byUrl(targetProfile, SUPPLIER_RELATION_URL);
    const calledWithReadKey = invalidateSpy.mock.calls.some(
      (call) => JSON.stringify(call[0]) === JSON.stringify({ queryKey: readKey }),
    );
    expect(calledWithReadKey).toBe(true);
  });

  it("invalidates the toManyRelation read key on settled (to-many clear)", async () => {
    server.use(createRelationUnlinkHandler({ url: LINE_ITEMS_RELATION_URL }));
    wireRefetchHandler();

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const entityItem = makeEntityItemWithClearLineItemsTemplate('"v1"');
    const relation = getLineItemsToManyRelation(entityItem);
    const targetProfile = makeLineItemProfile();

    const { result } = renderHook(() => useClearRelation(relation, targetProfile), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const readKey = queryKeys.toManyRelation.byUrl(targetProfile, LINE_ITEMS_RELATION_URL);
    const calledWithReadKey = invalidateSpy.mock.calls.some(
      (call) => JSON.stringify(call[0]) === JSON.stringify({ queryKey: readKey }),
    );
    expect(calledWithReadKey).toBe(true);
  });
});

// ===========================================================================
// useClearRelation — no target invalidation
// ===========================================================================

describe("useClearRelation — no target invalidation", () => {
  it("does NOT invalidate any entityItem target keys on clear (previously-linked hrefs unknown)", async () => {
    server.use(createRelationUnlinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler();

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const entityItem = makeEntityItemWithClearSupplierTemplate('"v1"');
    const relation = getSupplierToOneRelation(entityItem);
    const targetProfile = makeSupplierProfile();

    const { result } = renderHook(() => useClearRelation(relation, targetProfile), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Only the relation read key should have been invalidated — no entityItem target keys
    const entityItemInvalidations = invalidateSpy.mock.calls.filter((call) => {
      const queryKey = (call[0] as { queryKey: unknown[] }).queryKey;
      return Array.isArray(queryKey) && queryKey[0] === "EntityItem";
    });
    expect(entityItemInvalidations).toHaveLength(0);
  });

  it("caller onSettled runs last", async () => {
    server.use(createRelationUnlinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler();

    const callerOnSettled = vi.fn();

    const entityItem = makeEntityItemWithClearSupplierTemplate('"v1"');
    const relation = getSupplierToOneRelation(entityItem);
    const targetProfile = makeSupplierProfile();

    const { result } = renderHook(
      () =>
        useClearRelation(relation, targetProfile, {
          mutationOptions: { onSettled: callerOnSettled },
        }),
      { wrapper: makeWrapper() },
    );

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callerOnSettled).toHaveBeenCalledOnce();
  });
});
