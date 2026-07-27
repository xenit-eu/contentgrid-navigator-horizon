/**
 * Tests for useUnlinkRelation hook.
 *
 * useUnlinkRelation (DELETE single item from to-many):
 * - unlink success → isSuccess, data is void
 * - sends DELETE to relation.link.href/item.id (workaround URL construction)
 * - attaches If-Match from relation.source.etag
 * - 412 no retry
 * - Cache: invalidates toManyRelation.forRelationName on settled (all pages, item may shift)
 * - Cache: invalidates entityItem.byUrl for source item on settled (ETag may be bumped)
 * - Caller onSettled runs
 * - Caller onSuccess runs
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { HalObject, type Link } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import { type ProblemDetail, ProblemDetailError } from "@contentgrid/problem-details";
import { invoiceProfileBodyWithRelations } from "../../../test-fixtures/hal/fixtures";
import {
  createProblemHandler,
  createRelationUnlinkHandler,
} from "../../../test-fixtures/msw/handlers";
import { server } from "../../../test-setup";
import { EntityItem } from "../../accessors/entity-item";
import type { EntityItemToManyRelation } from "../../accessors/entity-item-to-many-relation";
import ProfileEntity from "../../accessors/entity-profile";
import { queryKeys } from "../../query-keys";
import type { EntityItemShape, ProfileEntityShape } from "../../shapes";
import { BASE, PROFILE_URL, makeQueryClient, makeWrapper } from "../test-utils";
import { useUnlinkRelation } from "./use-unlink-relation";

// ---------------------------------------------------------------------------
// Fixture URLs
// ---------------------------------------------------------------------------

const INVOICE_PROFILE_URL = `${BASE}/profile/invoices`;
const LINE_ITEM_PROFILE_URL = `${BASE}/profile/line-items`;
const INVOICE_ITEM_URL = `${BASE}/invoices/inv-001`;
const LINE_ITEM_ITEM_URL = `${BASE}/line-items/li-001`;
const LINE_ITEMS_RELATION_URL = `${INVOICE_ITEM_URL}/lineItems`;
// URL the hook actually sends DELETE to: relation.link.href + "/" + item.id
const UNLINK_URL = `${LINE_ITEMS_RELATION_URL}/li-001`;

const CG_RELATION_REL = "https://contentgrid.cloud/rels/contentgrid/relation";
const BLUEPRINT_RELATION_REL = "https://contentgrid.cloud/rels/blueprint/relation";
const BLUEPRINT_TARGET_ENTITY_REL = "https://contentgrid.cloud/rels/blueprint/target-entity";

// ---------------------------------------------------------------------------
// Profile MSW bodies
// ---------------------------------------------------------------------------

const profileRootBody = {
  _links: {
    self: { href: PROFILE_URL },
    "cg:entity": [
      { href: INVOICE_PROFILE_URL, name: "invoice", title: "Invoice" },
      { href: LINE_ITEM_PROFILE_URL, name: "lineItem", title: "Line Item" },
    ],
    curies: [
      { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
    ],
  },
  _templates: {},
};

const lineItemProfileBody = {
  name: "lineItem",
  title: "Line Item",
  description: "",
  _embedded: { "blueprint:attribute": [], "blueprint:relation": [] },
  _links: {
    self: { href: LINE_ITEM_PROFILE_URL, title: "Line Item" },
    describes: [
      { href: LINE_ITEM_PROFILE_URL },
      { href: `${BASE}/line-items`, name: "collection" },
      { href: `${BASE}/line-items/{id}`, name: "item", templated: true },
    ],
    curies: [
      {
        href: "https://contentgrid.cloud/rels/blueprint/{rel}",
        name: "blueprint",
        templated: true,
      },
    ],
  },
  _templates: {},
};

const invoiceProfileBody = {
  ...invoiceProfileBodyWithRelations,
  _links: {
    self: { href: INVOICE_PROFILE_URL },
    describes: [
      { href: `${BASE}/invoices`, name: "collection" },
      { href: `${BASE}/invoices/{id}`, name: "item", templated: true },
    ],
    curies: [
      {
        href: "https://contentgrid.cloud/rels/blueprint/{rel}",
        name: "blueprint",
        templated: true,
      },
    ],
  },
  _embedded: {
    [BLUEPRINT_RELATION_REL]: [
      {
        name: "lineItems",
        title: "Line Items",
        description: "",
        required: false,
        many_source_per_target: false,
        many_target_per_source: true,
        _links: {
          self: { href: `${INVOICE_PROFILE_URL}/relations/lineItems` },
          [BLUEPRINT_TARGET_ENTITY_REL]: {
            href: LINE_ITEM_PROFILE_URL,
            name: "lineItem",
            title: "Line Item",
          },
        },
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

function makeInvoiceProfile(): ProfileEntity {
  const hal = new HalObject<ProfileEntityShape>(
    invoiceProfileBody as unknown as HalObjectShape<ProfileEntityShape>,
  );
  return new ProfileEntity(
    { href: INVOICE_PROFILE_URL, name: "invoice", title: "Invoice" } as unknown as Link,
    hal,
  );
}

function makeLineItemProfile(): ProfileEntity {
  const hal = new HalObject<ProfileEntityShape>(
    lineItemProfileBody as unknown as HalObjectShape<ProfileEntityShape>,
  );
  return new ProfileEntity(
    { href: LINE_ITEM_PROFILE_URL, name: "lineItem", title: "Line Item" } as unknown as Link,
    hal,
  );
}

/** Source invoice item (the entity owning the to-many relation). */
function makeInvoiceItem(etag: string | null = '"v1"'): EntityItem {
  const profile = makeInvoiceProfile();
  const body = {
    id: "inv-001",
    _links: {
      self: { href: INVOICE_ITEM_URL },
      [CG_RELATION_REL]: [{ href: LINE_ITEMS_RELATION_URL, name: "lineItems" }],
    },
    _templates: {},
  };
  const hal = new HalObject(body as unknown as HalObjectShape<EntityItemShape>);
  return new EntityItem(hal, profile, etag);
}

/** Line item to unlink — only needs an id; no delete template required for unlink. */
function makeLineItem(): EntityItem {
  const profile = makeLineItemProfile();
  const body = {
    id: "li-001",
    _links: { self: { href: LINE_ITEM_ITEM_URL } },
    _templates: {},
  };
  const hal = new HalObject(body as unknown as HalObjectShape<EntityItemShape>);
  return new EntityItem(hal, profile, null);
}

function getLineItemsRelation(invoiceItem: EntityItem): EntityItemToManyRelation {
  const rel = invoiceItem.getToManyRelation("lineItems");
  if (!rel) throw new Error("lineItems to-many relation not found on item");
  return rel;
}

function setupProfileHandlers() {
  server.use(
    http.get(PROFILE_URL, () => HttpResponse.json(profileRootBody)),
    http.get(INVOICE_PROFILE_URL, () => HttpResponse.json(invoiceProfileBody)),
    http.get(LINE_ITEM_PROFILE_URL, () => HttpResponse.json(lineItemProfileBody)),
  );
}

// ===========================================================================
// useUnlinkRelation — unlink success
// ===========================================================================

describe("useUnlinkRelation — unlink success", () => {
  it("returns isSuccess and data is void", async () => {
    setupProfileHandlers();
    server.use(createRelationUnlinkHandler({ url: UNLINK_URL }));

    const invoiceItem = makeInvoiceItem('"v1"');
    const lineItem = makeLineItem();
    const relation = getLineItemsRelation(invoiceItem);

    const { result } = renderHook(() => useUnlinkRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(lineItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("sends DELETE to relation.link.href/item.id", async () => {
    setupProfileHandlers();
    let capturedUrl: string | null = null;

    server.use(
      http.delete(UNLINK_URL, ({ request }) => {
        capturedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const invoiceItem = makeInvoiceItem('"v1"');
    const lineItem = makeLineItem();
    const relation = getLineItemsRelation(invoiceItem);

    const { result } = renderHook(() => useUnlinkRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(lineItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedUrl).toBe(UNLINK_URL);
  });

  it("attaches If-Match from relation.source.etag", async () => {
    setupProfileHandlers();
    let capturedIfMatch: string | null = null;

    server.use(
      http.delete(UNLINK_URL, ({ request }) => {
        capturedIfMatch = request.headers.get("If-Match");
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const invoiceItem = makeInvoiceItem('"v1"');
    const lineItem = makeLineItem();
    const relation = getLineItemsRelation(invoiceItem);

    const { result } = renderHook(() => useUnlinkRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(lineItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedIfMatch).toBe('"v1"');
  });
});

// ===========================================================================
// useUnlinkRelation — 412 no retry
// ===========================================================================

describe("useUnlinkRelation — 412 no retry", () => {
  it("surfaces 412 as ProblemDetailError and DELETE handler hit exactly once", async () => {
    setupProfileHandlers();
    let deleteCallCount = 0;

    server.use(
      http.delete(UNLINK_URL, () => {
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

    const invoiceItem = makeInvoiceItem('"v1"');
    const lineItem = makeLineItem();
    const relation = getLineItemsRelation(invoiceItem);

    const { result } = renderHook(() => useUnlinkRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(lineItem);
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
// useUnlinkRelation — 403 ABAC denial
// ===========================================================================

describe("useUnlinkRelation — 403 ABAC denial", () => {
  it("surfaces 403 as ProblemDetailError", async () => {
    setupProfileHandlers();
    server.use(
      createProblemHandler({
        method: "delete",
        url: UNLINK_URL,
        status: 403,
        title: "Forbidden",
      }),
    );

    const invoiceItem = makeInvoiceItem('"v1"');
    const lineItem = makeLineItem();
    const relation = getLineItemsRelation(invoiceItem);

    const { result } = renderHook(() => useUnlinkRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(lineItem);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const err = result.current.error as ProblemDetailError<ProblemDetail>;
    expect(err).toBeInstanceOf(ProblemDetailError);
    expect(err.problemDetail.status).toBe(403);
  });
});

// ===========================================================================
// useUnlinkRelation — cache invalidation on settled
// ===========================================================================

describe("useUnlinkRelation — cache invalidation on settled", () => {
  it("invalidates toManyRelation.forRelationName on settled", async () => {
    setupProfileHandlers();
    server.use(createRelationUnlinkHandler({ url: UNLINK_URL }));

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const invoiceItem = makeInvoiceItem('"v1"');
    const lineItem = makeLineItem();
    const relation = getLineItemsRelation(invoiceItem);

    const { result } = renderHook(() => useUnlinkRelation(relation), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(lineItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // All pages for this relation are busted — items can shift across pages after removal
    const toManyKey = queryKeys.toManyRelation.forRelationName("lineItems");
    const invalidatedToMany = invalidateSpy.mock.calls.some((call) =>
      expect.objectContaining({ queryKey: toManyKey }).asymmetricMatch(call[0]),
    );
    expect(invalidatedToMany).toBe(true);
  });

  it("invalidates source item (entityItem.byUrl) on settled so ETag stays fresh", async () => {
    setupProfileHandlers();
    server.use(createRelationUnlinkHandler({ url: UNLINK_URL }));

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const invoiceItem = makeInvoiceItem('"v1"');
    const lineItem = makeLineItem();
    const relation = getLineItemsRelation(invoiceItem);

    const { result } = renderHook(() => useUnlinkRelation(relation), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(lineItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Source item invalidated — ETag may change after an unlink, must stay fresh for next mutation
    const sourceItemKey = queryKeys.entityItem.byUrl(
      relation.source.profileEntity,
      relation.source.selfLink.href,
    );
    const invalidatedSource = invalidateSpy.mock.calls.some((call) =>
      expect.objectContaining({ queryKey: sourceItemKey }).asymmetricMatch(call[0]),
    );
    expect(invalidatedSource).toBe(true);
  });

  it("caller onSettled runs after cache invalidation", async () => {
    setupProfileHandlers();
    server.use(createRelationUnlinkHandler({ url: UNLINK_URL }));

    const callerOnSettled = vi.fn();

    const invoiceItem = makeInvoiceItem('"v1"');
    const lineItem = makeLineItem();
    const relation = getLineItemsRelation(invoiceItem);

    const { result } = renderHook(
      () => useUnlinkRelation(relation, { mutationOptions: { onSettled: callerOnSettled } }),
      { wrapper: makeWrapper() },
    );

    await act(async () => {
      result.current.mutate(lineItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callerOnSettled).toHaveBeenCalledOnce();
  });

  it("caller onSuccess runs on successful unlink", async () => {
    setupProfileHandlers();
    server.use(createRelationUnlinkHandler({ url: UNLINK_URL }));

    const callerOnSuccess = vi.fn();

    const invoiceItem = makeInvoiceItem('"v1"');
    const lineItem = makeLineItem();
    const relation = getLineItemsRelation(invoiceItem);

    const { result } = renderHook(
      () => useUnlinkRelation(relation, { mutationOptions: { onSuccess: callerOnSuccess } }),
      { wrapper: makeWrapper() },
    );

    await act(async () => {
      result.current.mutate(lineItem);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callerOnSuccess).toHaveBeenCalledOnce();
  });

  it("still invalidates cache on settled even when unlink fails", async () => {
    setupProfileHandlers();
    server.use(
      createProblemHandler({
        method: "delete",
        url: UNLINK_URL,
        status: 403,
        title: "Forbidden",
      }),
    );

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const invoiceItem = makeInvoiceItem('"v1"');
    const lineItem = makeLineItem();
    const relation = getLineItemsRelation(invoiceItem);

    const { result } = renderHook(() => useUnlinkRelation(relation), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(lineItem);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // onSettled runs on both success and error — cache must still be busted
    const toManyKey = queryKeys.toManyRelation.forRelationName("lineItems");
    const invalidatedToMany = invalidateSpy.mock.calls.some((call) =>
      expect.objectContaining({ queryKey: toManyKey }).asymmetricMatch(call[0]),
    );
    expect(invalidatedToMany).toBe(true);
  });
});
