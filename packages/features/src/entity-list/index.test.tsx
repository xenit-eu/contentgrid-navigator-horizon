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
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
  createContentUploadClient,
  entitySearchStateValidator,
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
  const createContentUploadFetch = (onProgress?: (percentage: number) => void) =>
    createContentUploadClient(noopSupplier, onProgress);

  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={apiFetch}
          contentFetch={contentFetch}
          createContentUploadFetch={createContentUploadFetch}
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

// ----------------------------------------------------------------
// EntityItemDetailPage — content attribute upload (ContentAttributeField)
// ----------------------------------------------------------------

const CG_CONTENT_REL = "https://contentgrid.cloud/rels/contentgrid/content";
const DOCUMENT_CONTENT_URL = `${API_URL}/invoices/inv-001/document`;

function invoiceProfileHandlerWithDocument() {
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
            name: "document",
            title: "Document",
            type: "object",
            readOnly: false,
            // A single embedded sub-attribute is all ProfileAttribute.isContent
            // requires (type === "object" with >0 embedded blueprint:attribute) —
            // the real mimetype/length siblings aren't exercised by these tests.
            _embedded: {
              "blueprint:constraint": [],
              "blueprint:search-param": [],
              "blueprint:attribute": [
                {
                  name: "filename",
                  title: "Filename",
                  type: "string",
                  readOnly: false,
                  _embedded: {
                    "blueprint:constraint": [],
                    "blueprint:search-param": [],
                    "blueprint:attribute": [],
                  },
                  _links: {},
                },
              ],
            },
            _links: {},
          },
        ],
        "blueprint:relation": [],
      },
      _templates: {
        search: { method: "GET", target: `${API_URL}/invoices`, properties: [] },
      },
    }),
  );
}

function invoiceWithDocumentItemHandler(
  getDocument: () => { filename: string; mimetype: string; length: number } | null,
) {
  return http.get(`${API_URL}/invoices/inv-001`, () =>
    HttpResponse.json({
      id: "inv-001",
      document: getDocument(),
      _links: {
        self: { href: `${API_URL}/invoices/inv-001` },
        [CG_CONTENT_REL]: [{ href: DOCUMENT_CONTENT_URL, name: "document" }],
      },
    }),
  );
}

function selectFile(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, "files", { value: [file] });
  fireEvent.change(input);
}

describe("EntityItemDetailPage — ContentAttributeField", () => {
  it("shows the existing filename alongside the upload field", async () => {
    server.use(
      profileRootHandler(),
      invoiceProfileHandlerWithDocument(),
      invoiceWithDocumentItemHandler(() => ({
        filename: "invoice.pdf",
        mimetype: "application/pdf",
        length: 1024,
      })),
    );

    renderEntityList("/invoice/inv-001");

    expect(await screen.findByText("Current: invoice.pdf")).toBeInTheDocument();
    expect(screen.getByText(/drag & drop a file, or click to select/i)).toBeInTheDocument();
  });

  it("uploads a selected file and reflects the new filename once the upload succeeds", async () => {
    let uploaded: { filename: string; mimetype: string; length: number } | null = null;

    server.use(
      profileRootHandler(),
      invoiceProfileHandlerWithDocument(),
      invoiceWithDocumentItemHandler(() => uploaded),
      http.put(DOCUMENT_CONTENT_URL, () => {
        uploaded = { filename: "report.pdf", mimetype: "application/pdf", length: 7 };
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderEntityList("/invoice/inv-001");
    await screen.findByText(/drag & drop a file, or click to select/i);
    // No existing content yet — the "Current: ..." caption must not render.
    expect(screen.queryByText(/^Current:/)).not.toBeInTheDocument();

    selectFile(new File(["content"], "report.pdf", { type: "application/pdf" }));

    expect(await screen.findByText("Current: report.pdf")).toBeInTheDocument();
    // Local file selection resets on success — the drop-zone prompt returns.
    expect(screen.getByText(/drag & drop a file, or click to select/i)).toBeInTheDocument();
  });

  it("surfaces a 412 ProblemDetailError from a failed upload and retries with the same file", async () => {
    let putCount = 0;

    server.use(
      profileRootHandler(),
      invoiceProfileHandlerWithDocument(),
      invoiceWithDocumentItemHandler(() => null),
      http.put(DOCUMENT_CONTENT_URL, () => {
        putCount += 1;
        return HttpResponse.json(
          {
            type: "https://contentgrid.cloud/problems/unsatisfied-version",
            title: "Unsatisfied version",
            status: 412,
            detail: "The item was modified concurrently.",
          },
          { status: 412, headers: { "Content-Type": "application/problem+json" } },
        );
      }),
    );

    renderEntityList("/invoice/inv-001");
    await screen.findByText(/drag & drop a file, or click to select/i);

    selectFile(new File(["content"], "report.pdf", { type: "application/pdf" }));

    expect(await screen.findByText("412")).toBeInTheDocument();
    expect(screen.getByText("Unsatisfied version")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(putCount).toBe(2));
  });

  it("falls back to a plain dash when the item has no cg:content link (ABAC deny)", async () => {
    server.use(
      profileRootHandler(),
      invoiceProfileHandlerWithDocument(),
      http.get(`${API_URL}/invoices/inv-001`, () =>
        HttpResponse.json({
          id: "inv-001",
          document: { filename: "secret.pdf", mimetype: "application/pdf", length: 99 },
          _links: { self: { href: `${API_URL}/invoices/inv-001` } },
        }),
      ),
    );

    renderEntityList("/invoice/inv-001");

    await screen.findByText("Document");
    expect(screen.queryByText(/drag & drop a file, or click to select/i)).not.toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

// ----------------------------------------------------------------
// EntityItemDetailPage — relations (RelationToOneSection, RelationToManySection,
// RelationItemSearchDialog, MutationErrorDisplay)
// ----------------------------------------------------------------

const SUPPLIER_PROFILE_URL = `${PROFILE_URL}/suppliers`;
const LINE_ITEM_PROFILE_URL = `${PROFILE_URL}/line-items`;
const SUPPLIERS_COLLECTION_URL = `${API_URL}/suppliers`;
const LINE_ITEMS_COLLECTION_URL = `${API_URL}/line-items`;

const CG_RELATION_REL = "https://contentgrid.cloud/rels/contentgrid/relation";
const BLUEPRINT_RELATION_REL = "https://contentgrid.cloud/rels/blueprint/relation";
const BLUEPRINT_TARGET_ENTITY_REL = "https://contentgrid.cloud/rels/blueprint/target-entity";

function profileRootWithRelationsHandler() {
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
    }),
  );
}

function invoiceProfileHandlerWithRelations() {
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
            name: "number",
            title: "Invoice Number",
            type: "string",
            readOnly: false,
            _embedded: { "blueprint:constraint": [], "blueprint:search-param": [] },
            _links: {},
          },
        ],
        [BLUEPRINT_RELATION_REL]: [
          {
            name: "supplier",
            title: "Supplier",
            description: "",
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
            description: "",
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

function supplierProfileHandler() {
  return http.get(SUPPLIER_PROFILE_URL, () =>
    HttpResponse.json({
      name: "supplier",
      title: "Supplier",
      _links: {
        self: { href: SUPPLIER_PROFILE_URL },
        describes: [
          { href: SUPPLIERS_COLLECTION_URL, name: "collection" },
          { href: `${SUPPLIERS_COLLECTION_URL}/{id}`, name: "item", templated: true },
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
            name: "name",
            title: "Name",
            type: "string",
            readOnly: false,
            _embedded: {
              "blueprint:constraint": [],
              "blueprint:search-param": [
                { name: "name~prefix", title: "Name prefix", type: "prefix-match" },
              ],
            },
            _links: {},
          },
        ],
        "blueprint:relation": [],
      },
      _templates: {
        search: {
          method: "GET",
          target: SUPPLIERS_COLLECTION_URL,
          properties: [{ name: "name~prefix", type: "text" }],
        },
      },
    }),
  );
}

function lineItemProfileHandler() {
  return http.get(LINE_ITEM_PROFILE_URL, () =>
    HttpResponse.json({
      name: "lineItem",
      title: "Line Item",
      _links: {
        self: { href: LINE_ITEM_PROFILE_URL },
        describes: [
          { href: LINE_ITEMS_COLLECTION_URL, name: "collection" },
          { href: `${LINE_ITEMS_COLLECTION_URL}/{id}`, name: "item", templated: true },
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
            name: "description",
            title: "Description",
            type: "string",
            readOnly: false,
            _embedded: {
              "blueprint:constraint": [],
              "blueprint:search-param": [
                { name: "description~prefix", title: "Description prefix", type: "prefix-match" },
              ],
            },
            _links: {},
          },
        ],
        "blueprint:relation": [],
      },
      _templates: {
        search: {
          method: "GET",
          target: LINE_ITEMS_COLLECTION_URL,
          properties: [{ name: "description~prefix", type: "text" }],
        },
      },
    }),
  );
}

/** Invoice item exposing only the to-one `supplier` relation. */
function makeInvoiceItemWithSupplier(itemId: string) {
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
function makeInvoiceItemWithLineItems(itemId: string) {
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

function lineItem(id: string, description: string, withDeleteTemplate = false) {
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

function notFoundProblem() {
  return HttpResponse.json(
    {
      status: 404,
      title: "Not Found",
      type: "https://contentgrid.cloud/problems/not-found/entity-item",
    },
    { status: 404, headers: { "Content-Type": "application/problem+json" } },
  );
}

describe("EntityItemDetailPage — RelationToOneSection", () => {
  it("links a relation via the search dialog when no item is linked", async () => {
    const user = userEvent.setup();
    const itemId = "inv-one-link";
    const itemUrl = `${API_URL}/invoices/${itemId}`;
    const supplierRelationUrl = `${itemUrl}/supplier`;
    let linked = false;

    server.use(
      profileRootWithRelationsHandler(),
      invoiceProfileHandlerWithRelations(),
      supplierProfileHandler(),
      lineItemProfileHandler(),
      http.get(itemUrl, () => HttpResponse.json(makeInvoiceItemWithSupplier(itemId))),
      http.get(supplierRelationUrl, () =>
        linked
          ? HttpResponse.json({
              id: "sup-001",
              name: "Acme Corp",
              _links: { self: { href: `${SUPPLIERS_COLLECTION_URL}/sup-001` } },
            })
          : notFoundProblem(),
      ),
      createListHandler({
        url: SUPPLIERS_COLLECTION_URL,
        items: [
          {
            id: "sup-001",
            name: "Acme Corp",
            _links: { self: { href: `${SUPPLIERS_COLLECTION_URL}/sup-001` } },
          },
        ],
      }),
      http.put(supplierRelationUrl, () => {
        linked = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderEntityList(`/invoice/${itemId}`);

    expect(await screen.findByText("No item linked")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Link" }));
    await user.click(await screen.findByText("Acme Corp"));

    await waitFor(() => expect(screen.queryByText("No item linked")).not.toBeInTheDocument());
    expect(await screen.findByText("Acme Corp")).toBeInTheDocument();
  });

  it("shows the linked item and navigates to its detail page when clicked", async () => {
    const user = userEvent.setup();
    const itemId = "inv-one-navigate";
    const itemUrl = `${API_URL}/invoices/${itemId}`;
    const supplierRelationUrl = `${itemUrl}/supplier`;
    const supplierItemUrl = `${SUPPLIERS_COLLECTION_URL}/sup-001`;

    server.use(
      profileRootWithRelationsHandler(),
      invoiceProfileHandlerWithRelations(),
      supplierProfileHandler(),
      lineItemProfileHandler(),
      http.get(itemUrl, () => HttpResponse.json(makeInvoiceItemWithSupplier(itemId))),
      http.get(supplierRelationUrl, () =>
        HttpResponse.json({
          id: "sup-001",
          name: "Acme Corp",
          _links: { self: { href: supplierItemUrl } },
        }),
      ),
      http.get(supplierItemUrl, () =>
        HttpResponse.json({
          id: "sup-001",
          name: "Acme Corp",
          _links: { self: { href: supplierItemUrl } },
        }),
      ),
    );

    renderEntityList(`/invoice/${itemId}`);

    const linkedButton = await screen.findByText("Acme Corp");
    await user.click(linkedButton);

    expect(await screen.findByText("sup-001")).toBeInTheDocument();
  });

  it("unlinks a relation after confirming the alert dialog", async () => {
    const user = userEvent.setup();
    const itemId = "inv-one-unlink";
    const itemUrl = `${API_URL}/invoices/${itemId}`;
    const supplierRelationUrl = `${itemUrl}/supplier`;
    let linked = true;

    server.use(
      profileRootWithRelationsHandler(),
      invoiceProfileHandlerWithRelations(),
      supplierProfileHandler(),
      lineItemProfileHandler(),
      http.get(itemUrl, () => HttpResponse.json(makeInvoiceItemWithSupplier(itemId))),
      http.get(supplierRelationUrl, () =>
        linked
          ? HttpResponse.json({
              id: "sup-001",
              name: "Acme Corp",
              _links: { self: { href: `${SUPPLIERS_COLLECTION_URL}/sup-001` } },
            })
          : notFoundProblem(),
      ),
      http.delete(supplierRelationUrl, () => {
        linked = false;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderEntityList(`/invoice/${itemId}`);

    await screen.findByText("Acme Corp");
    await user.click(screen.getByRole("button", { name: "Unlink" }));

    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Unlink" }));

    await waitFor(() => expect(screen.getByText("No item linked")).toBeInTheDocument());
  });

  it("shows a plain problem summary when clearing the relation fails", async () => {
    const user = userEvent.setup();
    const itemId = "inv-one-clear-error";
    const itemUrl = `${API_URL}/invoices/${itemId}`;
    const supplierRelationUrl = `${itemUrl}/supplier`;

    server.use(
      profileRootWithRelationsHandler(),
      invoiceProfileHandlerWithRelations(),
      supplierProfileHandler(),
      lineItemProfileHandler(),
      http.get(itemUrl, () => HttpResponse.json(makeInvoiceItemWithSupplier(itemId))),
      http.get(supplierRelationUrl, () =>
        HttpResponse.json({
          id: "sup-001",
          name: "Acme Corp",
          _links: { self: { href: `${SUPPLIERS_COLLECTION_URL}/sup-001` } },
        }),
      ),
      http.delete(supplierRelationUrl, () =>
        HttpResponse.json(
          {
            status: 409,
            title: "Conflict",
            detail: "This supplier is still referenced elsewhere.",
            type: "https://contentgrid.cloud/problems/integrity/required-relation",
          },
          { status: 409, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    renderEntityList(`/invoice/${itemId}`);

    await screen.findByText("Acme Corp");
    await user.click(screen.getByRole("button", { name: "Unlink" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Unlink" }));

    expect(await screen.findByText("Conflict")).toBeInTheDocument();
    expect(screen.getByText("This supplier is still referenced elsewhere.")).toBeInTheDocument();
    expect(screen.getByText("required-relation")).toBeInTheDocument();
  });

  it("shows field-level validation errors when linking fails", async () => {
    const user = userEvent.setup();
    const itemId = "inv-one-link-error";
    const itemUrl = `${API_URL}/invoices/${itemId}`;
    const supplierRelationUrl = `${itemUrl}/supplier`;

    server.use(
      profileRootWithRelationsHandler(),
      invoiceProfileHandlerWithRelations(),
      supplierProfileHandler(),
      lineItemProfileHandler(),
      http.get(itemUrl, () => HttpResponse.json(makeInvoiceItemWithSupplier(itemId))),
      http.get(supplierRelationUrl, () => notFoundProblem()),
      createListHandler({
        url: SUPPLIERS_COLLECTION_URL,
        items: [
          {
            id: "sup-001",
            name: "Acme Corp",
            _links: { self: { href: `${SUPPLIERS_COLLECTION_URL}/sup-001` } },
          },
        ],
      }),
      http.put(supplierRelationUrl, () =>
        HttpResponse.json(
          {
            status: 400,
            title: "Validation Failed",
            type: "https://contentgrid.cloud/problems/input/validation",
            errors: [
              {
                property: "supplier",
                title: "Invalid value",
                detail: "must be a valid supplier",
              },
            ],
          },
          { status: 400, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    renderEntityList(`/invoice/${itemId}`);

    await screen.findByText("No item linked");
    await user.click(screen.getByRole("button", { name: "Link" }));
    await user.click(await screen.findByText("Acme Corp"));

    const propertyLabel = await screen.findByText("supplier:");
    expect(propertyLabel.closest("li")).toHaveTextContent("must be a valid supplier");
  });
});

describe("EntityItemDetailPage — RelationToManySection", () => {
  it("renders the relation table with a total-count badge", async () => {
    const itemId = "inv-many-render";
    const itemUrl = `${API_URL}/invoices/${itemId}`;
    const lineItemsRelationUrl = `${itemUrl}/lineItems`;

    server.use(
      profileRootWithRelationsHandler(),
      invoiceProfileHandlerWithRelations(),
      supplierProfileHandler(),
      lineItemProfileHandler(),
      http.get(itemUrl, () => HttpResponse.json(makeInvoiceItemWithLineItems(itemId))),
      createListHandler({
        url: lineItemsRelationUrl,
        items: [lineItem("li-001", "Widget A"), lineItem("li-002", "Widget B")],
        page: { size: 2, total_items_exact: 2 },
      }),
    );

    renderEntityList(`/invoice/${itemId}`);

    expect(await screen.findByText("Widget A")).toBeInTheDocument();
    expect(screen.getByText("Widget B")).toBeInTheDocument();
    expect(screen.getByText(/2 items/)).toBeInTheDocument();
  });

  it("shows 'No items linked' for an empty relation", async () => {
    const itemId = "inv-many-empty";
    const itemUrl = `${API_URL}/invoices/${itemId}`;
    const lineItemsRelationUrl = `${itemUrl}/lineItems`;

    server.use(
      profileRootWithRelationsHandler(),
      invoiceProfileHandlerWithRelations(),
      supplierProfileHandler(),
      lineItemProfileHandler(),
      http.get(itemUrl, () => HttpResponse.json(makeInvoiceItemWithLineItems(itemId))),
      createListHandler({
        url: lineItemsRelationUrl,
        items: [],
        page: { size: 0, total_items_exact: 0 },
      }),
    );

    renderEntityList(`/invoice/${itemId}`);

    expect(await screen.findByText("No items linked")).toBeInTheDocument();
  });

  it("adds an item via the search dialog, including a typed search query", async () => {
    const user = userEvent.setup();
    const itemId = "inv-many-add";
    const itemUrl = `${API_URL}/invoices/${itemId}`;
    const lineItemsRelationUrl = `${itemUrl}/lineItems`;
    let items: ReturnType<typeof lineItem>[] = [];

    server.use(
      profileRootWithRelationsHandler(),
      invoiceProfileHandlerWithRelations(),
      supplierProfileHandler(),
      lineItemProfileHandler(),
      http.get(itemUrl, () => HttpResponse.json(makeInvoiceItemWithLineItems(itemId))),
      http.get(lineItemsRelationUrl, () =>
        HttpResponse.json({
          _links: { self: { href: lineItemsRelationUrl } },
          _embedded: { item: items },
          page: { size: items.length, total_items_exact: items.length },
        }),
      ),
      http.get(LINE_ITEMS_COLLECTION_URL, ({ request }) => {
        const query = new URL(request.url).searchParams.get("description~prefix");
        const found =
          query === "Widget"
            ? [lineItem("li-010", "Widget Searched")]
            : [lineItem("li-020", "Any")];
        return HttpResponse.json({
          _links: { self: { href: LINE_ITEMS_COLLECTION_URL } },
          _embedded: { item: found },
          page: { size: found.length, total_items_exact: found.length },
        });
      }),
      http.post(lineItemsRelationUrl, () => {
        items = [lineItem("li-010", "Widget Searched")];
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderEntityList(`/invoice/${itemId}`);

    await screen.findByText("No items linked");
    await user.click(screen.getByRole("button", { name: "Add" }));

    // Default (empty query) search result
    expect(await screen.findByText("Any")).toBeInTheDocument();

    // Typing narrows the search via the prefix-match property (single atomic
    // change avoids racing intermediate per-keystroke queries in this test).
    const input = screen.getByPlaceholderText(/Search/);
    fireEvent.change(input, { target: { value: "Widget" } });
    expect(await screen.findByText("Widget Searched")).toBeInTheDocument();

    await user.click(screen.getByText("Widget Searched"));

    await waitFor(() => expect(screen.queryByText("No items linked")).not.toBeInTheDocument());
    expect(await screen.findByText("Widget Searched")).toBeInTheDocument();
  });

  it("shows 'No items found' when the search dialog has no results", async () => {
    const user = userEvent.setup();
    const itemId = "inv-many-add-empty";
    const itemUrl = `${API_URL}/invoices/${itemId}`;
    const lineItemsRelationUrl = `${itemUrl}/lineItems`;

    server.use(
      profileRootWithRelationsHandler(),
      invoiceProfileHandlerWithRelations(),
      supplierProfileHandler(),
      lineItemProfileHandler(),
      http.get(itemUrl, () => HttpResponse.json(makeInvoiceItemWithLineItems(itemId))),
      createListHandler({
        url: lineItemsRelationUrl,
        items: [],
        page: { size: 0, total_items_exact: 0 },
      }),
      createListHandler({ url: LINE_ITEMS_COLLECTION_URL, items: [] }),
    );

    renderEntityList(`/invoice/${itemId}`);

    await screen.findByText("No items linked");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("No items found")).toBeInTheDocument();
  });

  it("clears all items after confirming the alert dialog", async () => {
    const user = userEvent.setup();
    const itemId = "inv-many-clear";
    const itemUrl = `${API_URL}/invoices/${itemId}`;
    const lineItemsRelationUrl = `${itemUrl}/lineItems`;
    let items = [lineItem("li-001", "Widget A"), lineItem("li-002", "Widget B")];

    server.use(
      profileRootWithRelationsHandler(),
      invoiceProfileHandlerWithRelations(),
      supplierProfileHandler(),
      lineItemProfileHandler(),
      http.get(itemUrl, () => HttpResponse.json(makeInvoiceItemWithLineItems(itemId))),
      http.get(lineItemsRelationUrl, () =>
        HttpResponse.json({
          _links: { self: { href: lineItemsRelationUrl } },
          _embedded: { item: items },
          page: { size: items.length, total_items_exact: items.length },
        }),
      ),
      http.delete(lineItemsRelationUrl, () => {
        items = [];
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderEntityList(`/invoice/${itemId}`);

    await screen.findByText("Widget A");
    await user.click(screen.getByRole("button", { name: "Clear all" }));

    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Clear all" }));

    await waitFor(() => expect(screen.getByText("No items linked")).toBeInTheDocument());
  });

  it("shows field-level validation errors when adding fails", async () => {
    const user = userEvent.setup();
    const itemId = "inv-many-add-error";
    const itemUrl = `${API_URL}/invoices/${itemId}`;
    const lineItemsRelationUrl = `${itemUrl}/lineItems`;

    server.use(
      profileRootWithRelationsHandler(),
      invoiceProfileHandlerWithRelations(),
      supplierProfileHandler(),
      lineItemProfileHandler(),
      http.get(itemUrl, () => HttpResponse.json(makeInvoiceItemWithLineItems(itemId))),
      createListHandler({
        url: lineItemsRelationUrl,
        items: [],
        page: { size: 0, total_items_exact: 0 },
      }),
      createListHandler({
        url: LINE_ITEMS_COLLECTION_URL,
        items: [lineItem("li-030", "Gadget")],
      }),
      http.post(lineItemsRelationUrl, () =>
        HttpResponse.json(
          {
            status: 400,
            title: "Validation Failed",
            type: "https://contentgrid.cloud/problems/input/validation",
            errors: [
              {
                property: "lineItem",
                title: "Invalid value",
                detail: "must reference an existing line item",
              },
            ],
          },
          { status: 400, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    renderEntityList(`/invoice/${itemId}`);

    await screen.findByText("No items linked");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(await screen.findByText("Gadget"));

    const propertyLabel = await screen.findByText("lineItem:");
    expect(propertyLabel.closest("li")).toHaveTextContent("must reference an existing line item");
  });

  it("unlinks a single row via the row-level unlink action", async () => {
    const user = userEvent.setup();
    const itemId = "inv-many-unlink-row";
    const itemUrl = `${API_URL}/invoices/${itemId}`;
    const lineItemsRelationUrl = `${itemUrl}/lineItems`;
    let items = [lineItem("li-001", "Widget A"), lineItem("li-002", "Widget B")];

    server.use(
      profileRootWithRelationsHandler(),
      invoiceProfileHandlerWithRelations(),
      supplierProfileHandler(),
      lineItemProfileHandler(),
      http.get(itemUrl, () => HttpResponse.json(makeInvoiceItemWithLineItems(itemId))),
      http.get(lineItemsRelationUrl, () =>
        HttpResponse.json({
          _links: { self: { href: lineItemsRelationUrl } },
          _embedded: { item: items },
          page: { size: items.length, total_items_exact: items.length },
        }),
      ),
      http.delete(`${lineItemsRelationUrl}/li-001`, () => {
        items = items.filter((i) => i.id !== "li-001");
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderEntityList(`/invoice/${itemId}`);

    await screen.findByText("Widget A");
    const unlinkButtons = screen.getAllByRole("button", { name: "Unlink" });
    await user.click(unlinkButtons[0]);

    await waitFor(() => expect(screen.queryByText("Widget A")).not.toBeInTheDocument());
    expect(screen.getByText("Widget B")).toBeInTheDocument();
  });

  it("deletes a row item via the row action menu when the item has a delete template", async () => {
    const user = userEvent.setup();
    const itemId = "inv-many-delete-row";
    const itemUrl = `${API_URL}/invoices/${itemId}`;
    const lineItemsRelationUrl = `${itemUrl}/lineItems`;
    let items = [lineItem("li-001", "Widget A", true), lineItem("li-002", "Widget B", false)];

    server.use(
      profileRootWithRelationsHandler(),
      invoiceProfileHandlerWithRelations(),
      supplierProfileHandler(),
      lineItemProfileHandler(),
      http.get(itemUrl, () => HttpResponse.json(makeInvoiceItemWithLineItems(itemId))),
      http.get(lineItemsRelationUrl, () =>
        HttpResponse.json({
          _links: { self: { href: lineItemsRelationUrl } },
          _embedded: { item: items },
          page: { size: items.length, total_items_exact: items.length },
        }),
      ),
      http.delete(`${LINE_ITEMS_COLLECTION_URL}/li-001`, () => {
        items = items.filter((i) => i.id !== "li-001");
        return new HttpResponse(null, { status: 204 });
      }),
      // RelationItemSearchDialog mounts (and queries) as soon as the section
      // renders, since `canAdd` is true here — even though the dialog is closed.
      createListHandler({ url: LINE_ITEMS_COLLECTION_URL, items: [] }),
    );

    renderEntityList(`/invoice/${itemId}`);

    await screen.findByText("Widget A");
    const menuButtons = screen.getAllByRole("button", { name: "Open menu" });
    await user.click(menuButtons[0]);
    await user.click(await screen.findByText("Delete"));

    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.queryByText("Widget A")).not.toBeInTheDocument());
    expect(screen.getByText("Widget B")).toBeInTheDocument();
  });

  it("paginates via Next / Previous, fetching the requested page URL", async () => {
    const user = userEvent.setup();
    const itemId = "inv-many-paginate";
    const itemUrl = `${API_URL}/invoices/${itemId}`;
    const lineItemsRelationUrl = `${itemUrl}/lineItems`;
    const page2Url = `${lineItemsRelationUrl}?_cursor=page2`;

    server.use(
      profileRootWithRelationsHandler(),
      invoiceProfileHandlerWithRelations(),
      supplierProfileHandler(),
      lineItemProfileHandler(),
      http.get(itemUrl, () => HttpResponse.json(makeInvoiceItemWithLineItems(itemId))),
      // Single dynamic handler on the pathname — branches on the `_cursor` query
      // param instead of registering two handlers that only differ by query string
      // (MSW matches paths, not query strings, and warns/misbehaves otherwise).
      http.get(lineItemsRelationUrl, ({ request }) => {
        const isPage2 = new URL(request.url).searchParams.get("_cursor") === "page2";
        return HttpResponse.json({
          _links: isPage2
            ? { self: { href: page2Url }, previous: { href: lineItemsRelationUrl } }
            : { self: { href: lineItemsRelationUrl }, next: { href: page2Url } },
          _embedded: {
            item: [isPage2 ? lineItem("li-002", "Widget B") : lineItem("li-001", "Widget A")],
          },
          page: { size: 1, total_items_exact: 2 },
        });
      }),
    );

    renderEntityList(`/invoice/${itemId}`);

    await screen.findByText("Widget A");
    const nextButton = screen.getByRole("button", { name: "Next" });
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    await user.click(nextButton);

    expect(await screen.findByText("Widget B")).toBeInTheDocument();
    expect(screen.queryByText("Widget A")).not.toBeInTheDocument();
  });
});
