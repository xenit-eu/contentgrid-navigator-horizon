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
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  createApiClient,
  entitySearchStateValidator,
  createContentClient,
} from "@contentgrid/navigator-data";
import { sampleInvoiceItems } from "@contentgrid/navigator-data/test-fixtures/hal/fixtures";
import { createListHandler } from "@contentgrid/navigator-data/test-fixtures/msw/handlers";
import { server } from "../../test-setup";
import {
  EntityDetailPage,
  EntityItemDetailPage,
  EntityListLayout,
  EntityOverviewPage,
} from "./index";

const API_URL = "https://api.example.com";
const PROFILE_URL = `${API_URL}/profile`;

const noopSupplier: AuthenticationTokenSupplier = async () => null;

// ----------------------------------------------------------------
// Router + provider factories
// ----------------------------------------------------------------

function createTestRouter(initialEntry = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const apiFetch = createApiClient(noopSupplier);
  const contentFetch = createContentClient(noopSupplier);

  function Providers({ children }: { children: ReactNode }) {
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
  // Entity detail route: /$entity — renders EntityDetailPage
  const entityRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/$entity",
    component: EntityDetailPage,
    validateSearch: entitySearchStateValidator,
  });
  // Item detail route: /$entity/$itemId — FLAT sibling of entityRoute so
  // EntityDetailPage doesn't need to render <Outlet>
  const itemRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/$entity/$itemId",
    component: EntityItemDetailPage,
  });

  return createRouter({
    routeTree: rootRoute.addChildren([appRoute.addChildren([indexRoute, entityRoute, itemRoute])]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });
}

function renderEntityList(initialEntry = "/") {
  const router = createTestRouter(initialEntry);
  return render(<RouterProvider router={router} />);
}

// ----------------------------------------------------------------
// MSW handlers
// ----------------------------------------------------------------

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

function profileRootWithTwoEntitiesHandler() {
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
        "blueprint:attribute": [
          {
            name: "id",
            title: "ID",
            type: "string",
            readOnly: true,
            _embedded: { "blueprint:constraint": [], "blueprint:search-param": [] },
            _links: {},
          },
          {
            name: "number",
            title: "Invoice Number",
            type: "string",
            readOnly: false,
            _embedded: { "blueprint:constraint": [], "blueprint:search-param": [] },
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
          properties: [{ name: "number", type: "text", required: true }],
        },
      },
    }),
  );
}

function invoiceProfileHandlerNoCreate() {
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

function customerProfileHandler() {
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

const emptyInvoicesList = createListHandler({
  url: `${API_URL}/invoices`,
  items: [],
  page: { size: 0, total_items_exact: 0 },
});

const sampleItem = {
  id: "inv-001",
  number: "INV-2024-001",
  _links: {
    self: { href: `${API_URL}/invoices/inv-001` },
  },
};

// ----------------------------------------------------------------
// EntityList — overview (index) route
// ----------------------------------------------------------------

describe("EntityList", () => {
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

    expect(await screen.findByText("1 entity type available")).toBeInTheDocument();
    // EntityCard shows the collection item count (number) and "items" label separately
    expect(await screen.findByText("3")).toBeInTheDocument();
    expect(screen.getByText("items")).toBeInTheDocument();
  });

  it("renders multiple entity types in the overview", async () => {
    server.use(
      profileRootWithTwoEntitiesHandler(),
      invoiceProfileHandler(),
      customerProfileHandler(),
      createListHandler({
        url: `${API_URL}/invoices`,
        items: sampleInvoiceItems,
        page: { size: 20, total_items_exact: sampleInvoiceItems.length },
      }),
      createListHandler({
        url: `${API_URL}/customers`,
        items: [],
        page: { size: 0, total_items_exact: 0 },
      }),
    );

    renderEntityList();

    expect(await screen.findByText("2 entity types available")).toBeInTheDocument();
    // Both entity names appear (sidebar + card, so getAllBy* is safe)
    expect(screen.getAllByText("Invoice").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Customer").length).toBeGreaterThan(0);
  });

  it("shows an empty state when the profile exposes no entities", async () => {
    server.use(
      http.get(PROFILE_URL, () => HttpResponse.json({ _links: { self: { href: PROFILE_URL } } })),
    );

    renderEntityList();

    expect(await screen.findByText("No entities found")).toBeInTheDocument();
  });

  it("shows a placeholder when a collection request fails", async () => {
    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      http.get(`${API_URL}/invoices`, () => HttpResponse.json(null, { status: 500 })),
    );

    renderEntityList();

    // EntityCard shows "—" as the count placeholder when the collection request fails
    expect(await screen.findByText("—")).toBeInTheDocument();
  });

  it("shows sidebar with entity section heading", async () => {
    server.use(profileRootHandler(), invoiceProfileHandler(), emptyInvoicesList);

    renderEntityList();

    expect(await screen.findByText("Entities")).toBeInTheDocument();
  });

  it("shows the entity detail page when navigating to an entity route", async () => {
    server.use(profileRootHandler(), invoiceProfileHandler(), emptyInvoicesList);

    renderEntityList("/invoice");

    expect(await screen.findByText("All entities")).toBeInTheDocument();
  });

  it("shows entity detail with items in a table", async () => {
    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      createListHandler({
        url: `${API_URL}/invoices`,
        items: sampleInvoiceItems,
        page: { size: 20, total_items_exact: sampleInvoiceItems.length },
      }),
    );

    renderEntityList("/invoice");

    // Wait for items to load — columns are from userDefinedAttributes (number col)
    // The table rows show the "number" attribute values
    expect(await screen.findByText("INV-2024-001")).toBeInTheDocument();
    expect(await screen.findByText("INV-2024-003")).toBeInTheDocument();
  });

  it("shows the Create button when the profile includes a create-form template", async () => {
    server.use(profileRootHandler(), invoiceProfileHandler(), emptyInvoicesList);

    renderEntityList("/invoice");

    expect(await screen.findByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("does not show Create button when no create-form template", async () => {
    server.use(profileRootHandler(), invoiceProfileHandlerNoCreate(), emptyInvoicesList);

    renderEntityList("/invoice");

    // Wait for the page to settle (breadcrumb appears)
    await screen.findByText("All entities");
    expect(screen.queryByRole("button", { name: "Create" })).not.toBeInTheDocument();
  });

  it("shows error when entity collection fails on detail page", async () => {
    // The collection query has retry:3 with exponential backoff baked in.
    // Use fake timers to skip the retry delays so the error state renders.
    vi.useFakeTimers();

    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      http.get(`${API_URL}/invoices`, () => HttpResponse.json(null, { status: 500 })),
    );

    renderEntityList("/invoice");

    // Advance timers past all three retry delays (default: 1s, 2s, 4s + jitter)
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
  });

  it("does not offer a reset when the collection fails without an active cursor", async () => {
    vi.useFakeTimers();

    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      http.get(`${API_URL}/invoices`, () => HttpResponse.json(null, { status: 500 })),
    );

    renderEntityList("/invoice");

    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /back to first page/i })).not.toBeInTheDocument();
  });

  it("offers a reset to the first page when a stale cursor fails to load", async () => {
    vi.useFakeTimers();

    // A same-origin cursor survives the data layer's origin guard, so the
    // request reaches the server and gets rejected as a stale/invalid cursor.
    const staleCursor = `${API_URL}/invoices?_cursor=stale`;
    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      http.get(`${API_URL}/invoices`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("_cursor");
        if (cursor === "stale") return HttpResponse.json(null, { status: 400 });
        return HttpResponse.json({
          _links: { self: { href: `${API_URL}/invoices` } },
          _embedded: { item: [] },
          page: { size: 0, total_items_exact: 0 },
        });
      }),
    );

    renderEntityList(`/invoice?s.cursor=${encodeURIComponent(staleCursor)}`);

    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back to first page/i })).toBeInTheDocument();
  });

  it("recovers to the first page when the reset action is clicked", async () => {
    vi.useFakeTimers();

    const staleCursor = `${API_URL}/invoices?_cursor=stale`;
    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      http.get(`${API_URL}/invoices`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("_cursor");
        if (cursor === "stale") return HttpResponse.json(null, { status: 400 });
        return HttpResponse.json({
          _links: { self: { href: `${API_URL}/invoices` } },
          _embedded: { item: [] },
          page: { size: 0, total_items_exact: 0 },
        });
      }),
    );

    renderEntityList(`/invoice?s.cursor=${encodeURIComponent(staleCursor)}`);

    await vi.runAllTimersAsync();
    vi.useRealTimers();

    const resetButton = await screen.findByRole("button", { name: /back to first page/i });

    const user = userEvent.setup();
    await user.click(resetButton);

    // Clearing the cursor switches the hook to the default (first-page) request,
    // which succeeds — the error and its reset action disappear.
    await screen.findByRole("table");
    expect(screen.queryByText(/Failed to load/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /back to first page/i })).not.toBeInTheDocument();
  });

  it("shows entity item count badge when collection succeeds", async () => {
    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      createListHandler({
        url: `${API_URL}/invoices`,
        items: sampleInvoiceItems,
        page: { size: 20, total_items_exact: sampleInvoiceItems.length },
      }),
    );

    renderEntityList("/invoice");

    // Count badge "3 items" should appear in the detail header
    expect(await screen.findByText(/3 items/)).toBeInTheDocument();
  });

  it("clicking an entity card title navigates to entity detail page", async () => {
    const user = userEvent.setup();

    server.use(profileRootHandler(), invoiceProfileHandler(), emptyInvoicesList);

    renderEntityList();

    // Wait for the entity card to appear (card title)
    await screen.findByText("1 entity type available");
    // Click the card title which navigates to the entity
    const cardTitle = screen.getAllByText("Invoice")[0];
    await user.click(cardTitle);

    // After click, should be on detail page (breadcrumb appears)
    expect(await screen.findByText("All entities")).toBeInTheDocument();
  });

  it("shows pagination controls when there are multiple pages", async () => {
    const nextPageUrl = `${API_URL}/invoices?_cursor=nexttoken`;

    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      createListHandler({
        url: `${API_URL}/invoices`,
        items: sampleInvoiceItems,
        page: { size: 3, total_items_exact: 10 },
        links: {
          self: { href: `${API_URL}/invoices` },
          next: { href: nextPageUrl },
        },
      }),
    );

    renderEntityList("/invoice");

    // Both pagination buttons should appear
    expect(await screen.findByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Previous" })).toBeInTheDocument();
  });

  it("clicking Next pagination button is clickable and triggers navigation", async () => {
    const user = userEvent.setup();
    const nextPageUrl = `${API_URL}/invoices?_cursor=nexttoken`;

    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      createListHandler({
        url: `${API_URL}/invoices`,
        items: sampleInvoiceItems,
        page: { size: 3, total_items_exact: 4 },
        links: {
          self: { href: `${API_URL}/invoices` },
          next: { href: nextPageUrl },
        },
      }),
    );

    renderEntityList("/invoice");

    // Next and Previous pagination buttons appear
    const nextButton = await screen.findByRole("button", { name: "Next" });
    const prevButton = screen.getByRole("button", { name: "Previous" });

    // Previous is disabled (no prev on first page), Next is enabled
    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    // Clicking Next triggers router navigation — the button stays in the DOM
    // because the component re-renders in place rather than unmounting
    await user.click(nextButton);
    expect(nextButton).toBeInTheDocument();
  });

  it("fetches from s.cursor URL when s.cursor is present in the route", async () => {
    const nextPageUrl = `${API_URL}/invoices?_cursor=page2token`;

    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      // Only the cursor-page handler is registered — when s.cursor is set the component
      // fetches that URL directly and never requests the base collection URL
      createListHandler({
        url: nextPageUrl,
        items: [sampleItem],
        page: { size: 1, total_items_exact: 4 },
      }),
    );

    renderEntityList(`/invoice?s.cursor=${encodeURIComponent(nextPageUrl)}`);

    // Data from the cursor page should be rendered
    expect(await screen.findByText("INV-2024-001")).toBeInTheDocument();
  });
});

// ----------------------------------------------------------------
// EntityDetailPage — navigation interactions
// ----------------------------------------------------------------

describe("EntityDetailPage", () => {
  it("clicking back navigates to root overview", async () => {
    const user = userEvent.setup();

    server.use(profileRootHandler(), invoiceProfileHandler(), emptyInvoicesList);

    renderEntityList("/invoice");

    const backButton = await screen.findByText("All entities");
    await user.click(backButton);

    // After navigating back, the overview header appears (no breadcrumb)
    expect(await screen.findByText("1 entity type available")).toBeInTheDocument();
  });

  it("table row click navigates to item detail", async () => {
    const user = userEvent.setup();

    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      createListHandler({
        url: `${API_URL}/invoices`,
        items: [sampleInvoiceItems[0]],
        page: { size: 1, total_items_exact: 1 },
      }),
      http.get(`${API_URL}/invoices/inv-001`, () => HttpResponse.json({ ...sampleItem })),
    );

    renderEntityList("/invoice");

    // Wait for item row to appear — the table shows "number" (user-defined attribute)
    const cell = await screen.findByText("INV-2024-001");
    await user.click(cell);

    // After row click, navigate to /$entity/$itemId — breadcrumb shows itemId
    expect(await screen.findByText("inv-001")).toBeInTheDocument();
  });

  it("shows entity description when available", async () => {
    server.use(
      http.get(PROFILE_URL, () =>
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
      ),
      http.get(`${PROFILE_URL}/invoices`, () =>
        HttpResponse.json({
          name: "invoice",
          title: "Invoice",
          description: "All billing invoices",
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
      ),
      emptyInvoicesList,
    );

    renderEntityList("/invoice");

    expect(await screen.findByText("All billing invoices")).toBeInTheDocument();
  });
});

// ----------------------------------------------------------------
// EntityItemDetailPage — attribute rendering
// ----------------------------------------------------------------

describe("EntityItemDetailPage", () => {
  it("renders item breadcrumb with item id", async () => {
    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      emptyInvoicesList,
      http.get(`${API_URL}/invoices/inv-001`, () =>
        HttpResponse.json({
          id: "inv-001",
          number: "INV-2024-001",
          _links: {
            self: { href: `${API_URL}/invoices/inv-001` },
          },
        }),
      ),
    );

    renderEntityList("/invoice/inv-001");

    // Breadcrumb shows the item id in BreadcrumbPage
    expect(await screen.findByText("inv-001")).toBeInTheDocument();
    // All entities back link
    expect(await screen.findByText("All entities")).toBeInTheDocument();
  });

  it("renders item user-defined attribute values", async () => {
    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      emptyInvoicesList,
      http.get(`${API_URL}/invoices/inv-001`, () =>
        HttpResponse.json({
          id: "inv-001",
          number: "INV-2024-001",
          _links: {
            self: { href: `${API_URL}/invoices/inv-001` },
          },
        }),
      ),
    );

    renderEntityList("/invoice/inv-001");

    // Invoice Number attribute value
    expect(await screen.findByText("INV-2024-001")).toBeInTheDocument();
    // The attribute label (from profile)
    expect(await screen.findByText("Invoice Number")).toBeInTheDocument();
  });

  it("shows error on item detail page when item fetch fails", async () => {
    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      emptyInvoicesList,
      http.get(`${API_URL}/invoices/inv-001`, () => HttpResponse.json(null, { status: 500 })),
    );

    renderEntityList("/invoice/inv-001");

    expect(await screen.findByText(/Failed to load item/)).toBeInTheDocument();
  });

  it("navigates back to entity list via entity breadcrumb", async () => {
    const user = userEvent.setup();

    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      emptyInvoicesList,
      http.get(`${API_URL}/invoices/inv-001`, () => HttpResponse.json({ ...sampleItem })),
    );

    renderEntityList("/invoice/inv-001");

    // Wait for item detail page to load (breadcrumb with entity)
    await screen.findByText("All entities");

    // Click "Invoice" breadcrumb button to go back to entity list
    const invoiceButtons = screen
      .getAllByText("Invoice")
      .filter((el) => el.closest("button") !== null);
    if (invoiceButtons.length > 0) {
      await user.click(invoiceButtons[0]);
      expect(await screen.findByText("All entities")).toBeInTheDocument();
    }
  });

  it("navigates back to root via all entities breadcrumb", async () => {
    const user = userEvent.setup();

    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      emptyInvoicesList,
      http.get(`${API_URL}/invoices/inv-001`, () => HttpResponse.json({ ...sampleItem })),
    );

    renderEntityList("/invoice/inv-001");

    // Wait for item detail page to load
    const allEntitiesLink = await screen.findByText("All entities");
    await user.click(allEntitiesLink);

    // After navigating back, overview header should appear
    expect(await screen.findByText("1 entity type available")).toBeInTheDocument();
  });

  it("shows item detail heading with entity plural name", async () => {
    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      emptyInvoicesList,
      http.get(`${API_URL}/invoices/inv-001`, () => HttpResponse.json({ ...sampleItem })),
    );

    renderEntityList("/invoice/inv-001");

    // Heading shows entity plural name + " detail"
    expect(await screen.findByText(/detail/)).toBeInTheDocument();
  });
});
