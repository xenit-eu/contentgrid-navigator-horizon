import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import { queryKeys } from "./query-keys";
import { BASE, makeQueryClient, makeWrapper, seedProfile } from "./test-utils";
import { useUpdateEntity } from "./use-update-entity";

const ITEM_URL = `${BASE}/invoices/inv-1`;

/** Seed a minimal entity detail cache entry so the ETag is available. */
function seedEntityDetail(qc: ReturnType<typeof makeQueryClient>, etag = '"etag-abc"') {
  qc.setQueryData(queryKeys.entityDetail("invoice", "inv-1"), {
    data: { number: "INV-001" },
    selfHref: ITEM_URL,
    links: {},
    etag,
  });
}

describe("useUpdateEntity", () => {
  it("PATCHes JSON with If-Match to the item URL", async () => {
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

  it("also PUTs the content file when provided", async () => {
    let contentPutReceived = false;
    server.use(
      http.patch(ITEM_URL, () => new HttpResponse(null, { status: 204 })),
      http.put(`${ITEM_URL}/document`, () => {
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
});
