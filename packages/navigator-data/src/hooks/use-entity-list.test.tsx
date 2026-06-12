import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import { type AuthenticationTokenSupplier, createApiClient } from "../api/client";
import { NavigatorDataProvider } from "./context";
import { useEntityList } from "./use-entity-list";

const BASE = "https://api.example.com";
const PROFILE_URL = `${BASE}/profile`;
const ROOT_URL = `${BASE}/`;
const COLLECTION_URL = `${BASE}/invoices`;

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

/**
 * Register both root resource and profile handlers.
 * Root resource cg:entity links provide collection hrefs; profile root provides profile hrefs.
 */
function mockProfile() {
  server.use(
    http.get(ROOT_URL, () =>
      HttpResponse.json({
        _links: {
          self: { href: ROOT_URL },
          "cg:entity": [{ href: COLLECTION_URL, name: "invoice", title: "Invoice" }],
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

describe("useEntityList", () => {
  it("returns items and parses page.total_items_exact into totalItems", async () => {
    mockProfile();
    server.use(
      http.get(COLLECTION_URL, () =>
        HttpResponse.json({
          _links: { self: { href: COLLECTION_URL } },
          _embedded: {
            item: [
              {
                id: "inv-1",
                number: "INV-001",
                _links: { self: { href: `${COLLECTION_URL}/inv-1` } },
              },
              {
                id: "inv-2",
                number: "INV-002",
                _links: { self: { href: `${COLLECTION_URL}/inv-2` } },
              },
            ],
          },
          page: { size: 20, total_items_exact: 42 },
        }),
      ),
    );

    const { result } = renderHook(() => useEntityList("invoice", {}), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.items).toHaveLength(2);
    // Regression: previously slice.page (always undefined) was accessed instead of slice.data.page
    expect(result.current.data!.totalItems).toBe(42);
    // id comes from the top-level JSON id field, not URL parsing
    expect(result.current.data!.items[0].id).toBe("inv-1");
    expect(result.current.data!.items[1].id).toBe("inv-2");
  });

  it("returns totalItems from total_items_estimate when exact is absent", async () => {
    mockProfile();
    server.use(
      http.get(COLLECTION_URL, () =>
        HttpResponse.json({
          _links: { self: { href: COLLECTION_URL } },
          _embedded: { item: [] },
          page: { size: 20, total_items_estimate: 100 },
        }),
      ),
    );

    const { result } = renderHook(() => useEntityList("invoice", {}), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.totalItems).toBe(100);
  });

  it("reports hasNext / hasPrevious from HAL pagination links", async () => {
    mockProfile();
    server.use(
      http.get(COLLECTION_URL, () =>
        HttpResponse.json({
          _links: {
            self: { href: COLLECTION_URL },
            next: { href: `${COLLECTION_URL}?_cursor=abc` },
          },
          _embedded: { item: [] },
          page: { size: 20, total_items_exact: 50 },
        }),
      ),
    );

    const { result } = renderHook(() => useEntityList("invoice", {}), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.hasNext).toBe(true);
    expect(result.current.data!.hasPrevious).toBe(false);
    expect(result.current.data!.nextHref).toBe(`${COLLECTION_URL}?_cursor=abc`);
  });

  it("surfaces an error when the collection endpoint returns 500", async () => {
    mockProfile();
    server.use(
      http.get(COLLECTION_URL, () =>
        HttpResponse.json(
          { status: 500, title: "Internal Server Error" },
          { status: 500, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const { result } = renderHook(() => useEntityList("invoice", {}), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});
