import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";
import { SEARCH_BAR_PROFILE_ROOT_URL } from "@contentgrid/navigator-data/test-fixtures/msw/search-bar-fixtures";

const tokenSupplier: AuthenticationTokenSupplier = async () => ({
  token: "test-token",
  expiresAt: null,
});

/** Query client + navigator-data provider wired to the `search-bar` MSW fixture's profile root. */
export function makeSearchBarWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const apiFetch = createApiClient(tokenSupplier);
  const contentFetch = createContentClient(tokenSupplier);
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={apiFetch}
          contentFetch={contentFetch}
          profileUrl={SEARCH_BAR_PROFILE_ROOT_URL}
        >
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  };
}
