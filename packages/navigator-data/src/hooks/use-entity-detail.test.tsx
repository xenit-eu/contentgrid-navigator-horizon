import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import { BASE, makeQueryClient, makeWrapper, mockProfileResponse, seedProfile } from "./test-utils";
import { useEntityDetail } from "./use-entity-detail";

const ITEM_URL = `${BASE}/invoices/inv-1`;

describe("useEntityDetail", () => {
  it("fetches entity item and returns data, selfHref, links, etag, and templates", async () => {
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
              "cg:content": [{ href: `${ITEM_URL}/document`, name: "document" }],
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
              "set-customer": { method: "PUT", contentType: "text/uri-list", properties: [] },
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

    const detail = result.current.data!;
    expect((detail.data as Record<string, unknown>).number).toBe("INV-001");
    expect(detail.selfHref).toBe(ITEM_URL);
    expect(detail.etag).toBe('"etag-abc"');
    expect(detail.links).toHaveProperty("self");

    // Template capability flags
    expect(detail.canUpdate).toBe(true);
    expect(detail.canDelete).toBe(true);
    expect(detail.templates["default"]).toEqual({
      method: "PATCH",
      target: null,
      contentType: "application/json",
    });
    expect(detail.templates["delete"]).toEqual({
      method: "DELETE",
      target: null,
      contentType: null,
    });
    expect(detail.templates["set-customer"]).toEqual({
      method: "PUT",
      target: null,
      contentType: "text/uri-list",
    });

    // Link maps
    expect(detail.contentLinks["document"]).toBe(`${ITEM_URL}/document`);
    expect(detail.relationLinks["customer"]).toBe(`${ITEM_URL}/customer`);
  });

  it("sets canUpdate=false and canDelete=false when templates are absent", async () => {
    server.use(
      http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
      http.get(ITEM_URL, () =>
        HttpResponse.json(
          {
            id: "inv-1",
            number: "INV-001",
            _links: { self: { href: ITEM_URL } },
          },
          { headers: { ETag: '"etag-ro"' } },
        ),
      ),
    );

    const { result } = renderHook(() => useEntityDetail("invoice", "inv-1"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data!.canUpdate).toBe(false);
    expect(result.current.data!.canDelete).toBe(false);
    expect(result.current.data!.templates).toEqual({});
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
