import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import { BASE, makeQueryClient, makeWrapper, seedProfile } from "./test-utils";
import { useCreateEntity } from "./use-create-entity";

const COLLECTION_URL = `${BASE}/invoices`;
const CREATED_URL = `${COLLECTION_URL}/inv-new`;

describe("useCreateEntity", () => {
  it("POSTs JSON and returns the Location header", async () => {
    server.use(
      http.post(
        COLLECTION_URL,
        () => new HttpResponse(null, { status: 201, headers: { Location: CREATED_URL } }),
      ),
    );

    const qc = makeQueryClient();
    seedProfile(qc);

    const { result } = renderHook(() => useCreateEntity(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({ entityName: "invoice", data: { number: "INV-001" } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(CREATED_URL);
  });

  it("POSTs multipart FormData when a file is provided", async () => {
    let receivedContentType: string | null = null;
    server.use(
      http.post(COLLECTION_URL, ({ request }) => {
        receivedContentType = request.headers.get("Content-Type");
        return new HttpResponse(null, { status: 201, headers: { Location: CREATED_URL } });
      }),
    );

    const qc = makeQueryClient();
    seedProfile(qc);

    const { result } = renderHook(() => useCreateEntity(), { wrapper: makeWrapper(qc) });
    const file = new File(["content"], "doc.pdf", { type: "application/pdf" });

    await act(async () => {
      await result.current.mutateAsync({
        entityName: "invoice",
        data: { number: "INV-001" },
        file,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(receivedContentType).toContain("multipart/form-data");
  });

  it("throws when entity is not in profile", async () => {
    const qc = makeQueryClient();
    seedProfile(qc);

    const { result } = renderHook(() => useCreateEntity(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({ entityName: "unknown", data: {} });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/Unknown entity/);
  });
});
