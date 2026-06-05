import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "../../test-setup";
import { type AuthenticationTokenSupplier, createApiClient } from "../api/client";
import type { EntityInfo } from "../types/entity";
import { NavigatorDataProvider } from "./context";
import { queryKeys } from "./query-keys";
import { useDeleteEntity } from "./use-delete-entity";

const BASE = "https://api.example.com";
const PROFILE_URL = `${BASE}/profile`;
const COLLECTION_URL = `${BASE}/invoices`;
const ITEM_URL = `${COLLECTION_URL}/inv-1`;

const PROFILE_DATA: EntityInfo[] = [
  {
    name: "invoice",
    title: "Invoice",
    href: `${BASE}/profile/invoices`,
    collectionHref: COLLECTION_URL,
  },
];

const noopSupplier: AuthenticationTokenSupplier = async () => ({
  token: "test-token",
  expiresAt: null,
});

function makeWrapper(queryClient: QueryClient) {
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

describe("useDeleteEntity", () => {
  it("sends DELETE to collectionHref/entityId even when entity-detail cache is cold", async () => {
    // Regression: previously threw 'Entity not found in cache' when detail was never loaded.
    // The hook now derives the URL from the profile cache (staleTime: Infinity).
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    // Pre-seed the profile so the mutation can resolve collectionHref
    queryClient.setQueryData(queryKeys.profile(), PROFILE_DATA);

    let deletedUrl: string | undefined;
    server.use(
      http.delete(ITEM_URL, ({ request }) => {
        deletedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useDeleteEntity(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ entityName: "invoice", entityId: "inv-1" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deletedUrl).toBe(ITEM_URL);
  });

  it("invalidates list and count queries on success", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(queryKeys.profile(), PROFILE_DATA);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    server.use(http.delete(ITEM_URL, () => new HttpResponse(null, { status: 204 })));

    const { result } = renderHook(() => useDeleteEntity(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ entityName: "invoice", entityId: "inv-1" });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(["entity-list", "invoice", {}]);
    expect(invalidatedKeys).toContainEqual(["entity-count", "invoice"]);
  });

  it("throws when the entity name is unknown (not in profile)", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(queryKeys.profile(), PROFILE_DATA);

    const { result } = renderHook(() => useDeleteEntity(), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ entityName: "unknown-entity", entityId: "x-1" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/Unknown entity/);
  });
});
