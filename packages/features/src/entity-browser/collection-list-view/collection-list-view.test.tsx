import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import {
  demoInvoiceItems,
  demoSupplierItems,
} from "@contentgrid/navigator-data/test-fixtures/msw/demo-fixtures";
import { server } from "../../../test-setup";
import {
  API_URL,
  collectionHandler,
  problemHandler,
  renderEntityBrowser,
  useDefaultHandlers,
  withAbsoluteHrefs,
} from "../test-utils";
import { CollectionListView } from "./collection-list-view";

const invoiceItems = demoInvoiceItems as unknown as Record<string, unknown>[];
const supplierItems = demoSupplierItems as unknown as Record<string, unknown>[];

function renderCollection(initialPath = "/invoice") {
  return renderEntityBrowser(initialPath, {
    home: () => <div data-testid="home-page" />,
    collection: ({ collection, cursor, sort }) => (
      <CollectionListView collection={collection} cursor={cursor} sort={sort} />
    ),
    item: ({ collection, id }) => (
      <div data-testid="item-page">
        {collection}/{id}
      </div>
    ),
  });
}

describe("CollectionListView", () => {
  it("renders the entity title, breadcrumb and item count", async () => {
    useDefaultHandlers(invoiceItems);
    renderCollection();

    expect(await screen.findByRole("heading", { name: "Invoice" })).toBeInTheDocument();
    expect(await screen.findByText("3 items")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
  });

  it("renders schema-driven column headers and formatted cell values", async () => {
    useDefaultHandlers(invoiceItems);
    renderCollection();

    await screen.findByRole("heading", { name: "Invoice" });
    await waitFor(() => {
      expect(screen.getByRole("columnheader", { name: "Reference" })).toBeInTheDocument();
    });
    expect(screen.getByRole("columnheader", { name: "Amount" })).toBeInTheDocument();

    // Row values: reference rendered in the primary cell, amount localised
    expect(await screen.findByText("INV-2026-04812")).toBeInTheDocument();
    expect(screen.getByText((24800).toLocaleString())).toBeInTheDocument();
  });

  it("renders the file-type primary cell when the entity has a content attribute", async () => {
    const itemWithDoc = {
      ...invoiceItems[0],
      document: { filename: "invoice.pdf", mimetype: "application/pdf", length: 421888 },
    };
    useDefaultHandlers([itemWithDoc]);
    renderCollection();

    expect(await screen.findByText(/invoice\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/412 KB/)).toBeInTheDocument();
  });

  it("shows 'no content' in the meta line when the content attribute is empty", async () => {
    useDefaultHandlers([invoiceItems[0]]);
    renderCollection();

    expect(await screen.findByText("no content")).toBeInTheDocument();
  });

  it("navigates to the item detail when a row is clicked", async () => {
    useDefaultHandlers(invoiceItems);
    const { router } = renderCollection();
    const user = userEvent.setup();

    const row = await screen.findByRole("button", { name: /View INV-2026-04812/ });
    await user.click(row);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/invoice/inv-001");
    });
  });

  it("navigates to the item detail with the keyboard (Enter)", async () => {
    useDefaultHandlers(invoiceItems);
    const { router } = renderCollection();

    const row = await screen.findByRole("button", { name: /View INV-2026-04812/ });
    row.focus();
    const user = userEvent.setup();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/invoice/inv-001");
    });
  });

  it("navigates home via the breadcrumb", async () => {
    useDefaultHandlers(invoiceItems);
    const { router } = renderCollection();
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "Invoice" });
    await user.click(screen.getByRole("button", { name: "Home" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
  });

  it("shows the empty state with a create affordance when the collection is empty", async () => {
    useDefaultHandlers([]);
    renderCollection();

    expect(await screen.findByText(/No invoice yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create Invoice/ })).toBeInTheDocument();
  });

  it("shows the empty state without a create affordance when create is denied", async () => {
    useDefaultHandlers([], { invoiceProfileTemplates: {} });
    renderCollection();

    expect(await screen.findByText(/No invoice yet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Create Invoice/ })).not.toBeInTheDocument();
  });

  it("shows an access-denied error state on a 403 problem", async () => {
    useDefaultHandlers(invoiceItems);
    server.use(problemHandler(`${API_URL}/invoices`, 403));
    renderCollection();

    expect(await screen.findByText("Access denied")).toBeInTheDocument();
    expect(screen.getByText("You don't have access to this collection.")).toBeInTheDocument();
  });

  it("shows a not-found error state on a 404 problem", async () => {
    useDefaultHandlers(invoiceItems);
    server.use(problemHandler(`${API_URL}/invoices`, 404));
    renderCollection();

    expect(await screen.findByText("Collection not found")).toBeInTheDocument();
  });

  it("paginates with next / previous via cursor hrefs", async () => {
    useDefaultHandlers(invoiceItems);
    const page2Url = `${API_URL}/invoices?_cursor=page2`;
    server.use(
      http.get(`${API_URL}/invoices`, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("_cursor") === "page2") {
          return HttpResponse.json({
            _links: {
              self: { href: page2Url },
              prev: { href: `${API_URL}/invoices` },
            },
            _embedded: { item: [withAbsoluteHrefs(invoiceItems[2])] },
            page: { size: 2, total_items_exact: 3 },
          });
        }
        return HttpResponse.json({
          _links: {
            self: { href: `${API_URL}/invoices` },
            next: { href: page2Url },
          },
          _embedded: {
            item: [withAbsoluteHrefs(invoiceItems[0]), withAbsoluteHrefs(invoiceItems[1])],
          },
          page: { size: 2, total_items_exact: 3 },
        });
      }),
    );
    const { router } = renderCollection();
    const user = userEvent.setup();

    // Page 1: 2 items, Next enabled, Previous disabled
    expect(await screen.findByText("Showing 2 of ~3")).toBeInTheDocument();
    const next = screen.getByRole("button", { name: "Next" });
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    await user.click(next);
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ cursor: page2Url });
    });

    // Page 2: 1 item, Previous enabled
    expect(await screen.findByText("Showing 1 of ~3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Previous" }));
    await waitFor(() => {
      expect(screen.getByText("Showing 2 of ~3")).toBeInTheDocument();
    });
  });

  it("falls back to a single synthetic column when the schema has no listable attributes", async () => {
    useDefaultHandlers(invoiceItems);
    // Supplier profile stripped of attributes — collection falls back to display names
    server.use(
      http.get(`${API_URL}/profile/suppliers`, () =>
        HttpResponse.json({
          name: "supplier",
          title: "Supplier",
          _links: { self: { href: `${API_URL}/profile/suppliers` } },
          _embedded: {},
          _templates: {},
        }),
      ),
      collectionHandler("suppliers", supplierItems),
    );
    renderCollection("/supplier");

    expect(await screen.findByRole("heading", { name: "Supplier" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("columnheader", { name: "Supplier" })).toBeInTheDocument();
    });
  });
});
