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
import { render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  createApiClient,
} from "@contentgrid/navigator-data";
import { sampleInvoiceItems } from "@contentgrid/navigator-data/test-fixtures/hal/fixtures";
import { createListHandler } from "@contentgrid/navigator-data/test-fixtures/msw/handlers";
import { server } from "../../test-setup";
import { EntityListLayout, EntityOverviewPage } from "./index";

const API_URL = "https://api.example.com";
const PROFILE_URL = `${API_URL}/profile`;

const noopSupplier: AuthenticationTokenSupplier = async () => null;

function createTestRouter() {
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

  return createRouter({
    routeTree: rootRoute.addChildren([appRoute.addChildren([indexRoute])]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
}

function renderEntityList() {
  const router = createTestRouter();
  return render(<RouterProvider router={router} />);
}

function profileRootHandler() {
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
    }),
  );
}

// Per-entity profile handler for /profile/invoices.
// The rewritten hook fetches each entity profile individually via
// GET /profile/{plural}, so tests that exercise the overview or detail
// views must stub this endpoint in addition to the profile root.
// Notes:
// - The collection describes link has no title so that ProfileEntity.pluralName
//   falls back to the cg:entity link title ("Invoice").
// - The search template is required: useEntityItemCollection with only
//   { profileEntity } builds its request from the search template. Without it
//   the query is disabled and the EntityCard count never resolves.
function invoiceProfileHandler() {
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
      },
    }),
  );
}

describe("EntityList", () => {
  // EntityOverviewPage renders a grid of EntityCards (one per entity type).
  // Each card shows the entity's plural name and its collection item count.
  it("renders entities discovered from the profile as entity cards", async () => {
    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      createListHandler({
        url: `${API_URL}/invoices`,
        items: sampleInvoiceItems,
        page: { size: 20, total_items_exact: sampleInvoiceItems.length },
      }),
    );

    renderEntityList();

    // Entity name is shown in the EntityCard title and in the sidebar link
    expect(await screen.findByText("Invoice")).toBeInTheDocument();
    // Overview header shows the count of entity types
    expect(await screen.findByText("1 entity type available")).toBeInTheDocument();
    // EntityCard shows the collection item count (number) and "items" label separately
    expect(await screen.findByText("3")).toBeInTheDocument();
    expect(screen.getByText("items")).toBeInTheDocument();
  });

  it("shows an empty state when the profile exposes no entities", async () => {
    server.use(
      http.get(PROFILE_URL, () => HttpResponse.json({ _links: { self: { href: PROFILE_URL } } })),
    );

    renderEntityList();

    // Component renders "No entities found" (no trailing period) when the
    // profile root returns no cg:entity links
    expect(await screen.findByText("No entities found")).toBeInTheDocument();
  });

  it("shows a placeholder when a collection request fails", async () => {
    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      http.get(`${API_URL}/invoices`, () => HttpResponse.json(null, { status: 500 })),
    );

    renderEntityList();

    // "Invoice" appears both in the sidebar link and in the EntityCard title
    expect(await screen.findAllByText("Invoice")).not.toHaveLength(0);
    // EntityCard shows "—" as the count placeholder when the collection request fails
    expect(await screen.findByText("—")).toBeInTheDocument();
  });
});
