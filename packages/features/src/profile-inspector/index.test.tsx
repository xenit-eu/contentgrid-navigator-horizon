import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  createApiClient,
} from "@contentgrid/navigator-data";
import { server } from "../../test-setup";
import { ProfileInspector } from "./index";

const API_URL = "https://api.example.com";
const PROFILE_URL = `${API_URL}/profile`;

const noopSupplier: AuthenticationTokenSupplier = async () => null;

function renderProfileInspector() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const apiFetch = createApiClient(noopSupplier);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider apiFetch={apiFetch} profileUrl={PROFILE_URL}>
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
    expect(await screen.findByText("2 profile(s) discovered")).toBeInTheDocument();
    expect(screen.getByText("Invoice")).toBeInTheDocument();
    expect(screen.getByText("Customer")).toBeInTheDocument();
  });

  it("shows profile attributes and relations", async () => {
    server.use(profileRootHandler(), invoiceProfileHandler(), customerProfileHandler());

    renderProfileInspector();

    expect(await screen.findByText("Invoice")).toBeInTheDocument();

    // Attributes accordion should show count
    const attributesAccordion = screen.getByText("Attributes");
    expect(attributesAccordion.parentElement).toHaveTextContent("2");
  });

  it("shows an error message when the profile request fails", async () => {
    server.use(http.get(PROFILE_URL, () => HttpResponse.json(null, { status: 500 })));

    renderProfileInspector();

    expect(await screen.findByText(/Failed to load profiles/)).toBeInTheDocument();
  });

  it("shows an empty state when no profiles are found", async () => {
    server.use(
      http.get(PROFILE_URL, () => HttpResponse.json({ _links: { self: { href: PROFILE_URL } } })),
    );

    renderProfileInspector();

    expect(await screen.findByText("No profiles found.")).toBeInTheDocument();
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
});
