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
  entitySearchStateValidator,
} from "@contentgrid/navigator-data";
import { sampleInvoiceItems } from "@contentgrid/navigator-data/test-fixtures/hal/fixtures";
import {
  createListHandler,
  createProfileHandler,
} from "@contentgrid/navigator-data/test-fixtures/msw/handlers";
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
  return { ...render(<RouterProvider router={router} />), router };
}

// ----------------------------------------------------------------
// MSW handlers
// ----------------------------------------------------------------

/**
 * Root profile handler builder. The root profile response has a much
 * simpler shape than a per-entity profile: just the `cg:entity` link list
 * (no `_embedded` attributes/relations, no `_templates`) — see
 * buildEntityProfileHandler below for the per-entity shape.
 */
function buildRootProfileHandler(
  entities: ReadonlyArray<{ href: string; name: string; title: string }>,
) {
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
        "cg:entity": entities,
      },
    }),
  );
}

function profileRootHandler() {
  return buildRootProfileHandler([
    { href: `${PROFILE_URL}/invoices`, name: "invoice", title: "Invoice" },
  ]);
}

function profileRootWithTwoEntitiesHandler() {
  return buildRootProfileHandler([
    { href: `${PROFILE_URL}/invoices`, name: "invoice", title: "Invoice" },
    { href: `${PROFILE_URL}/customers`, name: "customer", title: "Customer" },
  ]);
}

interface BlueprintSearchParam {
  name: string;
  title: string;
  type: string;
}

/**
 * Builds one `blueprint:attribute` embedded resource, as found in a
 * per-entity profile's `_embedded["blueprint:attribute"]` array. Every
 * attribute across every fixture in this file shares this exact shape —
 * only name/title/type/readOnly/searchParams vary.
 */
function makeBlueprintAttribute({
  name,
  title,
  type = "string",
  readOnly = false,
  searchParams = [],
}: {
  name: string;
  title: string;
  type?: string;
  readOnly?: boolean;
  searchParams?: BlueprintSearchParam[];
}) {
  return {
    name,
    title,
    type,
    readOnly,
    _embedded: { "blueprint:constraint": [], "blueprint:search-param": searchParams },
    _links: {},
  };
}

// Mirrors the HAL-FORMS property `type` values (`HalFormsPropertyType` in
// @contentgrid/hal-forms/shape) without importing that Layer-1 package
// directly from this feature (see packages/features/CLAUDE.md).
type HalFormsPropertyTypeName =
  | "hidden"
  | "text"
  | "url"
  | "email"
  | "date"
  | "time"
  | "datetime"
  | "datetime-local"
  | "number"
  | "range"
  | "checkbox"
  | "radio"
  | "file";

interface SearchProperty {
  name: string;
  type: HalFormsPropertyTypeName;
  required?: boolean;
  /** Inline enumeration — makes buildFilterProperties render a "select" inputKind regardless
   * of `type` (see filter-properties.ts's buildFilterProperty). */
  options?: { inline: string[] };
}

/**
 * Per-entity profile handler builder for GET /profile/{plural}. Captures the
 * shape shared by every per-entity profile fixture in this file:
 * - `_links.self` / `describes` (collection + templated item link, no title —
 *   see invoiceProfileHandler's own note on why that matters) / `curies`
 *   (the `blueprint` curie needed to resolve `blueprint:attribute` /
 *   `blueprint:relation`).
 * - `_embedded["blueprint:attribute"]` plus a relations array. The relations
 *   key defaults to the plain curie form `"blueprint:relation"`, but can be
 *   overridden — invoiceProfileHandlerWithRelations uses the fully expanded
 *   `BLUEPRINT_RELATION_REL` URI instead.
 * - `_templates.search` (always present) and `_templates["create-form"]`
 *   (only when `createFormProperties` is given — its absence is what makes
 *   invoiceProfileHandlerNoCreate / invoiceProfileHandlerWithTypedFilters /
 *   invoiceProfileHandlerWithRelations / supplierProfileHandler /
 *   lineItemProfileHandler omit the Create affordance).
 */
function buildEntityProfileHandler({
  profileUrl,
  name,
  title,
  collectionUrl,
  attributes = [],
  relations,
  searchProperties = [],
  createFormProperties,
}: {
  profileUrl: string;
  name: string;
  title: string;
  collectionUrl: string;
  attributes?: ReadonlyArray<ReturnType<typeof makeBlueprintAttribute>>;
  relations?: { key: string; items: readonly unknown[] };
  searchProperties?: SearchProperty[];
  createFormProperties?: SearchProperty[];
}) {
  return createProfileHandler({
    url: profileUrl,
    body: {
      name,
      title,
      _links: {
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
      },
      _embedded: {
        "blueprint:attribute": attributes,
        [relations?.key ?? "blueprint:relation"]: relations?.items ?? [],
      },
    },
    templates: {
      search: { method: "GET", target: collectionUrl, properties: searchProperties },
      ...(createFormProperties !== undefined
        ? {
            "create-form": {
              method: "POST",
              target: collectionUrl,
              properties: createFormProperties,
            },
          }
        : {}),
    },
  });
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
  return buildEntityProfileHandler({
    profileUrl: `${PROFILE_URL}/invoices`,
    name: "invoice",
    title: "Invoice",
    collectionUrl: `${API_URL}/invoices`,
    attributes: [
      makeBlueprintAttribute({ name: "id", title: "ID", readOnly: true }),
      makeBlueprintAttribute({ name: "number", title: "Invoice Number" }),
    ],
    createFormProperties: [{ name: "number", type: "text", required: true }],
  });
}

/**
 * Per-entity profile handler for /profile/invoices with a NON-EMPTY search
 * template — this is what makes FilterSidebar render (index.tsx:354-356:
 * `filterProperties` is empty, and the sidebar is not rendered at all, unless
 * `searchTemplate.searchProperties` is non-empty).
 *
 * Mix of search-param shapes to exercise the different toSearchProperty /
 * FilterSidebar branches:
 * - "status": exact-match text field (no suffix) -> plain TextFilter, handleFilterChange
 * - "number~prefix": prefix-match on a direct attribute -> TypeaheadTextFilter
 * - "customer.name~prefix": prefix-match over a relation traversal -> falls back
 *   to a plain TextFilter (packages/ui filter-sidebar.tsx relation-traversal guard)
 */
function invoiceProfileHandlerWithFilters() {
  return buildEntityProfileHandler({
    profileUrl: `${PROFILE_URL}/invoices`,
    name: "invoice",
    title: "Invoice",
    collectionUrl: `${API_URL}/invoices`,
    attributes: [
      makeBlueprintAttribute({ name: "id", title: "ID", readOnly: true }),
      // searchParams mirror _templates.search below so resolveSearchType (search-form.ts) resolves
      // via the real blueprint:search-param path instead of falling back to suffix parsing —
      // "customer.name~prefix" is a relation-traversal property and can't resolve a profileAttribute
      // on the invoice profile at all (see enhanceSearchProperty's class-level doc comment), so it's
      // left on suffix parsing as that's the only path available for it in production too.
      makeBlueprintAttribute({
        name: "number",
        title: "Number",
        searchParams: [{ name: "number~prefix", title: "Number prefix", type: "prefix-match" }],
      }),
      makeBlueprintAttribute({
        name: "status",
        title: "Status",
        searchParams: [{ name: "status", title: "Status", type: "exact-match" }],
      }),
    ],
    // Needed so profileEntity.getRelation("customer") resolves for the "customer.name~prefix"
    // search property below — without it, ProfileRelation stays undefined and the relation
    // typeahead can never resolve a target profile, regardless of what the test registers for
    // GET /profile/customers.
    relations: {
      key: "blueprint:relation",
      items: [
        {
          name: "customer",
          title: "Customer",
          description: "",
          required: false,
          many_source_per_target: false,
          many_target_per_source: false,
          _links: {
            self: { href: `${PROFILE_URL}/invoices/relations/customer` },
            "https://contentgrid.cloud/rels/blueprint/target-entity": {
              href: `${PROFILE_URL}/customers`,
              name: "customer",
              title: "Customer",
            },
          },
        },
      ],
    },
    searchProperties: [
      { name: "number~prefix", type: "text" },
      { name: "status", type: "text" },
      { name: "customer.name~prefix", type: "text" },
    ],
    createFormProperties: [{ name: "number", type: "text", required: true }],
  });
}

// Number/checkbox/datetime typed search properties — kept separate from
// invoiceProfileHandlerWithFilters (used by many other tests) so this fixture can be
// changed freely. blueprint:attribute entries are omitted; labels fall back to
// formatFieldName since buildFilterProperties derives inputKind from property.type only.
function invoiceProfileHandlerWithTypedFilters() {
  return buildEntityProfileHandler({
    profileUrl: `${PROFILE_URL}/invoices`,
    name: "invoice",
    title: "Invoice",
    collectionUrl: `${API_URL}/invoices`,
    // Titles match formatFieldName's own fallback output for these names exactly ("Amount",
    // "Paid", "Due At"), so adding real blueprint:attribute entries — which makes
    // resolveSearchType (search-form.ts) resolve via blueprint:search-param instead of falling
    // back to suffix parsing — doesn't change any dependent test's expected label.
    attributes: [
      makeBlueprintAttribute({
        name: "amount",
        title: "Amount",
        type: "long",
        searchParams: [{ name: "amount", title: "Amount", type: "exact-match" }],
      }),
      makeBlueprintAttribute({
        name: "paid",
        title: "Paid",
        type: "boolean",
        searchParams: [{ name: "paid", title: "Paid", type: "exact-match" }],
      }),
      makeBlueprintAttribute({
        name: "due_at",
        title: "Due At",
        type: "datetime",
        searchParams: [{ name: "due_at", title: "Due At", type: "exact-match" }],
      }),
    ],
    searchProperties: [
      { name: "amount", type: "number" },
      { name: "paid", type: "checkbox" },
      { name: "due_at", type: "datetime" },
    ],
  });
}

// Kept separate from invoiceProfileHandlerWithTypedFilters (used by three other tests) so this
// fixture can be changed freely — same convention as invoiceProfileHandlerWithFilters vs.
// invoiceProfileHandlerWithTypedFilters above.
//
// "priority" is number-typed but carries inline options that are NOT numeric strings — an
// unusual but real-world-possible backend data shape (nothing stops a backend from declaring
// allowed-values on a number attribute using non-numeric labels). buildFilterProperties renders
// this as a "select" inputKind (inline options present) while propertyType stays "number" (see
// coerceFilterValue's own doc comment on exactly this case) — so picking "low" produces a value
// Number() can't coerce, THROUGH a real user interaction (a Select pick), not a forced DOM value.
function invoiceProfileHandlerWithBadEnumOptions() {
  return buildEntityProfileHandler({
    profileUrl: `${PROFILE_URL}/invoices`,
    name: "invoice",
    title: "Invoice",
    collectionUrl: `${API_URL}/invoices`,
    searchProperties: [
      { name: "priority", type: "number", options: { inline: ["low", "medium", "high"] } },
    ],
  });
}

function invoiceProfileHandlerNoCreate() {
  return buildEntityProfileHandler({
    profileUrl: `${PROFILE_URL}/invoices`,
    name: "invoice",
    title: "Invoice",
    collectionUrl: `${API_URL}/invoices`,
    // no create-form
  });
}

function customerProfileHandler(
  overrides: {
    attributes?: ReadonlyArray<ReturnType<typeof makeBlueprintAttribute>>;
    searchProperties?: SearchProperty[];
  } = {},
) {
  return buildEntityProfileHandler({
    profileUrl: `${PROFILE_URL}/customers`,
    name: "customer",
    title: "Customer",
    collectionUrl: `${API_URL}/customers`,
    attributes: overrides.attributes ?? [],
    searchProperties: overrides.searchProperties ?? [],
  });
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

  // The second page's own href (registered via clicking Next below) fails
  // server-side — e.g. the underlying cursor expired between the click and
  // the fetch. The first-page request must keep succeeding.
  function failingSecondPageHandler() {
    const nextPageUrl = `${API_URL}/invoices?_cursor=nexttoken`;
    return http.get(`${API_URL}/invoices`, ({ request }) => {
      const cursor = new URL(request.url).searchParams.get("_cursor");
      if (cursor === "nexttoken") return HttpResponse.json(null, { status: 400 });
      return HttpResponse.json({
        _links: { self: { href: `${API_URL}/invoices` }, next: { href: nextPageUrl } },
        _embedded: { item: sampleInvoiceItems },
        page: { size: 3, total_items_exact: 4 },
      });
    });
  }

  it("offers a reset to the first page when a registered cursor's page fails to load", async () => {
    server.use(profileRootHandler(), invoiceProfileHandler(), failingSecondPageHandler());

    renderEntityList("/invoice");

    const nextButton = await screen.findByRole("button", { name: "Next" });

    // The failing second-page query still hardcodes retry: 3 (fetchByUrlQuery)
    // regardless of the test QueryClient's retry: false default — flush the
    // backoff with fake timers, as documented in navigator-data/CLAUDE.md.
    // fireEvent (not userEvent) avoids racing its own internal real-timer waits
    // against the fake ones.
    vi.useFakeTimers();
    fireEvent.click(nextButton);
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back to first page/i })).toBeInTheDocument();
  });

  it("recovers to the first page when the reset action is clicked", async () => {
    server.use(profileRootHandler(), invoiceProfileHandler(), failingSecondPageHandler());

    renderEntityList("/invoice");

    const nextButton = await screen.findByRole("button", { name: "Next" });

    vi.useFakeTimers();
    fireEvent.click(nextButton);
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    const resetButton = await screen.findByRole("button", { name: /back to first page/i });
    fireEvent.click(resetButton);

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

  it("clicking Next fetches and renders the next page's data", async () => {
    const user = userEvent.setup();
    const nextPageUrl = `${API_URL}/invoices?_cursor=nexttoken`;

    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      // Single dynamic handler on the pathname — branches on the `_cursor` query
      // param instead of registering two handlers that only differ by query string
      // (MSW matches paths, not query strings, and warns/misbehaves otherwise).
      http.get(`${API_URL}/invoices`, ({ request }) => {
        const isPage2 = new URL(request.url).searchParams.get("_cursor") === "nexttoken";
        return HttpResponse.json({
          _links: isPage2
            ? { self: { href: nextPageUrl } }
            : { self: { href: `${API_URL}/invoices` }, next: { href: nextPageUrl } },
          _embedded: {
            item: isPage2
              ? [{ id: "inv-004", number: "INV-2024-004", _links: { self: {} } }]
              : sampleInvoiceItems,
          },
          page: isPage2 ? { size: 1, total_items_exact: 4 } : { size: 3, total_items_exact: 4 },
        });
      }),
    );

    const { router } = renderEntityList("/invoice");

    // Next and Previous pagination buttons appear
    const nextButton = await screen.findByRole("button", { name: "Next" });
    const prevButton = screen.getByRole("button", { name: "Previous" });

    // Previous is disabled (no prev on first page), Next is enabled
    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    await user.click(nextButton);

    // The next page's distinct row proves the click actually fetched the next-page
    // URL, not just that the button remained in the DOM after being clicked.
    expect(await screen.findByText("INV-2024-004")).toBeInTheDocument();

    // The browser URL must carry only the opaque `_cursor` token from
    // nextHref — never the href itself — under the `cursor` search param.
    expect(router.state.location.search).toEqual({ cursor: "nexttoken" });
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
    await user.click(await screen.findByRole("button", { name: "Invoice" }));
    expect(await screen.findByText("All entities")).toBeInTheDocument();
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

    // Heading is "{pluralName} detail" — invoiceProfileHandler's plural name falls
    // back to the cg:entity link title, "Invoice" (see its own doc comment above).
    expect(await screen.findByText("Invoice detail")).toBeInTheDocument();
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
  return buildRootProfileHandler([
    { href: `${PROFILE_URL}/invoices`, name: "invoice", title: "Invoice" },
    { href: SUPPLIER_PROFILE_URL, name: "supplier", title: "Supplier" },
    { href: LINE_ITEM_PROFILE_URL, name: "lineItem", title: "Line Item" },
  ]);
}

function invoiceProfileHandlerWithRelations() {
  return buildEntityProfileHandler({
    profileUrl: `${PROFILE_URL}/invoices`,
    name: "invoice",
    title: "Invoice",
    collectionUrl: `${API_URL}/invoices`,
    attributes: [makeBlueprintAttribute({ name: "number", title: "Invoice Number" })],
    relations: {
      key: BLUEPRINT_RELATION_REL,
      items: [
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
  });
}

function supplierProfileHandler() {
  return buildEntityProfileHandler({
    profileUrl: SUPPLIER_PROFILE_URL,
    name: "supplier",
    title: "Supplier",
    collectionUrl: SUPPLIERS_COLLECTION_URL,
    attributes: [
      makeBlueprintAttribute({
        name: "name",
        title: "Name",
        searchParams: [{ name: "name~prefix", title: "Name prefix", type: "prefix-match" }],
      }),
    ],
    searchProperties: [{ name: "name~prefix", type: "text" }],
  });
}

function lineItemProfileHandler() {
  return buildEntityProfileHandler({
    profileUrl: LINE_ITEM_PROFILE_URL,
    name: "lineItem",
    title: "Line Item",
    collectionUrl: LINE_ITEMS_COLLECTION_URL,
    attributes: [
      makeBlueprintAttribute({
        name: "description",
        title: "Description",
        searchParams: [
          { name: "description~prefix", title: "Description prefix", type: "prefix-match" },
        ],
      }),
    ],
    searchProperties: [{ name: "description~prefix", type: "text" }],
  });
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

  it("does not flash the previous search's results while a new search is loading", async () => {
    const user = userEvent.setup();
    const itemId = "inv-one-link-restale";
    const itemUrl = `${API_URL}/invoices/${itemId}`;
    const supplierRelationUrl = `${itemUrl}/supplier`;

    // Gates the "Widget" response so the test can assert on the in-between state —
    // while that search is in flight — before letting it resolve.
    let releaseWidgetResponse = () => {};
    const widgetResponseGate = new Promise<void>((resolve) => {
      releaseWidgetResponse = resolve;
    });

    server.use(
      profileRootWithRelationsHandler(),
      invoiceProfileHandlerWithRelations(),
      supplierProfileHandler(),
      lineItemProfileHandler(),
      http.get(itemUrl, () => HttpResponse.json(makeInvoiceItemWithSupplier(itemId))),
      http.get(supplierRelationUrl, () => notFoundProblem()),
      http.get(SUPPLIERS_COLLECTION_URL, async ({ request }) => {
        const query = new URL(request.url).searchParams.get("name~prefix") ?? "";
        const supplierResult = (id: string, name: string) => ({
          id,
          name,
          _links: { self: { href: `${SUPPLIERS_COLLECTION_URL}/${id}` } },
        });
        if (query === "Widget") {
          await widgetResponseGate;
          return HttpResponse.json({
            _embedded: { item: [supplierResult("sup-002", "Widget Co")] },
            _links: { self: { href: SUPPLIERS_COLLECTION_URL } },
            page: { size: 1, total_items_exact: 1 },
          });
        }
        return HttpResponse.json({
          _embedded: { item: [supplierResult("sup-001", "Acme Corp")] },
          _links: { self: { href: SUPPLIERS_COLLECTION_URL } },
          page: { size: 1, total_items_exact: 1 },
        });
      }),
    );

    renderEntityList(`/invoice/${itemId}`);
    await screen.findByText("No item linked");
    await user.click(screen.getByRole("button", { name: "Link" }));

    const searchInput = await screen.findByPlaceholderText(/Search Supplier/);
    await user.type(searchInput, "Acme");
    expect(await screen.findByText("Acme Corp")).toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, "Widget");

    // While the "Widget" search is in flight, the dialog must not keep showing the
    // stale "Acme Corp" result from the previous search.
    await waitFor(() => expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument());

    releaseWidgetResponse();
    expect(await screen.findByText("Widget Co")).toBeInTheDocument();
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

// ----------------------------------------------------------------
// EntityDetailView filters — FilterSidebar / typeahead integration (ACC-2889)
// ----------------------------------------------------------------

describe("EntityDetailView filters", () => {
  function invoicesCollectionHandler(
    onRequest: (url: URL) => void,
    itemsForUrl?: (url: URL) => Record<string, unknown>[],
  ) {
    return http.get(`${API_URL}/invoices`, ({ request }) => {
      const url = new URL(request.url);
      onRequest(url);
      const items = itemsForUrl ? itemsForUrl(url) : sampleInvoiceItems;
      return HttpResponse.json({
        _links: { self: { href: `${API_URL}/invoices` } },
        _embedded: { item: items },
        page: { size: items.length, total_items_exact: items.length },
      });
    });
  }

  it("renders the FilterSidebar with filter inputs when the search template has properties", async () => {
    server.use(
      profileRootHandler(),
      invoiceProfileHandlerWithFilters(),
      invoicesCollectionHandler(() => {}),
    );

    renderEntityList("/invoice");

    expect(await screen.findByText("Filters")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Number")).toBeInTheDocument();
    expect(screen.getByLabelText("Customer Name")).toBeInTheDocument();
  });

  it("does not render the FilterSidebar when the search template has no properties", async () => {
    server.use(profileRootHandler(), invoiceProfileHandler(), emptyInvoicesList);

    renderEntityList("/invoice");

    await screen.findByText("All entities");
    expect(screen.queryByText("Filters")).not.toBeInTheDocument();
  });

  it("updates active filters and refetches when typing in an exact-match filter, resetting the cursor", async () => {
    const user = userEvent.setup();
    const capturedUrls: URL[] = [];
    const nextPageUrl = `${API_URL}/invoices?_cursor=stale`;

    server.use(
      profileRootHandler(),
      invoiceProfileHandlerWithFilters(),
      // Single dynamic handler on the pathname — branches on the `_cursor` query
      // param (MSW matches paths, not query strings).
      http.get(`${API_URL}/invoices`, ({ request }) => {
        const url = new URL(request.url);
        capturedUrls.push(url);
        const isPage2 = url.searchParams.get("_cursor") === "stale";
        return HttpResponse.json({
          _links: isPage2
            ? { self: { href: nextPageUrl } }
            : { self: { href: `${API_URL}/invoices` }, next: { href: nextPageUrl } },
          _embedded: { item: isPage2 ? [] : sampleInvoiceItems },
          page: isPage2 ? { size: 0, total_items_exact: 4 } : { size: 3, total_items_exact: 4 },
        });
      }),
    );

    const { router } = renderEntityList("/invoice");

    // Start with an active, registered cursor (via a real Next click): typing in a
    // filter must reset it (handleFilterChange calls onCursorChange(undefined)), so
    // the request that follows hits the base collection URL rather than the
    // now-stale cursor href.
    const nextButton = await screen.findByRole("button", { name: "Next" });
    await user.click(nextButton);
    expect(router.state.location.search).toEqual({ cursor: "stale" });

    const statusInput = await screen.findByLabelText("Status");
    await user.type(statusInput, "open");

    await waitFor(() => {
      const last = capturedUrls[capturedUrls.length - 1];
      expect(last?.searchParams.get("status")).toBe("open");
    });

    expect(statusInput).toHaveValue("open");
    expect(router.state.location.search).toEqual({});
  });

  it("shows Clear all once a filter is active and clears it on click", async () => {
    const user = userEvent.setup();
    const capturedUrls: URL[] = [];

    server.use(
      profileRootHandler(),
      invoiceProfileHandlerWithFilters(),
      invoicesCollectionHandler((url) => capturedUrls.push(url)),
    );

    renderEntityList("/invoice");

    const statusInput = await screen.findByLabelText("Status");
    await user.type(statusInput, "open");

    // A request carrying the active filter must have been made before we clear it.
    await waitFor(() =>
      expect(capturedUrls.some((u) => u.searchParams.get("status") === "open")).toBe(true),
    );

    const clearAllButton = await screen.findByRole("button", { name: /clear all/i });
    await user.click(clearAllButton);

    await waitFor(() => expect(statusInput).toHaveValue(""));
    expect(screen.queryByRole("button", { name: /clear all/i })).not.toBeInTheDocument();
  });

  it("renders typeahead suggestions when typing in a prefix-match filter", async () => {
    const user = userEvent.setup();

    server.use(
      profileRootHandler(),
      invoiceProfileHandlerWithFilters(),
      invoicesCollectionHandler(
        () => {},
        (url) =>
          url.searchParams.get("number~prefix")
            ? [
                {
                  id: "inv-999",
                  // Deliberately distinct from sampleInvoiceItems' numbers so the
                  // suggestion text is unambiguous (not also present as a table row).
                  number: "INV-2024-999",
                  _links: { self: { href: `${API_URL}/invoices/inv-999` } },
                },
              ]
            : sampleInvoiceItems,
      ),
    );

    renderEntityList("/invoice");

    const numberInput = await screen.findByLabelText("Number");
    await user.type(numberInput, "INV");

    // The suggestion also surfaces as a table row (typing sets the number~prefix
    // filter too), so scope the assertion to the suggestions listbox.
    const listbox = await screen.findByRole(
      "listbox",
      { name: /number suggestions/i },
      { timeout: 3000 },
    );
    expect(
      await within(listbox).findByText("INV-2024-999", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
  });

  it("opens a typeahead popover for a relation-traversal prefix filter, querying the related entity's own collection", async () => {
    const user = userEvent.setup();
    const customerRequestUrls: URL[] = [];

    server.use(
      profileRootWithTwoEntitiesHandler(),
      invoiceProfileHandlerWithFilters(),
      customerProfileHandler({
        attributes: [makeBlueprintAttribute({ name: "name", title: "Name" })],
        searchProperties: [{ name: "name~prefix", type: "text" }],
      }),
      invoicesCollectionHandler(() => {}),
      http.get(`${API_URL}/customers`, ({ request }) => {
        customerRequestUrls.push(new URL(request.url));
        return HttpResponse.json({
          _links: { self: { href: `${API_URL}/customers` } },
          _embedded: {
            item: [
              {
                id: "cust-001",
                name: "Acme Corp",
                _links: { self: { href: `${API_URL}/customers/cust-001` } },
              },
            ],
          },
          page: { size: 1, total_items_exact: 1 },
        });
      }),
    );

    renderEntityList("/invoice");

    const customerInput = await screen.findByLabelText("Customer Name");
    await user.type(customerInput, "Acme");

    // Proves the relation typeahead actually resolves the target profile and queries ITS
    // collection (useTypeahead's relation mode) rather than never opening at all — the
    // suggestion text ("Acme Corp") only exists on the customer fixture, not on any invoice.
    const listbox = await screen.findByRole("listbox", { name: /customer name suggestions/i });
    expect(await within(listbox).findByText("Acme Corp")).toBeInTheDocument();
    expect(customerRequestUrls.some((u) => u.searchParams.get("name~prefix") === "Acme")).toBe(
      true,
    );
  });

  // Regression coverage for a real crash: the HAL-FORMS codec requires a JS number for
  // "number", a JS boolean for "checkbox", and a JS Date for "datetime" — passing the raw
  // string from the input used to throw (HalFormValueTypeError / RangeError: Invalid time
  // value) as soon as any of these filters were touched. applyFilterValues fixes this.
  // This is an end-to-end regression guard, not a duplicate of applyFilterValues's own unit
  // tests in filter-properties.test.ts — those prove the coercion function works in
  // isolation, but not that EntityDetailView is actually wired through it (the original bug
  // was in the wiring, not in coerceFilterValue itself).
  function renderInvoicesWithTypedFilters() {
    const capturedUrls: URL[] = [];
    server.use(
      profileRootHandler(),
      invoiceProfileHandlerWithTypedFilters(),
      invoicesCollectionHandler((url) => capturedUrls.push(url)),
    );
    renderEntityList("/invoice");
    return capturedUrls;
  }

  it("sends a coerced numeric value for a number filter without crashing", async () => {
    const user = userEvent.setup();
    const capturedUrls = renderInvoicesWithTypedFilters();

    const amountInput = await screen.findByLabelText("Amount");
    expect(amountInput).toHaveAttribute("type", "number");
    await user.type(amountInput, "100");

    await waitFor(() => {
      const last = capturedUrls[capturedUrls.length - 1];
      expect(last?.searchParams.get("amount")).toBe("100");
    });
    expect(screen.getByText("All entities")).toBeInTheDocument();
  });

  // Regression coverage for ACC-2889's follow-up: a value the codec can't take used to be
  // dropped from the request with no visible sign — the user had no idea why the table wasn't
  // actually filtering. findInvalidFilterKeys + FilterSidebar's invalidFilterKeys prop now
  // surface it.
  //
  // This can't be reached by typing into a real <input type="number">: the browser's own
  // constraint validation (jsdom included, verified directly) sanitises anything it doesn't
  // recognise as a valid floating-point string back to "" before an onChange handler ever sees
  // it — even bypassing React via the native value setter doesn't get an invalid string
  // through, since jsdom enforces the same constraint on read. The realistic path is a
  // "select" control on a number-typed attribute whose own declared allowed-values aren't
  // numeric strings (see invoiceProfileHandlerWithBadEnumOptions) — a real click, not a forced
  // DOM value.
  it("shows an inline error for a select value that fails to coerce for its number wire type", async () => {
    const user = userEvent.setup();
    const capturedUrls: URL[] = [];
    server.use(
      profileRootHandler(),
      invoiceProfileHandlerWithBadEnumOptions(),
      invoicesCollectionHandler((url) => capturedUrls.push(url)),
    );
    renderEntityList("/invoice");

    await user.click(await screen.findByRole("combobox", { name: /priority/i }));
    await user.click(await screen.findByRole("option", { name: "Low" }));

    // Re-query rather than reuse the earlier reference: EnumFilter's <Select key={value}>
    // remounts the trigger when the value changes, so a captured-before-the-click node would
    // be a stale, detached element by this point.
    expect(await screen.findByText("Enter a valid number")).toBeInTheDocument();
    expect(await screen.findByRole("combobox", { name: /priority/i })).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    // The invalid value must never reach the request — same guarantee applyFilterValues
    // already gave, now paired with a visible reason instead of a silent omission.
    await waitFor(() => {
      expect(capturedUrls.some((u) => u.searchParams.has("priority"))).toBe(false);
    });
  });

  it("sends a coerced boolean value for a checkbox filter without crashing", async () => {
    const user = userEvent.setup();
    const capturedUrls = renderInvoicesWithTypedFilters();

    const paidCheckbox = await screen.findByRole("checkbox", { name: /paid/i });
    await user.click(paidCheckbox);

    await waitFor(() => {
      const last = capturedUrls[capturedUrls.length - 1];
      expect(last?.searchParams.get("paid")).toBe("true");
    });
    expect(screen.getByText("All entities")).toBeInTheDocument();
  });

  it("sends a coerced ISO datetime value for a datetime filter without crashing", async () => {
    const capturedUrls = renderInvoicesWithTypedFilters();

    const dueAtInput = await screen.findByLabelText("Due At");
    expect(dueAtInput).toHaveAttribute("type", "datetime-local");
    fireEvent.change(dueAtInput, { target: { value: "2024-01-15T10:30" } });

    await waitFor(() => {
      const sent = capturedUrls[capturedUrls.length - 1]?.searchParams.get("due_at");
      expect(sent).toBeTruthy();
      expect(Number.isNaN(new Date(sent!).getTime())).toBe(false);
    });
    expect(screen.getByText("All entities")).toBeInTheDocument();
  });
});
