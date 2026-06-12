import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "../../test-setup";
import { PreconditionFailedError } from "../api/errors";
import { queryKeys } from "./query-keys";
import { BASE, makeQueryClient, makeWrapper, seedProfile } from "./test-utils";
import { useDeleteEntity } from "./use-delete-entity";

const ITEM_URL = `${BASE}/invoices/inv-1`;

/** Seed a minimal entity detail cache entry so the ETag and templates are available. */
function seedEntityDetail(
  qc: ReturnType<typeof makeQueryClient>,
  etag = '"etag-abc"',
  overrides: Record<string, unknown> = {},
) {
  qc.setQueryData(queryKeys.entityDetail("invoice", "inv-1"), {
    data: { number: "INV-001" },
    selfHref: ITEM_URL,
    links: {},
    etag,
    templates: {
      default: { method: "PATCH", target: null, contentType: "application/json" },
      delete: { method: "DELETE", target: null, contentType: null },
    },
    canUpdate: true,
    canDelete: true,
    contentLinks: {},
    relationLinks: {},
    ...overrides,
  });
}

describe("useDeleteEntity", () => {
  it("sends DELETE with If-Match to the item URL (method/target from template)", async () => {
    let deletedUrl: string | undefined;
    let capturedIfMatch: string | null = null;
    server.use(
      http.delete(ITEM_URL, ({ request }) => {
        deletedUrl = request.url;
        capturedIfMatch = request.headers.get("If-Match");
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const qc = makeQueryClient();
    seedProfile(qc);
    seedEntityDetail(qc);

    const { result } = renderHook(() => useDeleteEntity(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({ entityName: "invoice", entityId: "inv-1" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deletedUrl).toBe(ITEM_URL);
    expect(capturedIfMatch).toBe('"etag-abc"');
  });

  it("uses method and target from the 'delete' template", async () => {
    let capturedMethod: string | undefined;
    const CUSTOM_URL = `${BASE}/invoices/inv-1?force=true`;

    server.use(
      http.all(CUSTOM_URL, ({ request }) => {
        capturedMethod = request.method;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const qc = makeQueryClient();
    seedProfile(qc);
    seedEntityDetail(qc, '"etag-abc"', {
      templates: {
        delete: { method: "DELETE", target: CUSTOM_URL, contentType: null },
      },
    });

    const { result } = renderHook(() => useDeleteEntity(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({ entityName: "invoice", entityId: "inv-1" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedMethod).toBe("DELETE");
  });

  it("invalidates list and count queries on success", async () => {
    const qc = makeQueryClient();
    seedProfile(qc);
    seedEntityDetail(qc);
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    server.use(http.delete(ITEM_URL, () => new HttpResponse(null, { status: 204 })));

    const { result } = renderHook(() => useDeleteEntity(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({ entityName: "invoice", entityId: "inv-1" });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(["entity-list", "invoice", {}]);
    expect(invalidatedKeys).toContainEqual(["entity-count", "invoice"]);
  });

  it("throws PreconditionFailedError when the server returns 412", async () => {
    server.use(
      http.delete(ITEM_URL, () =>
        HttpResponse.json(
          {
            type: "https://contentgrid.cloud/problems/unsatisfied-version",
            title: "Unsatisfied version",
            status: 412,
          },
          { status: 412, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const qc = makeQueryClient();
    seedProfile(qc);
    seedEntityDetail(qc);

    const { result } = renderHook(() => useDeleteEntity(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({ entityName: "invoice", entityId: "inv-1" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(PreconditionFailedError);
  });

  it("throws when the entity name is unknown (not in profile)", async () => {
    const qc = makeQueryClient();
    seedProfile(qc);

    const { result } = renderHook(() => useDeleteEntity(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({ entityName: "unknown-entity", entityId: "x-1" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/Unknown entity/);
  });

  it("throws when no ETag is cached for the entity", async () => {
    const qc = makeQueryClient();
    seedProfile(qc);
    // Intentionally do NOT seed entity detail — no ETag available.

    const { result } = renderHook(() => useDeleteEntity(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({ entityName: "invoice", entityId: "inv-1" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/No ETag cached/);
  });

  it("throws when the 'delete' template is absent (operation not supported)", async () => {
    const qc = makeQueryClient();
    seedProfile(qc);
    // Seed without the 'delete' template — server did not grant delete permission
    seedEntityDetail(qc, '"etag-abc"', {
      templates: {
        default: { method: "PATCH", target: null, contentType: "application/json" },
      },
      canDelete: false,
    });

    const { result } = renderHook(() => useDeleteEntity(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({ entityName: "invoice", entityId: "inv-1" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/Operation not supported/);
    expect((result.current.error as Error).message).toMatch(/"delete" template/);
  });
});
