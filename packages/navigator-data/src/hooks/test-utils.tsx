import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HttpResponse, type RequestHandler, http } from "msw";
import { type AuthenticationTokenSupplier, type TypedFetch, createApiClient } from "../api/client";
import type { EntityInfo } from "../types/entity";
import { NavigatorDataProvider } from "./context";
import { queryKeys } from "./query-keys";

export const BASE = "https://api.example.com";
export const PROFILE_URL = `${BASE}/profile`;
export const ROOT_URL = `${BASE}/`;

export const noopSupplier: AuthenticationTokenSupplier = async () => ({
  token: "test-token",
  expiresAt: null,
});

export const INVOICE_ENTITY: EntityInfo = {
  name: "invoice",
  title: "Invoice",
  href: `${BASE}/profile/invoices`,
  collectionHref: `${BASE}/invoices`,
};

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

/** Pre-seed profile data so mutations can resolve collectionHref without an HTTP call. */
export function seedProfile(queryClient: QueryClient, entities = [INVOICE_ENTITY]) {
  queryClient.setQueryData(queryKeys.profile(), entities);
}

/**
 * Returns the MSW handler for the profile root (GET /profile).
 * Registers the root resource handler (GET /) alongside so that fetchProfile
 * can discover collection hrefs from the entities root.
 */
export function mockProfileResponse() {
  return {
    _links: {
      self: { href: PROFILE_URL },
      "cg:entity": [{ href: INVOICE_ENTITY.href, name: "invoice", title: "Invoice" }],
      curies: [
        { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
      ],
    },
    _templates: {},
  };
}

/**
 * Returns the MSW handler body for the root resource (GET /).
 * cg:entity links on the root resource point directly at entity collections.
 */
export function mockRootResponse() {
  return {
    _links: {
      self: { href: ROOT_URL },
      "cg:entity": [{ href: INVOICE_ENTITY.collectionHref, name: "invoice", title: "Invoice" }],
      curies: [
        { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
      ],
    },
  };
}

/**
 * Returns the MSW handler body for the invoice entity profile
 * (GET /profile/invoices). Carries the _links.describes pair the platform
 * exposes on every entity profile: the collection link (name: "collection")
 * and the templated item link (name: "item") that useEntitySchema surfaces
 * as itemTemplateHref.
 */
export function mockEntityProfileResponse() {
  return {
    name: "invoice",
    title: "Invoice",
    _links: {
      self: { href: INVOICE_ENTITY.href },
      describes: [
        { href: INVOICE_ENTITY.collectionHref, name: "collection" },
        { href: `${INVOICE_ENTITY.collectionHref}/{id}`, name: "item", templated: true },
      ],
    },
    _templates: {},
  };
}

/**
 * Registers MSW handlers for the root resource, the profile root and the
 * invoice entity profile so that useProfile resolves collectionHref from real
 * cg:entity links and useEntitySchema resolves itemTemplateHref from the
 * describes item link. Call this inside a describe block or test to set up
 * the contract fixtures.
 *
 * @param server - The MSW server instance from test-setup (return value of setupServer()).
 */
export function registerProfileHandlers(server: { use: (...handlers: RequestHandler[]) => void }) {
  server.use(
    http.get(ROOT_URL, () => HttpResponse.json(mockRootResponse())),
    http.get(PROFILE_URL, () => HttpResponse.json(mockProfileResponse())),
    http.get(INVOICE_ENTITY.href, () => HttpResponse.json(mockEntityProfileResponse())),
  );
}
