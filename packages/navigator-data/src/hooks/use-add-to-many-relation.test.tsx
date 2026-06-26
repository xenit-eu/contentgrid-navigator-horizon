/**
 * Tests for useAddToManyRelation hook.
 *
 * useAddToManyRelation (to-many POST):
 * - add success (POST 204 → best-effort re-fetch → isSuccess)
 * - sends both hrefs in POST body (one per line)
 * - ABAC denial (missing template) throws before any fetch
 * - 412 no retry
 * - Relation read key (toManyRelation.byUrl) is invalidated on settled
 * - Each targetHref invalidated by URL in onSettled
 * - Caller onSettled runs last
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { HalObject } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import { type ProblemDetail, ProblemDetailError } from "@contentgrid/problem-details";
import {
  invoiceAddLineItemTemplate,
  invoiceProfileBodyWithRelations,
} from "../../test-fixtures/hal/fixtures";
import { createRelationAddHandler } from "../../test-fixtures/msw/handlers";
import { server } from "../../test-setup";
import { EntityItem } from "../accessors/entity-item";
import type { EntityItemToManyRelation } from "../accessors/entity-item-to-many-relation";
import ProfileEntity from "../accessors/entity-profile";
import { queryKeys } from "../query-keys";
import type { EntityItemShape, ProfileEntityShape } from "../shapes";
import { BASE, makeQueryClient, makeWrapper } from "./test-utils";
import { useAddToManyRelation } from "./use-add-to-many-relation";

// ---------------------------------------------------------------------------
// Fixture URLs
// ---------------------------------------------------------------------------

const INVOICE_PROFILE_URL = `${BASE}/profile/invoices`;
const INVOICE_ITEM_URL = `${BASE}/invoices/inv-001`;
const SUPPLIER_RELATION_URL = `${INVOICE_ITEM_URL}/supplier`;
const LINE_ITEMS_RELATION_URL = `${INVOICE_ITEM_URL}/lineItems`;
const LINE_ITEM_URL_1 = `${BASE}/line-items/li-001`;
const LINE_ITEM_URL_2 = `${BASE}/line-items/li-002`;

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

function makeEntityItemWithAddTemplate(
  etag: string | null = '"v1"',
  profile?: ProfileEntity,
): EntityItem {
  return makeEntityItemWithTemplates(
    etag,
    {
      "add-lineItems": {
        ...invoiceAddLineItemTemplate,
        target: LINE_ITEMS_RELATION_URL,
      },
    },
    profile,
  );
}

/** Get the to-many lineItems relation from an entity item */
function getLineItemsRelation(entityItem: EntityItem): EntityItemToManyRelation {
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
// useAddToManyRelation — add success
// ===========================================================================

describe("useAddToManyRelation — add success", () => {
  it("returns isSuccess on add", async () => {
    server.use(createRelationAddHandler({ url: LINE_ITEMS_RELATION_URL }));
    wireRefetchHandler();

    const entityItem = makeEntityItemWithAddTemplate('"v1"');
    const relation = getLineItemsRelation(entityItem);
    const targetProfile = makeLineItemProfile();

    const { result } = renderHook(() => useAddToManyRelation(relation, targetProfile), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate([LINE_ITEM_URL_1, LINE_ITEM_URL_2]);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("sends both hrefs in POST body (one per line)", async () => {
    let capturedBody: string | null = null;

    server.use(
      http.post(LINE_ITEMS_RELATION_URL, async ({ request }) => {
        capturedBody = await request.text();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    wireRefetchHandler();

    const entityItem = makeEntityItemWithAddTemplate('"v1"');
    const relation = getLineItemsRelation(entityItem);
    const targetProfile = makeLineItemProfile();

    const { result } = renderHook(() => useAddToManyRelation(relation, targetProfile), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate([LINE_ITEM_URL_1, LINE_ITEM_URL_2]);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedBody).not.toBeNull();
    const lines = capturedBody!
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    expect(lines).toContain(LINE_ITEM_URL_1);
    expect(lines).toContain(LINE_ITEM_URL_2);
    expect(lines).toHaveLength(2);
  });
});

// ===========================================================================
// useAddToManyRelation — ABAC denial (missing template)
// ===========================================================================

describe("useAddToManyRelation — ABAC denial (missing template)", () => {
  it("is error when add template is missing; error says template absent (no network call)", async () => {
    let networkCallHappened = false;
    server.use(
      http.post(LINE_ITEMS_RELATION_URL, () => {
        networkCallHappened = true;
        return new HttpResponse(null, { status: 500 });
      }),
    );

    // No add-lineItems template — template absent = ABAC deny
    const entityItem = makeEntityItemWithTemplates('"v1"', {});
    const relation = getLineItemsRelation(entityItem);
    const targetProfile = makeLineItemProfile();

    const { result } = renderHook(() => useAddToManyRelation(relation, targetProfile), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate([LINE_ITEM_URL_1]);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("template absent");
    expect(networkCallHappened).toBe(false);
  });
});

// ===========================================================================
// useAddToManyRelation — 412 no retry
// ===========================================================================

describe("useAddToManyRelation — 412 no retry", () => {
  it("surfaces 412 as ProblemDetailError and POST handler hit exactly once", async () => {
    let postCallCount = 0;

    server.use(
      http.post(LINE_ITEMS_RELATION_URL, () => {
        postCallCount++;
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

    const entityItem = makeEntityItemWithAddTemplate('"v1"');
    const relation = getLineItemsRelation(entityItem);
    const targetProfile = makeLineItemProfile();

    const { result } = renderHook(() => useAddToManyRelation(relation, targetProfile), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate([LINE_ITEM_URL_1]);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProblemDetailError);
    expect((result.current.error as ProblemDetailError<ProblemDetail>).problemDetail.status).toBe(
      412,
    );
    expect(postCallCount).toBe(1);
  });
});

// ===========================================================================
// useAddToManyRelation — cache invalidation
// ===========================================================================

describe("useAddToManyRelation — cache invalidation", () => {
  it("invalidates the toManyRelation read key on settled", async () => {
    server.use(createRelationAddHandler({ url: LINE_ITEMS_RELATION_URL }));
    wireRefetchHandler();

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const entityItem = makeEntityItemWithAddTemplate('"v1"');
    const relation = getLineItemsRelation(entityItem);
    const targetProfile = makeLineItemProfile();

    const { result } = renderHook(() => useAddToManyRelation(relation, targetProfile), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate([LINE_ITEM_URL_1, LINE_ITEM_URL_2]);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const readKey = queryKeys.toManyRelation.byUrl(targetProfile, LINE_ITEMS_RELATION_URL);
    const calledWithReadKey = invalidateSpy.mock.calls.some(
      (call) => JSON.stringify(call[0]) === JSON.stringify({ queryKey: readKey }),
    );
    expect(calledWithReadKey).toBe(true);
  });

  it("invalidates each specific target item URL in onSettled", async () => {
    server.use(createRelationAddHandler({ url: LINE_ITEMS_RELATION_URL }));
    wireRefetchHandler();

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const entityItem = makeEntityItemWithAddTemplate('"v1"');
    const relation = getLineItemsRelation(entityItem);
    const targetProfile = makeLineItemProfile();

    const { result } = renderHook(() => useAddToManyRelation(relation, targetProfile), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate([LINE_ITEM_URL_1, LINE_ITEM_URL_2]);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // lineItems target entity name in fixture is "lineItem" (from blueprint:target-entity link)
    const targetKey1 = queryKeys.entityItem.byUrlForName("lineItem", LINE_ITEM_URL_1);
    const targetKey2 = queryKeys.entityItem.byUrlForName("lineItem", LINE_ITEM_URL_2);

    const calledWith1 = invalidateSpy.mock.calls.some(
      (call) => JSON.stringify(call[0]) === JSON.stringify({ queryKey: targetKey1 }),
    );
    const calledWith2 = invalidateSpy.mock.calls.some(
      (call) => JSON.stringify(call[0]) === JSON.stringify({ queryKey: targetKey2 }),
    );
    expect(calledWith1).toBe(true);
    expect(calledWith2).toBe(true);
  });

  it("caller onSettled runs last", async () => {
    server.use(createRelationAddHandler({ url: LINE_ITEMS_RELATION_URL }));
    wireRefetchHandler();

    const callerOnSettled = vi.fn();

    const entityItem = makeEntityItemWithAddTemplate('"v1"');
    const relation = getLineItemsRelation(entityItem);
    const targetProfile = makeLineItemProfile();

    const { result } = renderHook(
      () =>
        useAddToManyRelation(relation, targetProfile, {
          mutationOptions: { onSettled: callerOnSettled },
        }),
      { wrapper: makeWrapper() },
    );

    await act(async () => {
      result.current.mutate([LINE_ITEM_URL_1]);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callerOnSettled).toHaveBeenCalledOnce();
  });
});
