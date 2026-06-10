import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import { type AuthenticationTokenSupplier, createApiClient } from "../api/client";
import { NavigatorDataProvider } from "./context";
import { useEntityRelations } from "./use-entity-relations";

const BASE = "https://api.example.com";
const PROFILE_URL = `${BASE}/profile`;
const COLLECTION_URL = `${BASE}/invoices`;
const ITEM_URL = `${COLLECTION_URL}/inv-1`;
const RELATION_URL = `${ITEM_URL}/customer`;
const CUSTOMER_URL = `${BASE}/customers/cust-1`;

const noopSupplier: AuthenticationTokenSupplier = async () => ({
  token: "test-token",
  expiresAt: null,
});

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const apiFetch = createApiClient(noopSupplier);

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider apiFetch={apiFetch} profileUrl={PROFILE_URL}>
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  };
}

function mockProfile() {
  server.use(
    http.get(PROFILE_URL, () =>
      HttpResponse.json({
        _links: {
          self: { href: PROFILE_URL },
          "cg:entity": [{ href: `${BASE}/profile/invoices`, name: "invoice", title: "Invoice" }],
          curies: [
            {
              href: "https://contentgrid.cloud/rels/contentgrid/{rel}",
              name: "cg",
              templated: true,
            },
          ],
        },
        _templates: {},
      }),
    ),
  );
}

function mockEntityDetail() {
  server.use(
    http.get(ITEM_URL, () =>
      HttpResponse.json({
        id: "inv-1",
        number: "INV-001",
        _links: {
          self: { href: ITEM_URL },
          "cg:relation": [{ href: RELATION_URL, name: "customer" }],
          curies: [
            {
              href: "https://contentgrid.cloud/rels/contentgrid/{rel}",
              name: "cg",
              templated: true,
            },
          ],
        },
      }),
    ),
  );
}

describe("useEntityRelations", () => {
  it("returns a single item for a to-one relation (no _embedded)", async () => {
    mockProfile();
    mockEntityDetail();
    server.use(
      http.get(RELATION_URL, () =>
        HttpResponse.json({
          id: "cust-1",
          name: "Acme Corp",
          _links: { self: { href: CUSTOMER_URL } },
        }),
      ),
    );

    const { result } = renderHook(() => useEntityRelations("invoice", "inv-1", "customer"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].selfHref).toBe(CUSTOMER_URL);
    expect((result.current.data![0].data as Record<string, unknown>).name).toBe("Acme Corp");
  });

  it("returns multiple items for a to-many relation (has _embedded)", async () => {
    mockProfile();
    mockEntityDetail();
    // Regression: previously two GET requests were sent to RELATION_URL;
    // now only one request is made and HalSlice.from(object) is used.
    let requestCount = 0;
    server.use(
      http.get(RELATION_URL, () => {
        requestCount++;
        return HttpResponse.json({
          _links: { self: { href: RELATION_URL } },
          _embedded: {
            item: [
              {
                id: "cust-1",
                name: "Acme",
                _links: { self: { href: `${BASE}/customers/cust-1` } },
              },
              {
                id: "cust-2",
                name: "Globex",
                _links: { self: { href: `${BASE}/customers/cust-2` } },
              },
            ],
          },
        });
      }),
    );

    const { result } = renderHook(() => useEntityRelations("invoice", "inv-1", "customer"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data).toHaveLength(2);
    // Regression: only one HTTP request should be made, not two
    expect(requestCount).toBe(1);
  });

  it("returns empty array when the relation endpoint returns 404 (unlinked to-one)", async () => {
    mockProfile();
    mockEntityDetail();
    server.use(
      http.get(RELATION_URL, () =>
        HttpResponse.json(
          { status: 404, title: "Not Found" },
          { status: 404, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const { result } = renderHook(() => useEntityRelations("invoice", "inv-1", "customer"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data).toEqual([]);
  });

  it("surfaces an error (not empty array) when the relation endpoint returns a non-404 error", async () => {
    mockProfile();
    mockEntityDetail();
    server.use(
      http.get(RELATION_URL, () =>
        HttpResponse.json(
          { status: 500, title: "Internal Server Error" },
          { status: 500, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const { result } = renderHook(() => useEntityRelations("invoice", "inv-1", "customer"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });

  it("is not enabled when the entity item has no matching relation link", async () => {
    mockProfile();
    // Respond with an entity detail that has no relation links
    server.use(
      http.get(ITEM_URL, () =>
        HttpResponse.json({
          id: "inv-1",
          number: "INV-001",
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
        }),
      ),
    );

    const { result } = renderHook(() => useEntityRelations("invoice", "inv-1", "nonexistent"), {
      wrapper: makeWrapper(),
    });

    // No relation link → query stays idle (never fires)
    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"), { timeout: 3000 });
  });
});
