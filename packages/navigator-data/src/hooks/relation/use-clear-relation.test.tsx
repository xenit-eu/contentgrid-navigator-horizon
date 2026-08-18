/**
 * Tests for useClearRelation hook.
 *
 * useClearRelation (DELETE):
 * - clear success for to-one relation (DELETE 204 → isSuccess; data is void)
 * - clear success for to-many relation (DELETE 204 → isSuccess; data is void)
 * - 412 no retry
 * - 409 integrity/required-relation → isError
 * - Relation read key (toOneRelation.byUrl for to-one) is invalidated on settled
 * - Relation read key (toManyRelation.forRelationName, all pages, for to-many) is invalidated on settled
 * - Source item (entityItem.byUrl) is invalidated on settled (ETag may be bumped)
 * - Target byUrlForName key and entityItemCollection keys are NOT invalidated
 * - Caller onSettled runs
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { HalObject, type Link } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import { type ProblemDetail, ProblemDetailError } from "@contentgrid/problem-details";
import {
  invoiceClearSupplierTemplate,
  invoiceProfileBodyWithRelations,
} from "../../../test-fixtures/hal/fixtures";
import {
  createProblemHandler,
  createRelationUnlinkHandler,
} from "../../../test-fixtures/msw/handlers";
import { server } from "../../../test-setup";
import { EntityItem } from "../../accessors/entity-item";
import type { EntityItemToManyRelation } from "../../accessors/entity-item-to-many-relation";
import type { EntityItemToOneRelation } from "../../accessors/entity-item-to-one-relation";
import ProfileEntity from "../../accessors/entity-profile";
import { queryKeys } from "../../query-keys";
import type { EntityItemShape, ProfileEntityShape } from "../../shapes";
import { BASE, PROFILE_URL, makeQueryClient, makeWrapper } from "../test-utils";
import { useClearRelation } from "./use-clear-relation";

// ---------------------------------------------------------------------------
// Fixture URLs
// ---------------------------------------------------------------------------

const INVOICE_PROFILE_URL = `${BASE}/profile/invoices`;
const SUPPLIER_PROFILE_URL = `${BASE}/profile/suppliers`;
const LINE_ITEM_PROFILE_URL = `${BASE}/profile/line-items`;
const INVOICE_ITEM_URL = `${BASE}/invoices/inv-001`;
const SUPPLIER_RELATION_URL = `${INVOICE_ITEM_URL}/supplier`;
const LINE_ITEMS_RELATION_URL = `${INVOICE_ITEM_URL}/lineItems`;

const CG_RELATION_REL = "https://contentgrid.cloud/rels/contentgrid/relation";
const BLUEPRINT_RELATION_REL = "https://contentgrid.cloud/rels/blueprint/relation";
const BLUEPRINT_TARGET_ENTITY_REL = "https://contentgrid.cloud/rels/blueprint/target-entity";

// ---------------------------------------------------------------------------
// Profile MSW bodies
// ---------------------------------------------------------------------------

/**
 * Profile root that exposes invoice, supplier, and line-item profiles.
 * Required so useProfileEntities() can discover all profile links and
 * the mutation base can resolve getTargetProfile() for both relations.
 */
const profileRootBody = {
  _links: {
    self: { href: PROFILE_URL },
    "cg:entity": [
      { href: INVOICE_PROFILE_URL, name: "invoice", title: "Invoice" },
      { href: SUPPLIER_PROFILE_URL, name: "supplier", title: "Supplier" },
      { href: LINE_ITEM_PROFILE_URL, name: "lineItem", title: "Line Item" },
    ],
    curies: [
      { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
    ],
  },
  _templates: {},
};

/**
 * Supplier profile body.
 * The `describes` array includes the absolute profile URL as a non-templated entry
 * so ProfileEntity.describes() matches the blueprint:target-entity href.
 */
const supplierProfileBody = {
  name: "supplier",
  title: "Supplier",
  description: "",
  _embedded: { "blueprint:attribute": [], "blueprint:relation": [] },
  _links: {
    self: { href: SUPPLIER_PROFILE_URL, title: "Supplier" },
    describes: [
      { href: SUPPLIER_PROFILE_URL },
      { href: `${BASE}/suppliers`, name: "collection" },
      { href: `${BASE}/suppliers/{id}`, name: "item", templated: true },
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

/**
 * Line item profile body.
 * The `describes` array includes the absolute profile URL as a non-templated entry
 * so ProfileEntity.describes() matches the blueprint:target-entity href.
 */
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

/**
 * Invoice profile body with absolute blueprint:target-entity hrefs for both relations.
 * Uses the same override pattern as the read-hook tests so
 * getTargetProfile() can resolve supplier and lineItem profiles from the loaded profiles.
 */
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
        name: "supplier",
        title: "Supplier",
        description: "",
        required: false,
        many_source_per_target: false,
        many_target_per_source: false,
        _links: {
          self: { href: `${INVOICE_PROFILE_URL}/relations/supplier` },
          [BLUEPRINT_TARGET_ENTITY_REL]: {
            href: SUPPLIER_PROFILE_URL,
            name: "supplier",
            title: "Supplier",
          },
        },
      },
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

function makeEntityItemWithTemplates(
  etag: string | null = '"v1"',
  templates: Record<string, unknown> = {},
): EntityItem {
  const itemProfile = makeInvoiceProfile();
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

function makeEntityItemWithClearSupplierTemplate(etag: string | null = '"v1"'): EntityItem {
  return makeEntityItemWithTemplates(etag, {
    "clear-supplier": {
      ...invoiceClearSupplierTemplate,
      target: SUPPLIER_RELATION_URL,
    },
  });
}

function makeEntityItemWithClearLineItemsTemplate(etag: string | null = '"v1"'): EntityItem {
  // clear-lineItems template — DELETE on the to-many relation
  return makeEntityItemWithTemplates(etag, {
    "clear-lineItems": {
      method: "DELETE",
      target: LINE_ITEMS_RELATION_URL,
      properties: [],
    },
  });
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

/** Register MSW handlers for the profile root + invoice + supplier + lineItem profiles. */
function setupProfileHandlers() {
  server.use(
    http.get(PROFILE_URL, () => HttpResponse.json(profileRootBody)),
    http.get(INVOICE_PROFILE_URL, () => HttpResponse.json(invoiceProfileBody)),
    http.get(SUPPLIER_PROFILE_URL, () => HttpResponse.json(supplierProfileBody)),
    http.get(LINE_ITEM_PROFILE_URL, () => HttpResponse.json(lineItemProfileBody)),
  );
}

// ===========================================================================
// useClearRelation — clear success (to-one)
// ===========================================================================

describe("useClearRelation — clear success (to-one)", () => {
  it("returns isSuccess and data is void on clear of a to-one relation", async () => {
    setupProfileHandlers();
    server.use(createRelationUnlinkHandler({ url: SUPPLIER_RELATION_URL }));

    const entityItem = makeEntityItemWithClearSupplierTemplate('"v1"');
    const relation = getSupplierToOneRelation(entityItem);

    const { result } = renderHook(() => useClearRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

// ===========================================================================
// useClearRelation — clear success (to-many)
// ===========================================================================

describe("useClearRelation — clear success (to-many)", () => {
  it("returns isSuccess and data is void on clear of a to-many relation", async () => {
    setupProfileHandlers();
    server.use(createRelationUnlinkHandler({ url: LINE_ITEMS_RELATION_URL }));

    const entityItem = makeEntityItemWithClearLineItemsTemplate('"v1"');
    const relation = getLineItemsToManyRelation(entityItem);

    const { result } = renderHook(() => useClearRelation(relation), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

// ===========================================================================
// useClearRelation — 412 no retry
// ===========================================================================

describe("useClearRelation — 412 no retry", () => {
  it("surfaces 412 as ProblemDetailError and DELETE handler hit exactly once", async () => {
    setupProfileHandlers();
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

    const { result } = renderHook(() => useClearRelation(relation), {
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
    setupProfileHandlers();
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

    const { result } = renderHook(() => useClearRelation(relation), {
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
    setupProfileHandlers();
    server.use(createRelationUnlinkHandler({ url: SUPPLIER_RELATION_URL }));

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const entityItem = makeEntityItemWithClearSupplierTemplate('"v1"');
    const relation = getSupplierToOneRelation(entityItem);

    const { result } = renderHook(() => useClearRelation(relation), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The key uses the relation name ("supplier") + relation.link.href
    const readKey = queryKeys.toOneRelation.byUrl("supplier", SUPPLIER_RELATION_URL);
    const calledWithReadKey = invalidateSpy.mock.calls.some((call) =>
      expect.objectContaining({ queryKey: readKey }).asymmetricMatch(call[0]),
    );
    expect(calledWithReadKey).toBe(true);
  });

  it("invalidates the toManyRelation read key on settled (to-many clear)", async () => {
    setupProfileHandlers();
    server.use(createRelationUnlinkHandler({ url: LINE_ITEMS_RELATION_URL }));

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const entityItem = makeEntityItemWithClearLineItemsTemplate('"v1"');
    const relation = getLineItemsToManyRelation(entityItem);

    const { result } = renderHook(() => useClearRelation(relation), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // All pages for this relation are busted — same rationale as add/unlink
    const readKey = queryKeys.toManyRelation.forRelationName("lineItems");
    const calledWithReadKey = invalidateSpy.mock.calls.some((call) =>
      expect.objectContaining({ queryKey: readKey }).asymmetricMatch(call[0]),
    );
    expect(calledWithReadKey).toBe(true);
  });
});

// ===========================================================================
// useClearRelation — source item invalidation and no over-invalidation
// ===========================================================================

describe("useClearRelation — source item invalidation and no over-invalidation", () => {
  it("invalidates the source item (entityItem.byUrl) on settled", async () => {
    setupProfileHandlers();
    server.use(createRelationUnlinkHandler({ url: SUPPLIER_RELATION_URL }));

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const entityItem = makeEntityItemWithClearSupplierTemplate('"v1"');
    const relation = getSupplierToOneRelation(entityItem);

    const { result } = renderHook(() => useClearRelation(relation), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Source item invalidated — relation op is gated on the source ETag and may bump it
    const sourceItemKey = queryKeys.entityItem.byUrl(
      relation.source.profileEntity,
      relation.source.selfLink.href,
    );
    const calledWithSourceKey = invalidateSpy.mock.calls.some((call) =>
      expect.objectContaining({ queryKey: sourceItemKey }).asymmetricMatch(call[0]),
    );
    expect(calledWithSourceKey).toBe(true);

    // Target byUrlForName key is NOT invalidated (previously-linked hrefs unknown + over-invalidation we avoid)
    const targetEntityItemInvalidations = invalidateSpy.mock.calls.filter((call) => {
      const queryKey = (call[0] as { queryKey: unknown[] }).queryKey;
      return Array.isArray(queryKey) && queryKey[0] === "EntityItem" && queryKey[1] === "supplier";
    });
    expect(targetEntityItemInvalidations).toHaveLength(0);

    // entityItemCollection keys are NOT invalidated
    const collectionInvalidations = invalidateSpy.mock.calls.filter((call) => {
      const queryKey = (call[0] as { queryKey: unknown[] }).queryKey;
      return Array.isArray(queryKey) && queryKey[0] === "EntitySearch";
    });
    expect(collectionInvalidations).toHaveLength(0);
  });

  it("caller onSettled runs after mutation settles", async () => {
    setupProfileHandlers();
    server.use(createRelationUnlinkHandler({ url: SUPPLIER_RELATION_URL }));

    const callerOnSettled = vi.fn();

    const entityItem = makeEntityItemWithClearSupplierTemplate('"v1"');
    const relation = getSupplierToOneRelation(entityItem);

    const { result } = renderHook(
      () =>
        useClearRelation(relation, {
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
