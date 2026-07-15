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
  entitySearchStateValidator,
} from "@contentgrid/navigator-data";
import { createListHandler } from "@contentgrid/navigator-data/test-fixtures/msw/handlers";
import { EntityListLayout } from "./app-layout";
import { EntityDetailPage } from "./entity-detail";
import { EntityItemDetailPage } from "./entity-item-detail";
import { EntityOverviewPage } from "./entity-overview";
import { EntityProfileGate } from "./entity-profile-gate";

export const API_URL = "https://api.example.com";
export const PROFILE_URL = `${API_URL}/profile`;

const noopSupplier: AuthenticationTokenSupplier = async () => null;

// ----------------------------------------------------------------
// Router + provider factories
// ----------------------------------------------------------------

export function createTestRouter(initialEntry = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const apiFetch = createApiClient(noopSupplier);

  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider apiFetch={apiFetch} profileUrl={PROFILE_URL}>
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  }

  const rootRoute = createRootRoute({
    component: () => (
      <Providers>
        <Outlet />
      </Providers>
    ),
  });
  // EntityListLayout is a pathless layout route that wraps all content routes
  const appRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: "_app",
    component: EntityListLayout,
  });
  const indexRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/",
    component: EntityOverviewPage,
  });
  // Entity gate: /$entity — resolves the profile once for both children below,
  // mirroring apps/*/routes/_app/$entity.tsx.
  const entityGateRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/$entity",
    component: EntityProfileGate,
  });
  // Entity detail route: /$entity/ — renders EntityDetailPage
  const entityRoute = createRoute({
    getParentRoute: () => entityGateRoute,
    path: "/",
    component: EntityDetailPage,
    validateSearch: entitySearchStateValidator,
  });
  // Item detail route: /$entity/$itemId — renders EntityItemDetailPage
  const itemRoute = createRoute({
    getParentRoute: () => entityGateRoute,
    path: "/$itemId",
    component: EntityItemDetailPage,
  });

  return createRouter({
    routeTree: rootRoute.addChildren([
      appRoute.addChildren([indexRoute, entityGateRoute.addChildren([entityRoute, itemRoute])]),
    ]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });
}

export function renderEntityList(initialEntry = "/") {
  const router = createTestRouter(initialEntry);
  return render(<RouterProvider router={router} />);
}

// ----------------------------------------------------------------
// MSW handlers
// ----------------------------------------------------------------

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
        "cg:entity": [{ href: `${PROFILE_URL}/invoices`, name: "invoice", title: "Invoice" }],
      },
      _templates: {},
    }),
  );
}

export function profileRootWithTwoEntitiesHandler() {
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
          { href: `${PROFILE_URL}/invoices`, name: "invoice", title: "Invoice" },
          { href: `${PROFILE_URL}/customers`, name: "customer", title: "Customer" },
        ],
      },
      _templates: {},
    }),
  );
}

/**
 * Per-entity profile handler for /profile/invoices.
 * The rewritten hook fetches each entity profile individually via
 * GET /profile/{plural}, so tests that exercise the overview or detail
 * views must stub this endpoint in addition to the profile root.
 * Notes:
 * - The collection describes link has no title so that ProfileEntity.pluralName
 *   falls back to the cg:entity link title ("Invoice").
 * - The search template is required: useEntityItemCollection with only
 *   { profileEntity } builds its request from the search template. Without it
 *   the query is disabled and the EntityCard count never resolves.
 */
export function invoiceProfileHandler(opts: { description?: string } = {}) {
  return http.get(`${PROFILE_URL}/invoices`, () =>
    HttpResponse.json({
      name: "invoice",
      title: "Invoice",
      ...(opts.description ? { description: opts.description } : {}),
      _links: {
        self: { href: `${PROFILE_URL}/invoices` },
        describes: [
          { href: `${API_URL}/invoices`, name: "collection" },
          { href: `${API_URL}/invoices/{id}`, name: "item", templated: true },
        ],
        curies: [
          {
            name: "blueprint",
            href: "https://contentgrid.cloud/rels/blueprint/{rel}",
            templated: true,
          },
        ],
      },
      _embedded: {
        "blueprint:attribute": [
          {
            name: "id",
            title: "ID",
            type: "string",
            description: null,
            readOnly: true,
            _embedded: {
              "blueprint:constraint": [],
              "blueprint:search-param": [],
              "blueprint:attribute": [],
            },
            _links: {},
          },
          {
            name: "number",
            title: "Invoice Number",
            type: "string",
            description: null,
            readOnly: false,
            _embedded: {
              "blueprint:constraint": [],
              "blueprint:search-param": [],
              "blueprint:attribute": [],
            },
            _links: {},
          },
        ],
        "blueprint:relation": [],
      },
      _templates: {
        search: {
          method: "GET",
          target: `${API_URL}/invoices`,
          properties: [],
        },
        "create-form": {
          method: "POST",
          target: `${API_URL}/invoices`,
          properties: [{ name: "number", prompt: "Invoice Number", type: "text" }],
        },
      },
    }),
  );
}

export function invoiceProfileHandlerNoCreate() {
  return http.get(`${PROFILE_URL}/invoices`, () =>
    HttpResponse.json({
      name: "invoice",
      title: "Invoice",
      _links: {
        self: { href: `${PROFILE_URL}/invoices` },
        describes: [
          { href: `${API_URL}/invoices`, name: "collection" },
          { href: `${API_URL}/invoices/{id}`, name: "item", templated: true },
        ],
        curies: [
          {
            name: "blueprint",
            href: "https://contentgrid.cloud/rels/blueprint/{rel}",
            templated: true,
          },
        ],
      },
      _embedded: {
        "blueprint:attribute": [],
        "blueprint:relation": [],
      },
      _templates: {
        search: {
          method: "GET",
          target: `${API_URL}/invoices`,
          properties: [],
        },
        // no create-form
      },
    }),
  );
}

export function customerProfileHandler() {
  return http.get(`${PROFILE_URL}/customers`, () =>
    HttpResponse.json({
      name: "customer",
      title: "Customer",
      _links: {
        self: { href: `${PROFILE_URL}/customers` },
        describes: [
          { href: `${API_URL}/customers`, name: "collection" },
          { href: `${API_URL}/customers/{id}`, name: "item", templated: true },
        ],
        curies: [
          {
            name: "blueprint",
            href: "https://contentgrid.cloud/rels/blueprint/{rel}",
            templated: true,
          },
        ],
      },
      _embedded: {
        "blueprint:attribute": [],
        "blueprint:relation": [],
      },
      _templates: {
        search: {
          method: "GET",
          target: `${API_URL}/customers`,
          properties: [],
        },
      },
    }),
  );
}

export const emptyInvoicesList = createListHandler({
  url: `${API_URL}/invoices`,
  items: [],
  page: { size: 0, total_items_exact: 0 },
});

export const sampleItem = {
  id: "inv-001",
  number: "INV-2024-001",
  _links: {
    self: { href: `${API_URL}/invoices/inv-001` },
  },
};
