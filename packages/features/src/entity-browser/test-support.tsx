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
  createContentClient,
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
// Shared profile-response building blocks
//
// Every entity-profile handler below returns the same HAL envelope, differing
// only in URLs, attributes and templates. These two builders hold the parts
// that are byte-identical across all of them so each handler states just what
// makes it distinct.
// ----------------------------------------------------------------

/** The `_links` block every entity-profile response carries. */
function profileLinks(profileUrl: string, collectionUrl: string) {
  return {
    self: { href: profileUrl },
    describes: [
      { href: collectionUrl, name: "collection" },
      { href: `${collectionUrl}/{id}`, name: "item", templated: true },
    ],
    curies: [
      {
        name: "blueprint",
        href: "https://contentgrid.cloud/rels/blueprint/{rel}",
        templated: true,
      },
    ],
  };
}

/** One `blueprint:attribute` embedded entry, with the empty-embeds boilerplate filled in. */
function profileAttribute(opts: {
  name: string;
  title: string;
  type?: string;
  readOnly?: boolean;
  searchParams?: { name: string; title: string; type: string }[];
}) {
  return {
    name: opts.name,
    title: opts.title,
    type: opts.type ?? "string",
    description: null,
    readOnly: opts.readOnly ?? false,
    _embedded: {
      "blueprint:constraint": [],
      "blueprint:search-param": opts.searchParams ?? [],
      "blueprint:attribute": [],
    },
    _links: {},
  };
}

// ----------------------------------------------------------------
// Router + provider factories
// ----------------------------------------------------------------

function createTestRouter(initialEntry = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const apiFetch = createApiClient(noopSupplier);
  const contentFetch = createContentClient(noopSupplier);

  function Providers({ children }: Readonly<{ children: ReactNode }>) {
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
      _links: profileLinks(`${PROFILE_URL}/invoices`, `${API_URL}/invoices`),
      _embedded: {
        "blueprint:attribute": [
          profileAttribute({ name: "id", title: "ID", readOnly: true }),
          profileAttribute({ name: "number", title: "Invoice Number" }),
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
      _links: profileLinks(`${PROFILE_URL}/invoices`, `${API_URL}/invoices`),
      _embedded: {
        "blueprint:attribute": [],
        "blueprint:relation": [],
      },
      _templates: {
        // no create-form
        search: {
          method: "GET",
          target: `${API_URL}/invoices`,
          properties: [],
        },
      },
    }),
  );
}

export function customerProfileHandler() {
  return http.get(`${PROFILE_URL}/customers`, () =>
    HttpResponse.json({
      name: "customer",
      title: "Customer",
      _links: profileLinks(`${PROFILE_URL}/customers`, `${API_URL}/customers`),
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

// ----------------------------------------------------------------
// Relation fixtures — invoice -> supplier (to-one), invoice -> lineItems (to-many)
// ----------------------------------------------------------------

const SUPPLIER_PROFILE_URL = `${PROFILE_URL}/suppliers`;
const LINE_ITEM_PROFILE_URL = `${PROFILE_URL}/line-items`;
export const SUPPLIERS_COLLECTION_URL = `${API_URL}/suppliers`;
export const LINE_ITEMS_COLLECTION_URL = `${API_URL}/line-items`;

const CG_RELATION_REL = "https://contentgrid.cloud/rels/contentgrid/relation";
const BLUEPRINT_RELATION_REL = "https://contentgrid.cloud/rels/blueprint/relation";
const BLUEPRINT_TARGET_ENTITY_REL = "https://contentgrid.cloud/rels/blueprint/target-entity";

export function profileRootWithRelationsHandler() {
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
          { href: SUPPLIER_PROFILE_URL, name: "supplier", title: "Supplier" },
          { href: LINE_ITEM_PROFILE_URL, name: "lineItem", title: "Line Item" },
        ],
      },
      _templates: {},
    }),
  );
}

export function invoiceProfileHandlerWithRelations() {
  return http.get(`${PROFILE_URL}/invoices`, () =>
    HttpResponse.json({
      name: "invoice",
      title: "Invoice",
      description: null,
      _links: profileLinks(`${PROFILE_URL}/invoices`, `${API_URL}/invoices`),
      _embedded: {
        "blueprint:attribute": [profileAttribute({ name: "number", title: "Invoice Number" })],
        [BLUEPRINT_RELATION_REL]: [
          {
            name: "supplier",
            title: "Supplier",
            description: null,
            required: false,
            many_source_per_target: false,
            many_target_per_source: false,
            _links: {
              self: { href: `${PROFILE_URL}/invoices/relations/supplier` },
              [BLUEPRINT_TARGET_ENTITY_REL]: {
                href: SUPPLIER_PROFILE_URL,
                name: "supplier",
                title: "Supplier",
              },
            },
          },
          {
            name: "lineItems",
            title: "Line Items",
            description: null,
            required: false,
            many_source_per_target: false,
            many_target_per_source: true,
            _links: {
              self: { href: `${PROFILE_URL}/invoices/relations/lineItems` },
              [BLUEPRINT_TARGET_ENTITY_REL]: {
                href: LINE_ITEM_PROFILE_URL,
                name: "lineItem",
                title: "Line Item",
              },
            },
          },
        ],
      },
      _templates: {
        search: { method: "GET", target: `${API_URL}/invoices`, properties: [] },
      },
    }),
  );
}

export function supplierProfileHandler() {
  return http.get(SUPPLIER_PROFILE_URL, () =>
    HttpResponse.json({
      name: "supplier",
      title: "Supplier",
      description: null,
      _links: profileLinks(SUPPLIER_PROFILE_URL, SUPPLIERS_COLLECTION_URL),
      _embedded: {
        "blueprint:attribute": [
          profileAttribute({
            name: "name",
            title: "Name",
            searchParams: [{ name: "name~prefix", title: "Name prefix", type: "prefix-match" }],
          }),
        ],
        "blueprint:relation": [],
      },
      _templates: {
        search: {
          method: "GET",
          target: SUPPLIERS_COLLECTION_URL,
          properties: [{ name: "name~prefix", prompt: "Name prefix", type: "text" }],
        },
      },
    }),
  );
}

export function lineItemProfileHandler() {
  return http.get(LINE_ITEM_PROFILE_URL, () =>
    HttpResponse.json({
      name: "lineItem",
      title: "Line Item",
      description: null,
      _links: profileLinks(LINE_ITEM_PROFILE_URL, LINE_ITEMS_COLLECTION_URL),
      _embedded: {
        "blueprint:attribute": [
          profileAttribute({
            name: "description",
            title: "Description",
            searchParams: [
              { name: "description~prefix", title: "Description prefix", type: "prefix-match" },
            ],
          }),
        ],
        "blueprint:relation": [],
      },
      _templates: {
        search: {
          method: "GET",
          target: LINE_ITEMS_COLLECTION_URL,
          properties: [{ name: "description~prefix", prompt: "Description prefix", type: "text" }],
        },
      },
    }),
  );
}

/** Invoice item exposing only the to-one `supplier` relation. */
export function makeInvoiceItemWithSupplier(itemId: string) {
  const itemUrl = `${API_URL}/invoices/${itemId}`;
  return {
    id: itemId,
    number: "INV-2024-001",
    _links: {
      self: { href: itemUrl },
      [CG_RELATION_REL]: [{ href: `${itemUrl}/supplier`, name: "supplier" }],
    },
    _templates: {
      "set-supplier": {
        method: "PUT",
        target: `${itemUrl}/supplier`,
        contentType: "text/uri-list",
        properties: [{ name: "supplier", type: "url" }],
      },
      "clear-supplier": {
        method: "DELETE",
        target: `${itemUrl}/supplier`,
        properties: [],
      },
    },
  };
}

/** Invoice item exposing only the to-many `lineItems` relation. */
export function makeInvoiceItemWithLineItems(itemId: string) {
  const itemUrl = `${API_URL}/invoices/${itemId}`;
  return {
    id: itemId,
    number: "INV-2024-002",
    _links: {
      self: { href: itemUrl },
      [CG_RELATION_REL]: [{ href: `${itemUrl}/lineItems`, name: "lineItems" }],
    },
    _templates: {
      "add-lineItems": {
        method: "POST",
        target: `${itemUrl}/lineItems`,
        contentType: "text/uri-list",
        properties: [{ name: "lineItem", type: "url", options: {} }],
      },
      "clear-lineItems": {
        method: "DELETE",
        target: `${itemUrl}/lineItems`,
        properties: [],
      },
    },
  };
}

export function lineItem(id: string, description: string, withDeleteTemplate = false) {
  const itemUrl = `${LINE_ITEMS_COLLECTION_URL}/${id}`;
  return {
    id,
    description,
    _links: { self: { href: itemUrl } },
    ...(withDeleteTemplate
      ? { _templates: { delete: { method: "DELETE", target: itemUrl, properties: [] } } }
      : {}),
  };
}

export function notFoundProblem() {
  return HttpResponse.json(
    {
      status: 404,
      title: "Not Found",
      type: "https://contentgrid.cloud/problems/not-found/entity-item",
    },
    { status: 404, headers: { "Content-Type": "application/problem+json" } },
  );
}
