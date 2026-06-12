import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "../../test-setup";
import { queryKeys } from "./query-keys";
import { BASE, makeQueryClient, makeWrapper, seedProfile } from "./test-utils";
import { useUnlinkRelation } from "./use-unlink-relation";

const ITEM_URL = `${BASE}/invoices/inv-1`;
const RELATION_URL = `${ITEM_URL}/customer`;
const TAGS_RELATION_URL = `${ITEM_URL}/tags`;

/** Seed entity detail cache so relation URL and template are available without a live fetch. */
function seedEntityDetail(
  qc: ReturnType<typeof makeQueryClient>,
  relationName = "customer",
  relationUrl = RELATION_URL,
) {
  qc.setQueryData(queryKeys.entityDetail("invoice", "inv-1"), {
    data: { number: "INV-001" },
    selfHref: ITEM_URL,
    links: {},
    etag: '"etag-abc"',
    templates: {
      [`clear-${relationName}`]: { method: "DELETE", target: null, contentType: null },
    },
    canUpdate: false,
    canDelete: false,
    contentLinks: {},
    relationLinks: { [relationName]: relationUrl },
  });
}

describe("useUnlinkRelation", () => {
  it("DELETEs the relation URL for a many-to-one (no targetId)", async () => {
    let deletedUrl: string | undefined;
    server.use(
      http.delete(RELATION_URL, ({ request }) => {
        deletedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const qc = makeQueryClient();
    seedProfile(qc);
    seedEntityDetail(qc);

    const { result } = renderHook(() => useUnlinkRelation(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({
        entityName: "invoice",
        entityId: "inv-1",
        relationName: "customer",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deletedUrl).toBe(RELATION_URL);
  });

  it("DELETEs relation/targetId URL for many-to-many", async () => {
    let deletedUrl: string | undefined;
    server.use(
      http.delete(`${TAGS_RELATION_URL}/tag-5`, ({ request }) => {
        deletedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const qc = makeQueryClient();
    seedProfile(qc);
    seedEntityDetail(qc, "tags", TAGS_RELATION_URL);

    const { result } = renderHook(() => useUnlinkRelation(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({
        entityName: "invoice",
        entityId: "inv-1",
        relationName: "tags",
        targetId: "tag-5",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deletedUrl).toBe(`${TAGS_RELATION_URL}/tag-5`);
  });

  it("falls back to live fetch of item when entity detail cache is absent", async () => {
    let deletedUrl: string | undefined;

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
          _templates: {
            "clear-customer": { method: "DELETE", properties: [] },
          },
        }),
      ),
      http.delete(RELATION_URL, ({ request }) => {
        deletedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const qc = makeQueryClient();
    seedProfile(qc);
    // Entity detail NOT seeded — forces live fetch

    const { result } = renderHook(() => useUnlinkRelation(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({
        entityName: "invoice",
        entityId: "inv-1",
        relationName: "customer",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deletedUrl).toBe(RELATION_URL);
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
          // No clear-customer template — server did not grant unlink permission
          _templates: {},
        }),
      ),
    );

    const qc = makeQueryClient();
    seedProfile(qc);

    const { result } = renderHook(() => useUnlinkRelation(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({
        entityName: "invoice",
        entityId: "inv-1",
        relationName: "customer",
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/Operation not supported/);
  });

  it("invalidates entityRelations query on success", async () => {
    server.use(http.delete(RELATION_URL, () => new HttpResponse(null, { status: 204 })));

    const qc = makeQueryClient();
    seedProfile(qc);
    seedEntityDetail(qc);
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useUnlinkRelation(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({
        entityName: "invoice",
        entityId: "inv-1",
        relationName: "customer",
      });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(["entity-relations", "invoice", "inv-1", "customer"]);
  });

  it("rejects on a 404 when entity or relation is not found", async () => {
    server.use(
      http.delete(RELATION_URL, () =>
        HttpResponse.json(
          { status: 404, title: "Not Found" },
          { status: 404, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const qc = makeQueryClient();
    seedProfile(qc);
    seedEntityDetail(qc);

    const { result } = renderHook(() => useUnlinkRelation(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({
        entityName: "invoice",
        entityId: "inv-1",
        relationName: "customer",
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });

  it("throws when entity is not in profile", async () => {
    const qc = makeQueryClient();
    seedProfile(qc);

    const { result } = renderHook(() => useUnlinkRelation(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({
        entityName: "unknown-entity",
        entityId: "inv-1",
        relationName: "customer",
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/Unknown entity/);
  });
});
