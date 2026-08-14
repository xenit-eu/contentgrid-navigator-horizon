import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HalObject, type Link } from "@contentgrid/hal";
import entityProfilesDump from "../../test-fixtures/entity-profiles/entity-profiles-dump.json";
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

const DUMP_SOURCE_HOST = "https://api.example.contentgrid.com";

function rewriteDumpHost(value: unknown, targetBase: string): unknown {
  if (typeof value === "string") {
    return value.startsWith(DUMP_SOURCE_HOST)
      ? targetBase + value.slice(DUMP_SOURCE_HOST.length)
      : value;
  }
  if (Array.isArray(value)) return value.map((v) => rewriteDumpHost(v, targetBase));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, rewriteDumpHost(v, targetBase)]),
    );
  }
  return value;
}

/**
 * Load a real, anonymised entity profile from the committed backend dump
 * (`test-fixtures/entity-profiles/entity-profiles-dump.json`), with the dump's own host
 * rewritten to `targetBase` (defaults to `BASE`) so it plugs directly into MSW handlers
 * registered against this file's `BASE`/`PROFILE_URL` constants.
 *
 * Prefer this over hand-built profile JSON for anything exercising search-type resolution or
 * label fallback: hand-built fixtures tend to set `blueprint:search-param: []` with no prompt
 * on every attribute — a combination a real profile never produces — which means the test only
 * ever reaches the suffix-parsing fallback path, never the `blueprint:search-param` path the
 * backend actually exercises. Available entity names: see `profiles` in the dump (`customer`,
 * `order`, `supplier`, `product`, `employee`, `many-relation`, `related-item`, etc.).
 */
export function loadDumpProfile(entityName: string, targetBase: string = BASE): ProfileEntityShape {
  const profiles = (entityProfilesDump as { profiles: Record<string, unknown> }).profiles;
  const profile = profiles[entityName];
  if (!profile) {
    throw new Error(
      `No "${entityName}" profile in entity-profiles-dump.json. Available: ${Object.keys(profiles).join(", ")}`,
    );
  }
  return rewriteDumpHost(profile, targetBase) as unknown as ProfileEntityShape;
}

export const noopSupplier: AuthenticationTokenSupplier = async () => ({
  token: "test-token",
  expiresAt: null,
});

/**
 * Build a ProfileEntity from raw HAL JSON for use in hook tests.
 *
 * `link` is built as a plain object, not a real `Link` instance (that class carries private
 * fields no object literal can satisfy structurally) — `ProfileEntity` only ever reads its
 * `.href`/`.name` getters at runtime, which this plain shape provides, so the cast is safe.
 */
export function makeProfileEntity(
  json: ProfileEntityShape,
  collectionName: string,
  entityName: string,
): ProfileEntity {
  const hal = new HalObject(json);
  const link = { href: `${BASE}/profile/${collectionName}`, name: entityName } as unknown as Link;
  return new ProfileEntity(link, hal);
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
