import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";

/** Test-only: base URL the relation demo MSW handlers are registered on. */
export const TEST_API_URL = "https://api.example.com";

const noopSupplier: AuthenticationTokenSupplier = async () => null;

/** Test-only: a fresh QueryClient (no retries) + real NavigatorDataProvider on `TEST_API_URL`. */
export function makeNavigatorDataWrapper(
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={createApiClient(noopSupplier)}
          contentFetch={createContentClient(noopSupplier)}
          profileUrl={`${TEST_API_URL}/profile`}
        >
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  };
}
