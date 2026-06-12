import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "../../test-setup";
import { PreconditionFailedError } from "../api/errors";
import { queryKeys } from "./query-keys";
import { BASE, makeQueryClient, makeWrapper, mockProfileResponse, seedProfile } from "./test-utils";
import { useEntityDetail } from "./use-entity-detail";
import { useUpdateEntity } from "./use-update-entity";

const ITEM_URL = `${BASE}/invoices/inv-1`;
const CONTENT_URL = `${BASE}/invoices/inv-1/document`;

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
    contentLinks: { document: CONTENT_URL },
    relationLinks: {},
    ...overrides,
  });
}

describe("useUpdateEntity", () => {
  it("PATCHes JSON with If-Match to the item URL (method/target from template)", async () => {
    let capturedBody: unknown;
    let capturedIfMatch: string | null = null;
    server.use(
      http.patch(ITEM_URL, async ({ request }) => {
        capturedBody = await request.json();
        capturedIfMatch = request.headers.get("If-Match");
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const qc = makeQueryClient();
    seedProfile(qc);
    seedEntityDetail(qc);

    const { result } = renderHook(() => useUpdateEntity(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({
        entityName: "invoice",
        entityId: "inv-1",
        data: { number: "INV-001", status: "sent" },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedBody).toEqual({ number: "INV-001", status: "sent" });
    expect(capturedIfMatch).toBe('"etag-abc"');
  });

  it("uses method and target from the 'default' template", async () => {
    let capturedMethod: string | undefined;
    let capturedUrl: string | undefined;
    const CUSTOM_URL = `${BASE}/invoices/inv-1/metadata`;

    server.use(
      http.all(CUSTOM_URL, async ({ request }) => {
        capturedMethod = request.method;
        capturedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const qc = makeQueryClient();
    seedProfile(qc);
    // Seed with a custom method and target from the template
    seedEntityDetail(qc, '"etag-abc"', {
      templates: {
        default: { method: "PUT", target: CUSTOM_URL, contentType: "application/json" },
      },
    });

    const { result } = renderHook(() => useUpdateEntity(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({
        entityName: "invoice",
        entityId: "inv-1",
        data: { number: "INV-001" },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedMethod).toBe("PUT");
    expect(capturedUrl).toBe(CUSTOM_URL);
  });

  it("also PUTs the content file to the cg:content link URL when provided", async () => {
    let contentPutReceived = false;
    server.use(
      http.patch(ITEM_URL, () => new HttpResponse(null, { status: 204 })),
      http.put(CONTENT_URL, () => {
        contentPutReceived = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const qc = makeQueryClient();
    seedProfile(qc);
    seedEntityDetail(qc);

    const { result } = renderHook(() => useUpdateEntity(), { wrapper: makeWrapper(qc) });
    const file = new File(["data"], "doc.pdf", { type: "application/pdf" });

    await act(async () => {
      await result.current.mutateAsync({
        entityName: "invoice",
        entityId: "inv-1",
        data: {},
        file,
        contentAttributeName: "document",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(contentPutReceived).toBe(true);
  });

  it("throws when the entity name is unknown", async () => {
    const qc = makeQueryClient();
    seedProfile(qc);

    const { result } = renderHook(() => useUpdateEntity(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({ entityName: "unknown", entityId: "x-1", data: {} });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/Unknown entity/);
  });

  it("throws PreconditionFailedError when the server returns 412", async () => {
    server.use(
      http.patch(ITEM_URL, () =>
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

    const { result } = renderHook(() => useUpdateEntity(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({ entityName: "invoice", entityId: "inv-1", data: {} });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(PreconditionFailedError);
  });

  it("throws when no ETag is cached for the entity", async () => {
    const qc = makeQueryClient();
    seedProfile(qc);
    // Intentionally do NOT seed entity detail — no ETag available.

    const { result } = renderHook(() => useUpdateEntity(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({ entityName: "invoice", entityId: "inv-1", data: {} });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/No ETag cached/);
  });

  it("throws when the 'default' template is absent (operation not supported)", async () => {
    const qc = makeQueryClient();
    seedProfile(qc);
    // Seed without the 'default' template — server did not grant update permission
    seedEntityDetail(qc, '"etag-abc"', {
      templates: {},
      canUpdate: false,
    });

    const { result } = renderHook(() => useUpdateEntity(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({ entityName: "invoice", entityId: "inv-1", data: {} });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/Operation not supported/);
    expect((result.current.error as Error).message).toMatch(/"default" template/);
  });

  it("throws when a content upload is requested but cg:content link is missing", async () => {
    server.use(http.patch(ITEM_URL, () => new HttpResponse(null, { status: 204 })));

    const qc = makeQueryClient();
    seedProfile(qc);
    // Seed without content links
    seedEntityDetail(qc, '"etag-abc"', {
      contentLinks: {},
    });

    const { result } = renderHook(() => useUpdateEntity(), { wrapper: makeWrapper(qc) });
    const file = new File(["data"], "doc.pdf", { type: "application/pdf" });

    await act(async () => {
      result.current.mutate({
        entityName: "invoice",
        entityId: "inv-1",
        data: {},
        file,
        contentAttributeName: "document",
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/No content link/);
  });

  it("invalidates entityDetail and entityList queries on success", async () => {
    const qc = makeQueryClient();
    seedProfile(qc);
    seedEntityDetail(qc);
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    server.use(http.patch(ITEM_URL, () => new HttpResponse(null, { status: 204 })));

    const { result } = renderHook(() => useUpdateEntity(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({ entityName: "invoice", entityId: "inv-1", data: {} });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(["entity-detail", "invoice", "inv-1"]);
    expect(invalidatedKeys).toContainEqual(["entity-list", "invoice", {}]);
  });

  it("after useUpdateEntity succeeds, useEntityDetail refetches and reflects updated data", async () => {
    const qc = makeQueryClient();

    let getCallCount = 0;
    // First GET returns v1, subsequent GETs (after invalidation) return v2
    server.use(
      http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
      http.get(ITEM_URL, () => {
        getCallCount++;
        const number = getCallCount === 1 ? "INV-001-original" : "INV-001-updated";
        return HttpResponse.json(
          {
            id: "inv-1",
            number,
            _links: {
              self: { href: ITEM_URL },
              curies: [
                {
                  href: "https://contentgrid.cloud/rels/contentgrid/{rel}",
                  name: "cg",
                  templated: true,
                },
              ],
            },
            _templates: {
              default: { method: "PATCH", contentType: "application/json", properties: [] },
              delete: { method: "DELETE", properties: [] },
            },
          },
          { headers: { ETag: `"etag-v${getCallCount}"` } },
        );
      }),
      http.patch(ITEM_URL, () => new HttpResponse(null, { status: 204 })),
    );

    const wrapper = makeWrapper(qc);

    // 1. Mount useEntityDetail and wait for v1 data
    const detailHook = renderHook(() => useEntityDetail("invoice", "inv-1"), { wrapper });
    await waitFor(() => expect(detailHook.result.current.data).toBeDefined());
    expect((detailHook.result.current.data!.data as Record<string, unknown>).number).toBe(
      "INV-001-original",
    );

    // 2. Mount useUpdateEntity and trigger a PATCH
    const updateHook = renderHook(() => useUpdateEntity(), { wrapper });

    await act(async () => {
      await updateHook.result.current.mutateAsync({
        entityName: "invoice",
        entityId: "inv-1",
        data: { number: "INV-001-updated" },
      });
    });

    await waitFor(() => expect(updateHook.result.current.isSuccess).toBe(true));

    // 3. After invalidation, useEntityDetail should have refetched and show v2
    await waitFor(
      () =>
        expect((detailHook.result.current.data!.data as Record<string, unknown>).number).toBe(
          "INV-001-updated",
        ),
      { timeout: 5000 },
    );
    expect(getCallCount).toBeGreaterThanOrEqual(2);
  });
});
