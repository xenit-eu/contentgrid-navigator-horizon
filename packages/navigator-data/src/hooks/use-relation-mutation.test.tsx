/**
 * Tests for useRelationMutation hook.
 *
 * Covers:
 * - Set success (PUT 204 → re-fetch GET → isSuccess, cache set via setQueryData)
 * - Add success (POST 204; assert body carried both hrefs, one-per-line)
 * - Clear success (DELETE 204)
 * - If-Match header sent verbatim from item.etag
 * - null etag → no If-Match header attached
 * - Permission denial (missing template → isError, apiFetch NOT called)
 * - 412 ETag mismatch → isError, handler hit exactly once (no retry) — set, add, clear
 * - 409 integrity/blind-relation-overwrite → isError (set)
 * - 409 integrity/required-relation → isError status 409 (clear)
 * - Cache: setQueryData on entityItem.byUrl after success
 * - Cache: invalidateQueries on entityItemCollection.forEntity always
 * - Cache: invalidateQueries on targetEntityItemCollection.forEntity when targetProfileEntity provided
 * - Caller onSuccess runs after cache is consistent
 * - Set op with two hrefs throws (exact-count guard)
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { HalObject, type Link } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import { type ProblemDetail, ProblemDetailError } from "@contentgrid/problem-details";
import {
  createProblemHandler,
  createRelationAddHandler,
  createRelationLinkHandler,
  createRelationUnlinkHandler,
} from "../../test-fixtures/msw/handlers";
import { server } from "../../test-setup";
import { EntityItem } from "../accessors/entity-item";
import ProfileEntity from "../accessors/entity-profile";
import { queryKeys } from "../query-keys";
import type { EntityItemShape, ProfileEntityShape } from "../shapes";
import { BASE, makeQueryClient, makeWrapper } from "./test-utils";
import { useRelationMutation } from "./use-relation-mutation";

// ---------------------------------------------------------------------------
// Fixture URLs
// ---------------------------------------------------------------------------

const INVOICE_PROFILE_URL = `${BASE}/profile/invoices`;
const INVOICE_ITEM_URL = `${BASE}/invoices/inv-001`;
const SUPPLIER_RELATION_URL = `${INVOICE_ITEM_URL}/supplier`;
const LINE_ITEMS_RELATION_URL = `${INVOICE_ITEM_URL}/lineItems`;
const SUPPLIER_URL = `${BASE}/suppliers/sup-001`;
const LINE_ITEM_URL_1 = `${BASE}/line-items/li-001`;
const LINE_ITEM_URL_2 = `${BASE}/line-items/li-002`;

const SUPPLIER_PROFILE_URL = `${BASE}/profile/suppliers`;

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

function makeProfileFromUrl(profileUrl: string, entityName: string): ProfileEntity {
  const profileBody = {
    name: entityName,
    title: entityName,
    _links: {
      self: { href: profileUrl },
      describes: [
        { href: `${BASE}/${entityName}s`, name: "collection" },
        { href: `${BASE}/${entityName}s/{id}`, name: "item", templated: true },
      ],
    },
  };
  const hal = new HalObject(profileBody as unknown as ProfileEntityShape);
  return new ProfileEntity(
    { href: profileUrl, name: entityName, title: entityName } as unknown as Link,
    hal as HalObject<ProfileEntityShape>,
  );
}

function makeInvoiceProfile(): ProfileEntity {
  return makeProfileFromUrl(INVOICE_PROFILE_URL, "invoice");
}

function makeSupplierProfile(): ProfileEntity {
  return makeProfileFromUrl(SUPPLIER_PROFILE_URL, "supplier");
}

function makeEntityItemWithRelations(
  etag: string | null = '"v1"',
  templates: Record<string, unknown> = {},
): EntityItem {
  const profile = makeInvoiceProfile();
  const itemBody = {
    id: "inv-001",
    _links: {
      self: { href: INVOICE_ITEM_URL },
    },
    _templates: templates,
  };
  const hal = new HalObject(itemBody as unknown as HalObjectShape<EntityItemShape>);
  return new EntityItem(hal, profile, etag);
}

const SET_SUPPLIER_TEMPLATE = {
  method: "PUT",
  target: SUPPLIER_RELATION_URL,
  contentType: "text/uri-list",
  properties: [{ name: "supplier", type: "url" }],
};

const ADD_LINE_ITEM_TEMPLATE = {
  method: "POST",
  target: LINE_ITEMS_RELATION_URL,
  contentType: "text/uri-list",
  // options must be present to make multiValue = true (required for arrays via the codec)
  properties: [{ name: "lineItem", type: "url", options: {} }],
};

const CLEAR_SUPPLIER_TEMPLATE = {
  method: "DELETE",
  target: SUPPLIER_RELATION_URL,
  properties: [],
};

function makeEntityItemWithSetTemplate(etag: string | null = '"v1"'): EntityItem {
  return makeEntityItemWithRelations(etag, { "set-supplier": SET_SUPPLIER_TEMPLATE });
}

function makeEntityItemWithAddTemplate(etag: string | null = '"v1"'): EntityItem {
  return makeEntityItemWithRelations(etag, { "add-lineItems": ADD_LINE_ITEM_TEMPLATE });
}

function makeEntityItemWithClearTemplate(etag: string | null = '"v1"'): EntityItem {
  return makeEntityItemWithRelations(etag, { "clear-supplier": CLEAR_SUPPLIER_TEMPLATE });
}

/** Wire a GET handler for the re-fetch after mutation success */
function wireRefetchHandler(etag = '"v2"') {
  server.use(
    http.get(INVOICE_ITEM_URL, () =>
      HttpResponse.json(
        { id: "inv-001", _links: { self: { href: INVOICE_ITEM_URL } } },
        { headers: { ETag: etag } },
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Set (to-one PUT) — success
// ---------------------------------------------------------------------------

describe("useRelationMutation — set success (PUT 204 → re-fetch → cache)", () => {
  it("returns isSuccess and fresh EntityItem on set", async () => {
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler('"v2"');

    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const { result } = renderHook(() => useRelationMutation(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "supplier",
        op: "set",
        targetHrefs: [SUPPLIER_URL],
      });
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
    const entityItem = makeEntityItemWithSetTemplate('"v1"');

    const { result } = renderHook(() => useRelationMutation(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "supplier",
        op: "set",
        targetHrefs: [SUPPLIER_URL],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = queryClient.getQueryData(queryKeys.entityItem.byUrl(profile, INVOICE_ITEM_URL));
    expect(cached).toBeInstanceOf(EntityItem);
  });
});

// ---------------------------------------------------------------------------
// Add (to-many POST) — success + body assertion
// ---------------------------------------------------------------------------

describe("useRelationMutation — add success (POST 204 with all hrefs in body)", () => {
  it("returns isSuccess on add", async () => {
    server.use(createRelationAddHandler({ url: LINE_ITEMS_RELATION_URL }));
    wireRefetchHandler();

    const entityItem = makeEntityItemWithAddTemplate('"v1"');
    const { result } = renderHook(() => useRelationMutation(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "lineItems",
        op: "add",
        targetHrefs: [LINE_ITEM_URL_1, LINE_ITEM_URL_2],
      });
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
    const { result } = renderHook(() => useRelationMutation(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "lineItems",
        op: "add",
        targetHrefs: [LINE_ITEM_URL_1, LINE_ITEM_URL_2],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedBody).not.toBeNull();
    expect(capturedBody).toContain(LINE_ITEM_URL_1);
    expect(capturedBody).toContain(LINE_ITEM_URL_2);
  });
});

// ---------------------------------------------------------------------------
// Clear (DELETE) — success
// ---------------------------------------------------------------------------

describe("useRelationMutation — clear success (DELETE 204)", () => {
  it("returns isSuccess on clear", async () => {
    server.use(createRelationUnlinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler();

    const entityItem = makeEntityItemWithClearTemplate('"v1"');
    const { result } = renderHook(() => useRelationMutation(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({ entityItem, relationName: "supplier", op: "clear" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// If-Match header
// ---------------------------------------------------------------------------

describe("useRelationMutation — If-Match header", () => {
  it("sends If-Match verbatim from item.etag on set", async () => {
    let capturedIfMatch: string | null = null;

    server.use(
      http.put(SUPPLIER_RELATION_URL, async ({ request }) => {
        capturedIfMatch = request.headers.get("If-Match");
        return new HttpResponse(null, { status: 204 });
      }),
    );
    wireRefetchHandler();

    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const { result } = renderHook(() => useRelationMutation(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "supplier",
        op: "set",
        targetHrefs: [SUPPLIER_URL],
      });
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
    const { result } = renderHook(() => useRelationMutation(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "supplier",
        op: "set",
        targetHrefs: [SUPPLIER_URL],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedIfMatch).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Permission denial — missing template
// ---------------------------------------------------------------------------

describe("useRelationMutation — permission denial", () => {
  it("isError when set template is missing (template absent = ABAC deny)", async () => {
    // Item has NO set-supplier template
    const entityItem = makeEntityItemWithRelations('"v1"', {});

    const { result } = renderHook(() => useRelationMutation(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "supplier",
        op: "set",
        targetHrefs: [SUPPLIER_URL],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain("set");
    expect(result.current.error?.message).toContain("supplier");
  });

  it("does not call apiFetch when template is absent", async () => {
    const fetchSpy = vi.fn();

    const entityItem = makeEntityItemWithRelations('"v1"', {});

    const { result } = renderHook(() => useRelationMutation(), {
      wrapper: makeWrapper(makeQueryClient(), fetchSpy as never),
    });

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "supplier",
        op: "set",
        targetHrefs: [SUPPLIER_URL],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 412 ETag mismatch — no retry
// ---------------------------------------------------------------------------

describe("useRelationMutation — 412 ETag mismatch", () => {
  it("surfaces 412 as ProblemDetailError and PUT handler is hit exactly once (no retry)", async () => {
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
    const { result } = renderHook(() => useRelationMutation(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "supplier",
        op: "set",
        targetHrefs: [SUPPLIER_URL],
      });
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
// 409 blind-relation-overwrite
// ---------------------------------------------------------------------------

describe("useRelationMutation — 409 blind-relation-overwrite", () => {
  it("surfaces 409 as ProblemDetailError", async () => {
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
    const { result } = renderHook(() => useRelationMutation(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "supplier",
        op: "set",
        targetHrefs: [SUPPLIER_URL],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProblemDetailError);
    const problemError = result.current.error as ProblemDetailError<ProblemDetail>;
    expect(problemError.problemDetail.type).toContain("blind-relation-overwrite");
  });
});

// ---------------------------------------------------------------------------
// Cache — invalidation
// ---------------------------------------------------------------------------

describe("useRelationMutation — cache invalidation", () => {
  it("invalidates entityItemCollection.forEntity(profileEntity) on success", async () => {
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler();

    const queryClient = makeQueryClient();
    const profile = makeInvoiceProfile();
    const entityItem = makeEntityItemWithSetTemplate('"v1"');

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRelationMutation(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "supplier",
        op: "set",
        targetHrefs: [SUPPLIER_URL],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.entityItemCollection.forEntity(profile),
    });
  });

  it("also invalidates targetProfileEntity collection when targetProfileEntity provided", async () => {
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler();

    const queryClient = makeQueryClient();
    const supplierProfile = makeSupplierProfile();
    const entityItem = makeEntityItemWithSetTemplate('"v1"');

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(
      () => useRelationMutation({ targetProfileEntity: supplierProfile }),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "supplier",
        op: "set",
        targetHrefs: [SUPPLIER_URL],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.entityItemCollection.forEntity(supplierProfile),
    });
  });

  it("does NOT invalidate targetProfileEntity collection when targetProfileEntity is not provided", async () => {
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler();

    const queryClient = makeQueryClient();
    const supplierProfile = makeSupplierProfile();
    const entityItem = makeEntityItemWithSetTemplate('"v1"');

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRelationMutation(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "supplier",
        op: "set",
        targetHrefs: [SUPPLIER_URL],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Should NOT have been called with the supplier collection key
    const supplierCollectionKey = queryKeys.entityItemCollection.forEntity(supplierProfile);
    const calledWithSupplier = invalidateSpy.mock.calls.some(
      (call) => JSON.stringify(call[0]) === JSON.stringify({ queryKey: supplierCollectionKey }),
    );
    expect(calledWithSupplier).toBe(false);
  });

  it("calls caller onSuccess after cache is populated", async () => {
    server.use(createRelationLinkHandler({ url: SUPPLIER_RELATION_URL }));
    wireRefetchHandler();

    const queryClient = makeQueryClient();
    const profile = makeInvoiceProfile();
    const entityItem = makeEntityItemWithSetTemplate('"v1"');

    let cacheAtCallTime: unknown = "NOT_CHECKED";
    const callerOnSuccess = vi.fn(async () => {
      cacheAtCallTime = queryClient.getQueryData(
        queryKeys.entityItem.byUrl(profile, INVOICE_ITEM_URL),
      );
    });

    const { result } = renderHook(
      () =>
        useRelationMutation({
          mutationOptions: { onSuccess: callerOnSuccess },
        }),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "supplier",
        op: "set",
        targetHrefs: [SUPPLIER_URL],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(callerOnSuccess).toHaveBeenCalledOnce();
    // Cache must already be set when caller onSuccess runs
    expect(cacheAtCallTime).toBeInstanceOf(EntityItem);
  });
});

// ---------------------------------------------------------------------------
// 412 ETag mismatch — no retry for add and clear
// ---------------------------------------------------------------------------

describe("useRelationMutation — 412 no retry (add and clear)", () => {
  it("surfaces 412 as ProblemDetailError and POST handler is hit exactly once for add (no retry)", async () => {
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
    const { result } = renderHook(() => useRelationMutation(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "lineItems",
        op: "add",
        targetHrefs: [LINE_ITEM_URL_1],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProblemDetailError);
    expect((result.current.error as ProblemDetailError<ProblemDetail>).problemDetail.status).toBe(
      412,
    );
    // No retry — POST handler called exactly once
    expect(postCallCount).toBe(1);
  });

  it("surfaces 412 as ProblemDetailError and DELETE handler is hit exactly once for clear (no retry)", async () => {
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

    const entityItem = makeEntityItemWithClearTemplate('"v1"');
    const { result } = renderHook(() => useRelationMutation(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({ entityItem, relationName: "supplier", op: "clear" });
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

// ---------------------------------------------------------------------------
// add op body — newline-separated hrefs
// ---------------------------------------------------------------------------

describe("useRelationMutation — add body is newline-separated", () => {
  it("POST body contains each href on its own line (\\n separated)", async () => {
    let capturedBody: string | null = null;

    server.use(
      http.post(LINE_ITEMS_RELATION_URL, async ({ request }) => {
        capturedBody = await request.text();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    wireRefetchHandler();

    const entityItem = makeEntityItemWithAddTemplate('"v1"');
    const { result } = renderHook(() => useRelationMutation(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "lineItems",
        op: "add",
        targetHrefs: [LINE_ITEM_URL_1, LINE_ITEM_URL_2],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedBody).not.toBeNull();
    // The two hrefs must be separated by a newline character
    const lines = capturedBody!
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    expect(lines).toContain(LINE_ITEM_URL_1);
    expect(lines).toContain(LINE_ITEM_URL_2);
    expect(lines).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 409 integrity/required-relation on clear
// ---------------------------------------------------------------------------

describe("useRelationMutation — 409 integrity/required-relation on clear", () => {
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

    const entityItem = makeEntityItemWithClearTemplate('"v1"');
    const { result } = renderHook(() => useRelationMutation(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({ entityItem, relationName: "supplier", op: "clear" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProblemDetailError);
    const problemError = result.current.error as ProblemDetailError<ProblemDetail>;
    expect(problemError.problemDetail.status).toBe(409);
    expect(problemError.problemDetail.type).toContain("required-relation");
  });
});

// ---------------------------------------------------------------------------
// set op exact-count guard — two hrefs throws
// ---------------------------------------------------------------------------

describe("useRelationMutation — set op exact-count guard", () => {
  it("throws when two hrefs are passed to set op (only one allowed)", async () => {
    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const { result } = renderHook(() => useRelationMutation(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "supplier",
        op: "set",
        targetHrefs: [SUPPLIER_URL, `${BASE}/suppliers/sup-002`],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain("'set' op requires exactly one targetHref");
  });

  it("throws when no hrefs are passed to set op", async () => {
    const entityItem = makeEntityItemWithSetTemplate('"v1"');
    const { result } = renderHook(() => useRelationMutation(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        entityItem,
        relationName: "supplier",
        op: "set",
        targetHrefs: [],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain("'set' op requires exactly one targetHref");
  });
});
