import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "../../test-setup";
import { queryKeys } from "./query-keys";
import { BASE, makeQueryClient, makeWrapper, seedProfile } from "./test-utils";
import { useLinkRelation } from "./use-link-relation";

const ITEM_URL = `${BASE}/invoices/inv-1`;
const RELATION_URL = `${ITEM_URL}/customer`;

/** Seed entity detail cache so relation URL and template are available without a live fetch. */
function seedEntityDetail(qc: ReturnType<typeof makeQueryClient>) {
  qc.setQueryData(queryKeys.entityDetail("invoice", "inv-1"), {
    data: { number: "INV-001" },
    selfHref: ITEM_URL,
    links: {},
    etag: '"etag-abc"',
    templates: {
      "set-customer": { method: "PUT", target: null, contentType: "text/uri-list" },
    },
    canUpdate: true,
    canDelete: false,
    contentLinks: {},
    relationLinks: { customer: RELATION_URL },
  });
}

describe("useLinkRelation", () => {
  it("PUTs a text/uri-list to the relation URL (from cg:relation link and template)", async () => {
    let capturedBody: string | null = null;
    let capturedContentType: string | null = null;

    server.use(
      http.put(RELATION_URL, async ({ request }) => {
        capturedBody = await request.text();
        capturedContentType = request.headers.get("Content-Type");
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const qc = makeQueryClient();
    seedProfile(qc);
    seedEntityDetail(qc);

    const { result } = renderHook(() => useLinkRelation(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({
        entityName: "invoice",
        entityId: "inv-1",
        relationName: "customer",
        targetUri: `${BASE}/customers/cust-1`,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedBody).toBe(`${BASE}/customers/cust-1`);
    expect(capturedContentType).toBe("text/uri-list");
  });

  it("uses method from the set-<relation> template", async () => {
    let capturedMethod: string | undefined;

    server.use(
      http.all(RELATION_URL, ({ request }) => {
        capturedMethod = request.method;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const qc = makeQueryClient();
    seedProfile(qc);
    seedEntityDetail(qc);

    const { result } = renderHook(() => useLinkRelation(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({
        entityName: "invoice",
        entityId: "inv-1",
        relationName: "customer",
        targetUri: `${BASE}/customers/cust-1`,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedMethod).toBe("PUT");
  });

  it("falls back to live fetch of item when entity detail cache is absent", async () => {
    let capturedBody: string | null = null;

    server.use(
      // The hook must GET the item to resolve relation link and template
      http.get(ITEM_URL, () =>
        HttpResponse.json({
          id: "inv-1",
          _links: {
            self: { href: ITEM_URL },
            "cg:relation": [{ href: RELATION_URL, name: "customer" }],
            curies: [
              {
                href: "https://contentgrid.cloud/rels/contentgrid/{rel}",
                name: "cg",
                templated: true,
              },
            ],
          },
          _templates: {
            "set-customer": { method: "PUT", contentType: "text/uri-list", properties: [] },
          },
        }),
      ),
      http.put(RELATION_URL, async ({ request }) => {
        capturedBody = await request.text();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const qc = makeQueryClient();
    seedProfile(qc);
    // Entity detail NOT seeded — forces live fetch

    const { result } = renderHook(() => useLinkRelation(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({
        entityName: "invoice",
        entityId: "inv-1",
        relationName: "customer",
        targetUri: `${BASE}/customers/cust-1`,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedBody).toBe(`${BASE}/customers/cust-1`);
  });

  it("throws when template is absent on the item (operation not supported)", async () => {
    server.use(
      http.get(ITEM_URL, () =>
        HttpResponse.json({
          id: "inv-1",
          _links: {
            self: { href: ITEM_URL },
            "cg:relation": [{ href: RELATION_URL, name: "customer" }],
            curies: [
              {
                href: "https://contentgrid.cloud/rels/contentgrid/{rel}",
                name: "cg",
                templated: true,
              },
            ],
          },
          // No templates — server did not grant link permission
          _templates: {},
        }),
      ),
    );

    const qc = makeQueryClient();
    seedProfile(qc);

    const { result } = renderHook(() => useLinkRelation(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({
        entityName: "invoice",
        entityId: "inv-1",
        relationName: "customer",
        targetUri: `${BASE}/customers/cust-1`,
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/Operation not supported/);
  });

  it("invalidates entityRelations query on success", async () => {
    server.use(http.put(RELATION_URL, () => new HttpResponse(null, { status: 204 })));

    const qc = makeQueryClient();
    seedProfile(qc);
    seedEntityDetail(qc);
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useLinkRelation(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({
        entityName: "invoice",
        entityId: "inv-1",
        relationName: "customer",
        targetUri: `${BASE}/customers/cust-1`,
      });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(["entity-relations", "invoice", "inv-1", "customer"]);
  });

  it("rejects on a 409 conflict response", async () => {
    server.use(
      http.put(RELATION_URL, () =>
        HttpResponse.json(
          { status: 409, title: "Conflict" },
          { status: 409, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const qc = makeQueryClient();
    seedProfile(qc);
    seedEntityDetail(qc);

    const { result } = renderHook(() => useLinkRelation(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({
        entityName: "invoice",
        entityId: "inv-1",
        relationName: "customer",
        targetUri: `${BASE}/customers/cust-1`,
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });

  it("throws when entity is not in profile", async () => {
    const qc = makeQueryClient();
    seedProfile(qc);

    const { result } = renderHook(() => useLinkRelation(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({
        entityName: "unknown-entity",
        entityId: "inv-1",
        relationName: "customer",
        targetUri: `${BASE}/customers/cust-1`,
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/Unknown entity/);
  });
});
