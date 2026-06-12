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
import { sampleInvoiceItems } from "@contentgrid/navigator-data/test-fixtures/hal/fixtures";
import { createListHandler } from "@contentgrid/navigator-data/test-fixtures/msw/handlers";
import { server } from "../../test-setup";
import { EntityList } from "./index";

const API_URL = "https://api.example.com";
const PROFILE_URL = `${API_URL}/profile`;
const ROOT_URL = `${API_URL}/`;

const noopSupplier: AuthenticationTokenSupplier = async () => null;

function renderEntityList() {
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

  return render(<EntityList />, { wrapper: Wrapper });
}

/** Returns MSW handlers for both the root resource and profile root.
 * fetchProfile fetches GET / (for collection hrefs) and GET /profile (for profile hrefs) in parallel.
 */
function profileRootHandlers() {
  return [
    // Root resource — cg:entity links point at collections
    http.get(ROOT_URL, () =>
      HttpResponse.json({
        _links: {
          self: { href: ROOT_URL },
          curies: [
            {
              name: "cg",
              href: "https://contentgrid.cloud/rels/contentgrid/{rel}",
              templated: true,
            },
          ],
          "cg:entity": [{ href: `${API_URL}/invoices`, name: "invoice", title: "Invoice" }],
        },
      }),
    ),
    // Profile root — cg:entity links point at entity profiles
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
  ];
}

describe("EntityList", () => {
  it("renders entities discovered from the profile with their collection items", async () => {
    server.use(
      ...profileRootHandlers(),
      createListHandler({
        url: `${API_URL}/invoices`,
        items: sampleInvoiceItems,
        page: { size: 20, total_items_exact: sampleInvoiceItems.length },
      }),
    );

    renderEntityList();

    expect(await screen.findByText("Invoice")).toBeInTheDocument();
    expect(await screen.findByText("3 item(s)")).toBeInTheDocument();
    expect(screen.getByText("inv-001")).toBeInTheDocument();
    expect(screen.getByText("inv-003")).toBeInTheDocument();
  });

  it("shows an error message when the profile request fails", async () => {
    server.use(
      // Root resource succeeds; the profile itself fails
      http.get(ROOT_URL, () =>
        HttpResponse.json({ _links: { self: { href: ROOT_URL }, "cg:entity": [] } }),
      ),
      http.get(PROFILE_URL, () => HttpResponse.json(null, { status: 500 })),
    );

    renderEntityList();

    expect(await screen.findByText(/Failed to load entities/)).toBeInTheDocument();
  });

  it("shows an empty state when the profile exposes no entities", async () => {
    server.use(
      http.get(ROOT_URL, () =>
        HttpResponse.json({ _links: { self: { href: ROOT_URL }, "cg:entity": [] } }),
      ),
      http.get(PROFILE_URL, () => HttpResponse.json({ _links: { self: { href: PROFILE_URL } } })),
    );

    renderEntityList();

    expect(await screen.findByText("No entities found.")).toBeInTheDocument();
  });

  it("shows an item error message when a collection request fails", async () => {
    server.use(
      ...profileRootHandlers(),
      http.get(`${API_URL}/invoices`, () => HttpResponse.json(null, { status: 500 })),
    );

    renderEntityList();

    expect(await screen.findByText("Invoice")).toBeInTheDocument();
    expect(await screen.findByText(/Failed to load items/)).toBeInTheDocument();
  });
});
