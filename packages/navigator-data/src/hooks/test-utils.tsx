import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type AuthenticationTokenSupplier, type TypedFetch, createApiClient } from "../api/client";
import { NavigatorDataProvider } from "./context";

export const BASE = "https://api.example.com";
export const PROFILE_URL = `${BASE}/profile`;

export const noopSupplier: AuthenticationTokenSupplier = async () => ({
  token: "test-token",
  expiresAt: null,
});

export function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/**
 * Build a React wrapper for renderHook tests.
 *
 * @param queryClient - TanStack QueryClient to use; defaults to a fresh one.
 * @param apiFetch    - Optional TypedFetch to inject (e.g. a spy for header assertions).
 *                      Defaults to a real client using noopSupplier so MSW intercepts requests.
 */
export function makeWrapper(
  queryClient = makeQueryClient(),
  apiFetch: TypedFetch = createApiClient(noopSupplier),
) {
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
