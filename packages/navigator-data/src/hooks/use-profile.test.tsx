import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import { type AuthenticationTokenSupplier, createApiClient } from "../api/client";
import { NavigatorDataProvider, useNavigatorData } from "./context";
import { useProfile } from "./use-profile";

const PROFILE_URL = "https://api.example.com/profile";

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
  it("returns entity list parsed from the profile response", async () => {
    server.use(
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
      collectionHref: "https://api.example.com/invoices",
    });
  });

  it("surfaces ProblemDetailError when the profile endpoint returns an error", async () => {
    server.use(
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

  it("uses href-derived name when link.name is absent", async () => {
    server.use(
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
    // Name should be derived from the last segment of the href
    expect(result.current.data![0].name).toBe("orders");
    expect(result.current.data![0].collectionHref).toBe("https://api.example.com/orders");
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
