import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import { type AuthenticationTokenSupplier, createApiClient } from "../api/client";
import { NavigatorDataProvider, useNavigatorData } from "./context";
import { useProfile } from "./use-profile";

const BASE = "https://api.example.com";
const PROFILE_URL = `${BASE}/profile`;
const ROOT_URL = `${BASE}/`;

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

describe("useProfile", () => {
  it("returns entity list with collectionHref from root resource cg:entity links", async () => {
    // Root resource (GET /) — cg:entity links point at collections
    server.use(
      http.get(ROOT_URL, () =>
        HttpResponse.json({
          _links: {
            self: { href: ROOT_URL },
            "cg:entity": [
              { href: "https://api.example.com/invoices", name: "invoice", title: "Invoice" },
              { href: "https://api.example.com/customers", name: "customer", title: "Customer" },
            ],
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
            "cg:entity": [
              {
                href: "https://api.example.com/profile/invoices",
                name: "invoice",
                title: "Invoice",
              },
              {
                href: "https://api.example.com/profile/customers",
                name: "customer",
                title: "Customer",
              },
            ],
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

    const { result } = renderHook(() => useProfile(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0]).toMatchObject({
      name: "invoice",
      title: "Invoice",
      href: "https://api.example.com/profile/invoices",
      // collectionHref must come from the root resource link, not a string replacement
      collectionHref: "https://api.example.com/invoices",
      // itemTemplateHref must be the RFC 6570 template for a single item
      itemTemplateHref: "https://api.example.com/invoices/{id}",
    });
  });

  it("surfaces ProblemDetailError when the profile endpoint returns an error", async () => {
    server.use(
      http.get(ROOT_URL, () => HttpResponse.json({ _links: { self: { href: ROOT_URL } } })),
      http.get(PROFILE_URL, () =>
        HttpResponse.json(
          { status: 401, title: "Unauthorized" },
          { status: 401, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const { result } = renderHook(() => useProfile(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });

  it("uses link name when present; falls back to href path segment when absent", async () => {
    // Root resource provides a matching link by name for one entity,
    // but no matching link for the nameless one (edge case).
    server.use(
      http.get(ROOT_URL, () =>
        HttpResponse.json({
          _links: {
            self: { href: ROOT_URL },
            // No cg:entity link for "orders" — triggers collectionHref fallback
            "cg:entity": [],
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
            // cg:entity link with NO name field — name should be derived from href
            "cg:entity": [{ href: "https://api.example.com/profile/orders", title: "Order" }],
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

    const { result } = renderHook(() => useProfile(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data).toHaveLength(1);
    // Name should be derived from the last segment of the profile href
    expect(result.current.data![0].name).toBe("orders");
    // collectionHref falls back to string replacement when root has no matching link
    expect(result.current.data![0].collectionHref).toBe("https://api.example.com/orders");
    expect(result.current.data![0].itemTemplateHref).toBe("https://api.example.com/orders/{id}");
  });

  it("ignores root cg:entity links without a name and titleCases the entity name when title is absent", async () => {
    server.use(
      http.get(ROOT_URL, () =>
        HttpResponse.json({
          _links: {
            self: { href: ROOT_URL },
            "cg:entity": [
              // Nameless root link — must be skipped when building the collection map
              { href: "https://api.example.com/mystery" },
              // Named root link — must be matched by name
              { href: "https://api.example.com/invoices", name: "invoice" },
            ],
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
            // Profile link with name but NO title — title falls back to titleCase(name)
            "cg:entity": [{ href: "https://api.example.com/profile/invoices", name: "invoice" }],
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

    const { result } = renderHook(() => useProfile(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].name).toBe("invoice");
    // Title derived from name (no title on the link)
    expect(result.current.data![0].title).toBe("Invoice");
    // The named root link wins; the nameless one is ignored
    expect(result.current.data![0].collectionHref).toBe("https://api.example.com/invoices");
  });

  it("surfaces an error when the root resource request fails", async () => {
    server.use(
      http.get(ROOT_URL, () =>
        HttpResponse.json(
          { status: 500, title: "Internal Server Error" },
          { status: 500, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
      http.get(PROFILE_URL, () =>
        HttpResponse.json({
          _links: { self: { href: PROFILE_URL }, "cg:entity": [] },
          _templates: {},
        }),
      ),
    );

    const { result } = renderHook(() => useProfile(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});

describe("useNavigatorData", () => {
  it("throws when used outside NavigatorDataProvider", () => {
    // Wrap in a QueryClient provider only — no NavigatorDataProvider
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    expect(() => renderHook(() => useNavigatorData(), { wrapper })).toThrow(
      "useNavigatorData must be used within <NavigatorDataProvider>",
    );
  });
});
