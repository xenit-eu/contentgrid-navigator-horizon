import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import {
  BASE,
  INVOICE_ENTITY,
  ROOT_URL,
  makeQueryClient,
  makeWrapper,
  mockProfileResponse,
  mockRootResponse,
  registerProfileHandlers,
  seedProfile,
} from "./test-utils";
import { useEntityDetail } from "./use-entity-detail";
import { useEntitySchema } from "./use-entity-schema";

const ITEM_URL = `${BASE}/invoices/inv-1`;

describe("useEntityDetail", () => {
  it("fetches entity item using the RFC 6570 item template and returns data, selfHref, links and etag", async () => {
    registerProfileHandlers(server);
    server.use(
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
    registerProfileHandlers(server);
    server.use(
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

  it("returns empty selfHref and links when the response carries no _links", async () => {
    registerProfileHandlers(server);
    server.use(
      // Degenerate response: no _links at all — selfHref and links must fall back
      http.get(ITEM_URL, () => HttpResponse.json({ id: "inv-1", number: "INV-001" })),
    );

    const { result } = renderHook(() => useEntityDetail("invoice", "inv-1"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.selfHref).toBe("");
    expect(result.current.data!.links).toEqual({});
    expect((result.current.data!.data as Record<string, unknown>).number).toBe("INV-001");
  });

  it("stays disabled when the profile exposes no describes item link", async () => {
    // Entity profile WITHOUT the describes item link — item access is not
    // available (affordance rule 2). No ITEM_URL handler is registered: an
    // attempted item fetch would fail the unhandled-request check.
    server.use(
      http.get(ROOT_URL, () => HttpResponse.json(mockRootResponse())),
      http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
      http.get(INVOICE_ENTITY.href, () =>
        HttpResponse.json({
          name: "invoice",
          title: "Invoice",
          _links: { self: { href: INVOICE_ENTITY.href } },
          _templates: {},
        }),
      ),
    );

    const { result } = renderHook(
      () => ({
        schema: useEntitySchema("invoice"),
        detail: useEntityDetail("invoice", "inv-1"),
      }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.schema.data).toBeDefined());

    expect(result.current.schema.data!.itemTemplateHref).toBeNull();
    expect(result.current.detail.fetchStatus).toBe("idle");
    expect(result.current.detail.data).toBeUndefined();
  });
});
