import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";
import { SEARCH_BAR_PROFILE_ROOT_URL } from "@contentgrid/navigator-data/test-fixtures/msw/search-bar-fixtures";
import {
  UserPreferencesProvider,
  type UserPreferencesStoreApi,
  createMemoryStorage,
  createUserPreferencesStore,
} from "../user-preferences";

const tokenSupplier: AuthenticationTokenSupplier = async () => ({
  token: "test-token",
  expiresAt: null,
});

/**
 * Query client + preferences store + navigator-data provider wired to the `search-bar` MSW
 * fixture's profile root. Pass `store` to read or seed preferences from the test.
 */
export function makeSearchBarWrapper(
  store: UserPreferencesStoreApi = createUserPreferencesStore({ storage: createMemoryStorage() }),
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const apiFetch = createApiClient(tokenSupplier);
  const contentFetch = createContentClient(tokenSupplier);
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <UserPreferencesProvider store={store}>
          <NavigatorDataProvider
            apiFetch={apiFetch}
            contentFetch={contentFetch}
            profileUrl={SEARCH_BAR_PROFILE_ROOT_URL}
          >
            {children}
          </NavigatorDataProvider>
        </UserPreferencesProvider>
      </QueryClientProvider>
    );
  };
}
