import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import { BASE, makeQueryClient, makeWrapper, mockProfileResponse, seedProfile } from "./test-utils";
import { useEntityDetail } from "./use-entity-detail";

const ITEM_URL = `${BASE}/invoices/inv-1`;

describe("useEntityDetail", () => {
  it("fetches entity item and returns data, selfHref, links and etag", async () => {
    server.use(
      http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
      http.get(ITEM_URL, () =>
        HttpResponse.json(
          {
            id: "inv-1",
            number: "INV-001",
            _links: {
              self: { href: ITEM_URL },
              "cg:relation": [{ href: `${ITEM_URL}/customer`, name: "customer" }],
              curies: [
                {
                  href: "https://contentgrid.cloud/rels/contentgrid/{rel}",
                  name: "cg",
                  templated: true,
                },
              ],
            },
          },
          { headers: { ETag: '"etag-abc"' } },
        ),
      ),
    );

    const { result } = renderHook(() => useEntityDetail("invoice", "inv-1"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect((result.current.data!.data as Record<string, unknown>).number).toBe("INV-001");
    expect(result.current.data!.selfHref).toBe(ITEM_URL);
    expect(result.current.data!.etag).toBe('"etag-abc"');
    expect(result.current.data!.links).toHaveProperty("self");
  });

  it("is not enabled when entityName is empty", () => {
    // Seed the profile so no HTTP request fires — the hook must not start
    // a profile fetch that would hit MSW with no registered handler.
    const qc = makeQueryClient();
    seedProfile(qc);
    const { result } = renderHook(() => useEntityDetail("", "inv-1"), {
      wrapper: makeWrapper(qc),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("surfaces ProblemDetailError on a 404 response", async () => {
    server.use(
      http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
      http.get(ITEM_URL, () =>
        HttpResponse.json(
          { status: 404, title: "Not Found" },
          { status: 404, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const { result } = renderHook(() => useEntityDetail("invoice", "inv-1"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});
