import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import { BASE, makeQueryClient, makeWrapper, seedProfile } from "./test-utils";
import { useLinkRelation } from "./use-link-relation";

const RELATION_URL = `${BASE}/invoices/inv-1/customer`;

describe("useLinkRelation", () => {
  it("PUTs a text/uri-list to the relation URL", async () => {
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
});
