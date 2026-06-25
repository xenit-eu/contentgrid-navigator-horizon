import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HalObject, type Link } from "@contentgrid/hal";
import ProfileEntity from "../accessors/entity-profile";
import {
  type AuthenticationTokenSupplier,
  type TypedFetch,
  createApiClient,
  createContentClient,
} from "../api/client";
import type { ProfileEntityShape } from "../shapes";
import { NavigatorDataProvider } from "./context";

export const BASE = "https://api.example.com";
export const PROFILE_URL = `${BASE}/profile`;

export const noopSupplier: AuthenticationTokenSupplier = async () => ({
  token: "test-token",
  expiresAt: null,
});

/**
 * Build a ProfileEntity from raw HAL JSON. Used across hook tests that need
 * a real ProfileEntity instance rather than a mock.
 */
export function makeProfileEntity(
  json: Record<string, unknown>,
  collectionName: string,
  entityName: string,
): ProfileEntity {
  const hal = new HalObject(json as unknown as ProfileEntityShape);
  const link = { href: `${BASE}/profile/${collectionName}`, name: entityName } as unknown as Link;
  return new ProfileEntity(link, hal as HalObject<ProfileEntityShape>);
}

export function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/**
 * Build a React wrapper for renderHook tests.
 *
 * @param queryClient   - TanStack QueryClient to use; defaults to a fresh one.
 * @param apiFetch      - Optional TypedFetch to inject (e.g. a spy for header assertions).
 *                        Defaults to a real client using noopSupplier so MSW intercepts requests.
 * @param contentFetch  - Optional TypedFetch for binary content (cg:content) requests.
 *                        Defaults to a real content client using noopSupplier.
 */
export function makeWrapper(
  queryClient = makeQueryClient(),
  apiFetch: TypedFetch = createApiClient(noopSupplier),
  contentFetch: TypedFetch = createContentClient(noopSupplier),
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={apiFetch}
          contentFetch={contentFetch}
          profileUrl={PROFILE_URL}
        >
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  };
}
