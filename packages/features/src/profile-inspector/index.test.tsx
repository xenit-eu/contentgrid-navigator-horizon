import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";
import { server } from "../../test-setup";
import { ProfileInspector } from "./index";

const API_URL = "https://api.example.com";
const PROFILE_URL = `${API_URL}/profile`;

const noopSupplier: AuthenticationTokenSupplier = async () => null;
const noopGetToken = async () => null;

function renderProfileInspector() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const apiFetch = createApiClient(noopSupplier);
  const contentFetch = createContentClient(noopSupplier);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={apiFetch}
          contentFetch={contentFetch}
          getToken={noopGetToken}
          profileUrl={PROFILE_URL}
        >
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  }

  return render(<ProfileInspector />, { wrapper: Wrapper });
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
        "cg:entity": [
          { href: `${PROFILE_URL}/invoices`, name: "invoice", title: "Invoice" },
          { href: `${PROFILE_URL}/customers`, name: "customer", title: "Customer" },
        ],
      },
    }),
  );
}

function invoiceProfileHandler() {
  return http.get(`${PROFILE_URL}/invoices`, () =>
    HttpResponse.json({
      name: "invoice",
      title: "Invoice",
      description: "An invoice document",
      _links: {
        self: { href: `${PROFILE_URL}/invoices` },
        describes: [
          { href: `${API_URL}/invoices`, name: "collection", title: "Invoices" },
          { href: `${API_URL}/invoices/{id}`, name: "item", title: "Invoice", templated: true },
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
            _embedded: {
              "blueprint:constraint": [],
              "blueprint:search-param": [
                {
                  name: "exact-match",
                  _links: {},
                },
              ],
            },
            _links: {},
          },
          {
            name: "invoice_number",
            title: "Invoice Number",
            type: "string",
            readOnly: false,
            _embedded: {
              "blueprint:constraint": [
                {
                  type: "required",
                  _links: {},
                },
                {
                  type: "unique",
                  _links: {},
                },
              ],
              "blueprint:search-param": [
                {
                  name: "exact-match",
                  _links: {},
                },
                {
                  name: "prefix-match",
                  _links: {},
                },
              ],
            },
            _links: {},
          },
        ],
        "blueprint:relation": [
          {
            name: "customer",
            title: "Customer",
            many_source_per_target: true,
            many_target_per_source: false,
            _embedded: {
              "blueprint:constraint": [
                {
                  type: "required",
                  _links: {},
                },
              ],
            },
            _links: {
              "blueprint:target-entity": {
                href: `${PROFILE_URL}/customers`,
              },
            },
          },
        ],
      },
      _templates: {
        search: {
          method: "GET",
          target: `${API_URL}/invoices`,
          properties: [
            { name: "id", type: "text" },
            { name: "invoice_number", type: "text" },
          ],
        },
        "create-form": {
          method: "POST",
          target: `${API_URL}/invoices`,
          properties: [{ name: "invoice_number", type: "text", required: true }],
        },
      },
    }),
  );
}

function customerProfileHandler() {
  return http.get(`${PROFILE_URL}/customers`, () =>
    HttpResponse.json({
      name: "customer",
      title: "Customer",
      description: "A customer entity",
      _links: {
        self: { href: `${PROFILE_URL}/customers` },
        describes: [
          { href: `${API_URL}/customers`, name: "collection", title: "Customers" },
          { href: `${API_URL}/customers/{id}`, name: "item", title: "Customer", templated: true },
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
        ],
        "blueprint:relation": [],
      },
      _templates: {},
    }),
  );
}

describe("ProfileInspector", () => {
  it("renders all profiles with their details", async () => {
    server.use(profileRootHandler(), invoiceProfileHandler(), customerProfileHandler());

    renderProfileInspector();

    expect(await screen.findByText("Profile Inspector")).toBeInTheDocument();
    // Component renders "{loaded} of {total} profile(s) loaded" once all per-entity
    // queries complete (the rewritten hook fetches each profile individually).
    expect(await screen.findByText("2 of 2 profile(s) loaded")).toBeInTheDocument();
    expect(screen.getByText("Invoice")).toBeInTheDocument();
    expect(screen.getByText("Customer")).toBeInTheDocument();
  });

  it("shows profile attributes and relations", async () => {
    server.use(profileRootHandler(), invoiceProfileHandler(), customerProfileHandler());

    renderProfileInspector();

    expect(await screen.findByText("Invoice")).toBeInTheDocument();

    // Each loaded ProfileCard has its own "Attributes" collapsible trigger, so
    // there is one "Attributes" label per profile (2 profiles → 2 elements).
    // Use getAllByText and assert on the first one (Invoice card).
    const attributesAccordions = screen.getAllByText("Attributes");
    expect(attributesAccordions.length).toBeGreaterThanOrEqual(1);
    // The Invoice card has 2 attributes (id + invoice_number)
    expect(attributesAccordions[0].parentElement).toHaveTextContent("2");
  });

  it("shows an empty state when no profiles are found", async () => {
    server.use(
      http.get(PROFILE_URL, () => HttpResponse.json({ _links: { self: { href: PROFILE_URL } } })),
    );

    renderProfileInspector();

    expect(await screen.findByText("No profiles found.")).toBeInTheDocument();
  });

  it("shows an error message when the profile root request fails", async () => {
    server.use(http.get(PROFILE_URL, () => HttpResponse.json(null, { status: 500 })));

    renderProfileInspector();

    // ProfileInspector now watches the root query directly so it can surface
    // root-level errors as "Failed to load profiles: ..." rather than silently
    // falling through to "No profiles found."
    expect(await screen.findByText(/Failed to load profiles/)).toBeInTheDocument();
  });

  it("shows loading state while fetching profiles", () => {
    server.use(
      http.get(PROFILE_URL, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return HttpResponse.json({ _links: { self: { href: PROFILE_URL } } });
      }),
    );

    renderProfileInspector();

    expect(screen.getByText("Loading profiles…")).toBeInTheDocument();
  });

  it("opens the Attributes collapsible to show attribute details", async () => {
    const user = userEvent.setup();
    server.use(profileRootHandler(), invoiceProfileHandler(), customerProfileHandler());

    renderProfileInspector();

    // Wait for profile to load
    await screen.findByText("Invoice");

    // Find and click the Attributes trigger on the Invoice card
    const triggers = screen.getAllByText("Attributes");
    // Each ProfileCard has one "Attributes" trigger; Invoice is first
    await user.click(triggers[0]);

    // Inside the collapsible: attribute names appear in font-mono spans
    expect(screen.getAllByText("invoice_number").length).toBeGreaterThan(0);
    // Title shows in the attribute detail line "Title: Invoice Number"
    expect(screen.getByText(/Title: Invoice Number/)).toBeInTheDocument();
  });

  it("opens the User-Defined Attributes collapsible", async () => {
    const user = userEvent.setup();
    server.use(profileRootHandler(), invoiceProfileHandler(), customerProfileHandler());

    renderProfileInspector();

    await screen.findByText("Invoice");

    const triggers = screen.getAllByText("User-Defined Attributes");
    await user.click(triggers[0]);

    // invoice_number is a user-defined attribute (id is readOnly)
    // Both are in the invoice profile; invoice_number is user-defined
    expect(screen.getAllByText("invoice_number").length).toBeGreaterThan(0);
  });

  it("opens the Relations collapsible to show relation details", async () => {
    const user = userEvent.setup();
    server.use(profileRootHandler(), invoiceProfileHandler(), customerProfileHandler());

    renderProfileInspector();

    await screen.findByText("Invoice");

    // Click the Relations trigger on the Invoice card
    const triggers = screen.getAllByText("Relations");
    await user.click(triggers[0]);

    // Invoice has a "customer" relation — "customer" may appear multiple times
    // (relation name + Customer profile card); use getAllByText
    expect(screen.getAllByText("customer").length).toBeGreaterThan(0);
    // Relation is to-one (many_source_per_target=true, many_target_per_source=false)
    expect(screen.getByText("to-one")).toBeInTheDocument();
  });

  it("opens the Audit Attributes collapsible", async () => {
    const user = userEvent.setup();
    server.use(profileRootHandler(), invoiceProfileHandler(), customerProfileHandler());

    renderProfileInspector();

    await screen.findByText("Invoice");

    const triggers = screen.getAllByText("Audit Attributes");
    await user.click(triggers[0]);

    // Invoice has no audit attributes — shows "No audit attributes configured"
    expect(screen.getAllByText("No audit attributes configured").length).toBeGreaterThan(0);
  });

  it("opens the Search Template collapsible to show search properties", async () => {
    const user = userEvent.setup();
    server.use(profileRootHandler(), invoiceProfileHandler(), customerProfileHandler());

    renderProfileInspector();

    await screen.findByText("Invoice");

    const triggers = screen.getAllByText("Search Template");
    await user.click(triggers[0]);

    // Search template method and target appear in the content area
    expect(screen.getAllByText(/Method: GET/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Target:/).length).toBeGreaterThan(0);
    // The search properties are rendered
    expect(screen.getAllByText("Search Properties").length).toBeGreaterThan(0);
  });

  it("shows 'No search template available' when profile has no search template", async () => {
    const user = userEvent.setup();

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
            "cg:entity": [
              { href: `${PROFILE_URL}/documents`, name: "document", title: "Document" },
            ],
          },
        }),
      ),
      http.get(`${PROFILE_URL}/documents`, () =>
        HttpResponse.json({
          name: "document",
          title: "Document",
          _links: {
            self: { href: `${PROFILE_URL}/documents` },
            describes: [
              { href: `${API_URL}/documents`, name: "collection" },
              { href: `${API_URL}/documents/{id}`, name: "item", templated: true },
            ],
            curies: [
              {
                name: "blueprint",
                href: "https://contentgrid.cloud/rels/blueprint/{rel}",
                templated: true,
              },
            ],
          },
          _embedded: { "blueprint:attribute": [], "blueprint:relation": [] },
          _templates: {}, // no search, no create
        }),
      ),
    );

    renderProfileInspector();

    // "Document" appears in CardTitle and CardDescription — use findAllByText
    expect(await screen.findAllByText("Document")).toBeTruthy();

    const triggers = screen.getAllByText("Search Template");
    await user.click(triggers[0]);

    expect(screen.getAllByText("No search template available").length).toBeGreaterThan(0);
  });

  it("opens the Create Template collapsible to show create properties", async () => {
    const user = userEvent.setup();
    server.use(profileRootHandler(), invoiceProfileHandler(), customerProfileHandler());

    renderProfileInspector();

    await screen.findByText("Invoice");

    const triggers = screen.getAllByText("Create Template");
    await user.click(triggers[0]);

    // Create template content appears
    expect(screen.getAllByText(/Method: POST/).length).toBeGreaterThan(0);
    // User-defined attributes section appears
    expect(screen.getAllByText(/User-Defined Attributes/).length).toBeGreaterThan(0);
  });

  it("opens the Raw Link Object collapsible", async () => {
    const user = userEvent.setup();
    server.use(profileRootHandler(), invoiceProfileHandler(), customerProfileHandler());

    renderProfileInspector();

    await screen.findByText("Invoice");

    const triggers = screen.getAllByText("Raw Link Object");
    await user.click(triggers[0]);

    // Raw link shows JSON with "href"
    const preElements = document.querySelectorAll("pre");
    expect(preElements.length).toBeGreaterThan(0);
  });

  it("shows partial load state with loading skeleton when some profiles are still loading", async () => {
    // Hold the customer profile response to keep it in pending state while invoice loads
    let releaseCustomer: (() => void) | undefined;
    const customerPending = new Promise<void>((resolve) => {
      releaseCustomer = resolve;
    });

    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      http.get(`${PROFILE_URL}/customers`, async () => {
        await customerPending;
        return HttpResponse.json({ name: "customer", _links: {}, _embedded: {} });
      }),
    );

    renderProfileInspector();

    // Wait for invoice to load (1 of 2 loaded, customer still pending)
    expect(await screen.findByText("1 of 2 profile(s) loaded")).toBeInTheDocument();

    // Loading skeleton card should show for the pending customer profile
    expect(screen.getByText("Loading profile...")).toBeInTheDocument();
    // Shows how many are still loading
    expect(screen.getByText(/Loading 1 profile/)).toBeInTheDocument();

    // Unblock customer so test cleanup doesn't hang
    releaseCustomer!();
  });

  it("shows 'No create template available' when profile has no create-form", async () => {
    const user = userEvent.setup();

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
            "cg:entity": [{ href: `${PROFILE_URL}/tickets`, name: "ticket", title: "Ticket" }],
          },
        }),
      ),
      http.get(`${PROFILE_URL}/tickets`, () =>
        HttpResponse.json({
          name: "ticket",
          title: "Ticket",
          _links: {
            self: { href: `${PROFILE_URL}/tickets` },
            describes: [
              { href: `${API_URL}/tickets`, name: "collection" },
              { href: `${API_URL}/tickets/{id}`, name: "item", templated: true },
            ],
            curies: [
              {
                name: "blueprint",
                href: "https://contentgrid.cloud/rels/blueprint/{rel}",
                templated: true,
              },
            ],
          },
          _embedded: { "blueprint:attribute": [], "blueprint:relation": [] },
          _templates: {
            search: { method: "GET", target: `${API_URL}/tickets`, properties: [] },
            // no create-form
          },
        }),
      ),
    );

    renderProfileInspector();

    // "Ticket" appears in CardTitle and "Entity: ticket" in CardDescription — both fine
    expect(await screen.findAllByText("Ticket")).toBeTruthy();

    const triggers = screen.getAllByText("Create Template");
    await user.click(triggers[0]);

    expect(screen.getAllByText("No create template available").length).toBeGreaterThan(0);
  });
});
