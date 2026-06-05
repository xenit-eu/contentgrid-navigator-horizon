import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import { BASE, makeQueryClient, makeWrapper, seedProfile } from "./test-utils";
import { useUpdateEntity } from "./use-update-entity";

const ITEM_URL = `${BASE}/invoices/inv-1`;

describe("useUpdateEntity", () => {
  it("PUTs JSON to the item URL", async () => {
    let capturedBody: unknown;
    server.use(
      http.put(ITEM_URL, async ({ request }) => {
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const qc = makeQueryClient();
    seedProfile(qc);

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
  });

  it("also PUTs the content file when provided", async () => {
    let contentPutReceived = false;
    server.use(
      http.put(ITEM_URL, () => new HttpResponse(null, { status: 204 })),
      http.put(`${ITEM_URL}/document`, () => {
        contentPutReceived = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const qc = makeQueryClient();
    seedProfile(qc);

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
});
