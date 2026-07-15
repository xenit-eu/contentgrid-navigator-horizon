import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { createListHandler } from "@contentgrid/navigator-data/test-fixtures/msw/handlers";
import { server } from "../../test-setup";
import {
  API_URL,
  LINE_ITEMS_COLLECTION_URL,
  SUPPLIERS_COLLECTION_URL,
  invoiceProfileHandlerWithRelations,
  lineItem,
  lineItemProfileHandler,
  makeInvoiceItemWithLineItems,
  makeInvoiceItemWithSupplier,
  notFoundProblem,
  profileRootWithRelationsHandler,
  renderEntityList,
  supplierProfileHandler,
} from "./test-support";

// Every test needs the profile root + invoice/supplier/line-item profiles
// resolved (both relation section types read all three); only the item body
// and relation-endpoint responses vary per test.
function baseHandlers() {
  return [
    profileRootWithRelationsHandler(),
    invoiceProfileHandlerWithRelations(),
    supplierProfileHandler(),
    lineItemProfileHandler(),
  ];
}

describe("RelationToOneSection", () => {
  beforeEach(() => {
    server.use(...baseHandlers());
  });

  it("links a relation via the search dialog when no item is linked", async () => {
    const user = userEvent.setup();
    const itemId = "inv-one-link";
    const itemUrl = `${API_URL}/invoices/${itemId}`;
    const supplierRelationUrl = `${itemUrl}/supplier`;
    let linked = false;

    server.use(
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

    await user.click(await screen.findByText("Acme Corp"));

    expect(await screen.findByText("sup-001")).toBeInTheDocument();
  });

  it("unlinks a relation after confirming the alert dialog", async () => {
    const user = userEvent.setup();
    const itemId = "inv-one-unlink";
    const itemUrl = `${API_URL}/invoices/${itemId}`;
    const supplierRelationUrl = `${itemUrl}/supplier`;
    let linked = true;

    server.use(
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

  it("shows a structured problem summary when clearing the relation fails", async () => {
    const user = userEvent.setup();
    const itemId = "inv-one-clear-error";
    const itemUrl = `${API_URL}/invoices/${itemId}`;
    const supplierRelationUrl = `${itemUrl}/supplier`;

    server.use(
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
              { property: "supplier", title: "Invalid value", detail: "must be a valid supplier" },
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

describe("RelationToManySection", () => {
  beforeEach(() => {
    server.use(...baseHandlers());
  });

  it("renders the relation table with a total-count badge", async () => {
    const itemId = "inv-many-render";
    const itemUrl = `${API_URL}/invoices/${itemId}`;
    const lineItemsRelationUrl = `${itemUrl}/lineItems`;

    server.use(
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
    fireEvent.change(screen.getByPlaceholderText(/Search/), { target: { value: "Widget" } });
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
      http.get(itemUrl, () => HttpResponse.json(makeInvoiceItemWithLineItems(itemId))),
      createListHandler({
        url: lineItemsRelationUrl,
        items: [],
        page: { size: 0, total_items_exact: 0 },
      }),
      createListHandler({ url: LINE_ITEMS_COLLECTION_URL, items: [lineItem("li-030", "Gadget")] }),
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
    await user.click(screen.getAllByRole("button", { name: "Unlink" })[0]);

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
    await user.click(screen.getAllByRole("button", { name: "Open menu" })[0]);
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
      http.get(itemUrl, () => HttpResponse.json(makeInvoiceItemWithLineItems(itemId))),
      // Single dynamic handler on the pathname — branches on the `_cursor` query
      // param instead of registering two handlers that only differ by query
      // string (MSW matches paths, not query strings).
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
