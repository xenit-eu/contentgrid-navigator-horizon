/**
 * Shared test harness for entity-browser view tests.
 *
 * Renders a view inside the full provider stack (TanStack Query +
 * NavigatorDataProvider + a memory-history TanStack Router) against the
 * shared MSW server from packages/features/test-setup.ts.
 *
 * Excluded from Sonar analysis via the `test-utils` exclusion pattern
 * (test infrastructure, see sonar-project.properties).
 */
import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  createApiClient,
} from "@contentgrid/navigator-data";
import {
  demoInvoiceProfileBody,
  demoInvoiceProfileTemplates,
  demoSupplierProfileBody,
  demoSupplierProfileTemplates,
} from "@contentgrid/navigator-data/test-fixtures/msw/demo-fixtures";
import { server } from "../../test-setup";

export const API_URL = "https://api.example.com";
export const PROFILE_URL = `${API_URL}/profile`;

const tokenSupplier: AuthenticationTokenSupplier = async () => ({
  token: "test-token",
  expiresAt: null,
});

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Rewrites every relative `"href": "/..."` inside a HAL body to an absolute
 * URL under API_URL. Node's fetch cannot resolve relative URLs, so test
 * fixtures must serve absolute links for any href the hooks will follow.
 */
export function withAbsoluteHrefs<T>(body: T): T {
  const json = JSON.stringify(body);
  return JSON.parse(json.replaceAll('"href":"/', `"href":"${API_URL}/`)) as T;
}

/** Demo invoice item bodies with absolute HAL links. */
export function absoluteInvoiceItem(item: Record<string, unknown>): Record<string, unknown> {
  return withAbsoluteHrefs(item);
}

export interface HarnessHandlerOptions {
  /** Override the invoice profile templates (e.g. {} to deny create). */
  invoiceProfileTemplates?: Record<string, unknown>;
}

/**
 * Registers the default happy-path handlers: profile root (invoice +
 * supplier), both entity profiles, and both collections.
 * Item / relation endpoints are registered per-test.
 */
export function useDefaultHandlers(
  invoiceItems: Record<string, unknown>[],
  options: HarnessHandlerOptions = {},
) {
  server.use(
    profileRootHandler(),
    http.get(`${API_URL}/profile/invoices`, () =>
      HttpResponse.json({
        ...withAbsoluteHrefs(demoInvoiceProfileBody),
        _templates: options.invoiceProfileTemplates ?? demoInvoiceProfileTemplates,
      }),
    ),
    http.get(`${API_URL}/profile/suppliers`, () =>
      HttpResponse.json({
        ...withAbsoluteHrefs(demoSupplierProfileBody),
        _templates: demoSupplierProfileTemplates,
      }),
    ),
    collectionHandler("invoices", invoiceItems),
  );
}

export function profileRootHandler() {
  return http.get(PROFILE_URL, () =>
    HttpResponse.json({
      _links: {
        self: { href: PROFILE_URL },
        curies: [
          {
            name: "cg",
            href: "https://contentgrid.cloud/rels/contentgrid/{rel}",
            templated: true,
          },
        ],
        "cg:entity": [
          { href: `${API_URL}/profile/invoices`, name: "invoice", title: "Invoice" },
          { href: `${API_URL}/profile/suppliers`, name: "supplier", title: "Supplier" },
        ],
      },
    }),
  );
}

export function collectionHandler(
  plural: string,
  items: Record<string, unknown>[],
  page?: Record<string, unknown>,
) {
  return http.get(`${API_URL}/${plural}`, () =>
    HttpResponse.json({
      _links: { self: { href: `${API_URL}/${plural}` } },
      _embedded: { item: items.map((i) => withAbsoluteHrefs(i)) },
      page: page ?? { size: 20, total_items_exact: items.length },
    }),
  );
}

export function itemHandler(plural: string, id: string, body: Record<string, unknown>) {
  return http.get(`${API_URL}/${plural}/${id}`, () =>
    HttpResponse.json(withAbsoluteHrefs(body), {
      headers: { ETag: `"etag-${id}-v1"` },
    }),
  );
}

export function problemHandler(url: string, status: number, extra?: Record<string, unknown>) {
  return http.get(url, () =>
    HttpResponse.json(
      { type: "https://contentgrid.cloud/problems/test", status, ...extra },
      { status, headers: { "Content-Type": "application/problem+json" } },
    ),
  );
}

/** A handler that never resolves — keeps the matching query pending forever. */
export function pendingHandler(url: string) {
  return http.get(url, () => new Promise<never>(() => {}));
}

// ---------------------------------------------------------------------------
// Render harness
// ---------------------------------------------------------------------------

export interface TestRoutes {
  home?: () => ReactNode;
  collection?: (params: { collection: string; cursor?: string; sort?: string }) => ReactNode;
  item?: (params: { collection: string; id: string }) => ReactNode;
}

/**
 * Renders the given route components inside the full provider + router stack
 * with a memory history starting at `initialPath`. Returns the router for
 * asserting on navigation state.
 */
export function renderEntityBrowser(initialPath: string, routes: TestRoutes) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <>{routes.home?.()}</>,
  });

  const collectionRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/$collection",
    validateSearch: (search: Record<string, unknown>) => ({
      cursor: typeof search.cursor === "string" ? search.cursor : undefined,
      sort: typeof search.sort === "string" ? search.sort : undefined,
    }),
    component: function CollectionComponent() {
      const params = collectionRoute.useParams();
      const search = collectionRoute.useSearch();
      return <>{routes.collection?.({ ...params, ...search })}</>;
    },
  });

  const itemRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/$collection/$id",
    component: function ItemComponent() {
      const params = itemRoute.useParams();
      return <>{routes.item?.(params)}</>;
    },
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, collectionRoute, itemRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const apiFetch = createApiClient(tokenSupplier);

  const result = render(
    <QueryClientProvider client={queryClient}>
      <NavigatorDataProvider apiFetch={apiFetch} profileUrl={PROFILE_URL}>
        {/* RouterProvider's generic registry differs from the app's — cast is test-only */}
        <RouterProvider router={router as never} />
      </NavigatorDataProvider>
    </QueryClientProvider>,
  );

  return { ...result, router, queryClient };
}
