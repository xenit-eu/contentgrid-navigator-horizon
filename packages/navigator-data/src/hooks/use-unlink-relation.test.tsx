import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "../../test-setup";
import { BASE, makeQueryClient, makeWrapper, seedProfile } from "./test-utils";
import { useUnlinkRelation } from "./use-unlink-relation";

describe("useUnlinkRelation", () => {
  it("DELETEs the relation URL for a many-to-one (no targetId)", async () => {
    let deletedUrl: string | undefined;
    server.use(
      http.delete(`${BASE}/invoices/inv-1/customer`, ({ request }) => {
        deletedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const qc = makeQueryClient();
    seedProfile(qc);

    const { result } = renderHook(() => useUnlinkRelation(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({
        entityName: "invoice",
        entityId: "inv-1",
        relationName: "customer",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deletedUrl).toBe(`${BASE}/invoices/inv-1/customer`);
  });

  it("DELETEs relation/targetId URL for many-to-many", async () => {
    let deletedUrl: string | undefined;
    server.use(
      http.delete(`${BASE}/invoices/inv-1/tags/tag-5`, ({ request }) => {
        deletedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const qc = makeQueryClient();
    seedProfile(qc);

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
    expect(deletedUrl).toBe(`${BASE}/invoices/inv-1/tags/tag-5`);
  });

  it("invalidates entityRelations query on success", async () => {
    server.use(
      http.delete(`${BASE}/invoices/inv-1/customer`, () => new HttpResponse(null, { status: 204 })),
    );

    const qc = makeQueryClient();
    seedProfile(qc);
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
      http.delete(`${BASE}/invoices/inv-1/customer`, () =>
        HttpResponse.json(
          { status: 404, title: "Not Found" },
          { status: 404, headers: { "Content-Type": "application/problem+json" } },
        ),
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
