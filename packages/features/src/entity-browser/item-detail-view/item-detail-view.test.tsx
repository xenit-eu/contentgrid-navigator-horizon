import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import {
  demoInvoiceInv001,
  demoInvoiceItems,
  demoSupplierItems,
  supplierSup001,
} from "@contentgrid/navigator-data/test-fixtures/msw/demo-fixtures";
import { server } from "../../../test-setup";
import {
  API_URL,
  collectionHandler,
  itemHandler,
  problemHandler,
  renderEntityBrowser,
  useDefaultHandlers,
  withAbsoluteHrefs,
} from "../test-utils";
import { ItemDetailView } from "./item-detail-view";

const invoiceItems = demoInvoiceItems as unknown as Record<string, unknown>[];
const supplierItems = demoSupplierItems as unknown as Record<string, unknown>[];
const inv001 = demoInvoiceInv001 as unknown as Record<string, unknown>;
const sup001 = supplierSup001 as unknown as Record<string, unknown>;

function renderItem(initialPath: string) {
  return renderEntityBrowser(initialPath, {
    home: () => <div data-testid="home-page" />,
    collection: ({ collection }) => <div data-testid="collection-page">{collection}</div>,
    item: ({ collection, id }) => <ItemDetailView collection={collection} id={id} />,
  });
}

function setupInvoiceDetail() {
  useDefaultHandlers(invoiceItems);
  server.use(
    itemHandler("invoices", "inv-001", inv001),
    // invoice → supplier to-one relation
    http.get(`${API_URL}/invoices/inv-001/supplier`, () =>
      HttpResponse.json(withAbsoluteHrefs(sup001)),
    ),
  );
}

function setupSupplierDetail() {
  useDefaultHandlers(invoiceItems);
  server.use(
    collectionHandler("suppliers", supplierItems),
    itemHandler("suppliers", "sup-001", sup001),
    // supplier → invoices to-many relation
    collectionHandler("suppliers/sup-001/invoices", [invoiceItems[0], invoiceItems[1]]),
  );
}

describe("ItemDetailView", () => {
  it("renders the content-focus variant for an entity with a content attribute", async () => {
    setupInvoiceDetail();
    renderItem("/invoice/inv-001");

    // Display name (reference) shows in the breadcrumb leaf and side panel
    expect((await screen.findAllByText("INV-2026-04812")).length).toBeGreaterThanOrEqual(1);
    // Content-focus: file viewer placeholder pane
    expect(screen.getByText("File preview is not yet available.")).toBeInTheDocument();
    // Attributes side panel
    expect(screen.getByText("Attributes")).toBeInTheDocument();
    expect(screen.getByText("Reference")).toBeInTheDocument();
    expect(screen.getByText((24800).toLocaleString())).toBeInTheDocument();
  });

  it("renders the to-one relation card and navigates into the related item", async () => {
    setupInvoiceDetail();
    const { router } = renderItem("/invoice/inv-001");
    const user = userEvent.setup();

    expect(await screen.findByText("Supplier")).toBeInTheDocument();
    // Related supplier row appears (label = first displayable string field)
    const supplierRow = await screen.findByText("Northwind Logistics BV");

    await user.click(supplierRow);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/suppliers/sup-001");
    });
  });

  it("renders the attribute-focus variant for an entity without content attributes", async () => {
    setupSupplierDetail();
    renderItem("/supplier/sup-001");

    expect(
      await screen.findByRole("heading", { name: "Northwind Logistics BV" }),
    ).toBeInTheDocument();
    // Attribute-focus: no file viewer pane
    expect(screen.queryByText("File preview is not yet available.")).not.toBeInTheDocument();
    // Attributes card with values
    expect(screen.getByText("BE0123.456.789")).toBeInTheDocument();
    // Relations card with the to-many invoices accordion
    expect(screen.getByText("Relations")).toBeInTheDocument();
    expect(screen.getByText("Invoices")).toBeInTheDocument();
  });

  it("shows toolbar Edit and Delete actions in the attribute-focus variant", async () => {
    setupSupplierDetail();
    renderItem("/supplier/sup-001");

    await screen.findByRole("heading", { name: "Northwind Logistics BV" });
    expect(screen.getByRole("button", { name: /Edit/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Delete/ })).toBeEnabled();
  });

  it("opens the delete dialog and deletes the item, navigating back to the collection", async () => {
    setupSupplierDetail();
    server.use(
      http.delete(`${API_URL}/suppliers/sup-001`, () => new HttpResponse(null, { status: 204 })),
    );
    const { router } = renderItem("/supplier/sup-001");
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "Northwind Logistics BV" });
    await user.click(screen.getByRole("button", { name: /Delete/ }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/permanently delete/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Linked relations will be cleared/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/supplier");
    });
  });

  it("keeps the dialog open and shows the server detail on a 409 delete conflict", async () => {
    setupSupplierDetail();
    server.use(
      http.delete(`${API_URL}/suppliers/sup-001`, () =>
        HttpResponse.json(
          {
            type: "https://contentgrid.cloud/problems/integrity/required-relation",
            status: 409,
            title: "Conflict",
            detail: "Cannot delete: required relation exists.",
          },
          { status: 409, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );
    renderItem("/supplier/sup-001");
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "Northwind Logistics BV" });
    await user.click(screen.getByRole("button", { name: /Delete/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(
      await within(dialog).findByText("Cannot delete: required relation exists."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("cancelling the delete dialog closes it without deleting", async () => {
    setupSupplierDetail();
    renderItem("/supplier/sup-001");
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "Northwind Logistics BV" });
    await user.click(screen.getByRole("button", { name: /Delete/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("hides Edit and Delete when the item exposes no HAL-FORMS templates", async () => {
    setupSupplierDetail();
    const noTemplates = { ...sup001, _templates: {} };
    server.use(itemHandler("suppliers", "sup-001", noTemplates));
    renderItem("/supplier/sup-001");

    await screen.findByRole("heading", { name: "Northwind Logistics BV" });
    expect(screen.queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete/ })).not.toBeInTheDocument();
  });

  it("navigates back to the collection via the breadcrumb", async () => {
    setupSupplierDetail();
    const { router } = renderItem("/supplier/sup-001");
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "Northwind Logistics BV" });
    await user.click(screen.getByRole("button", { name: "Supplier" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/supplier");
    });
  });

  it("shows the not-found error state on a 404 problem", async () => {
    useDefaultHandlers(invoiceItems);
    server.use(problemHandler(`${API_URL}/invoices/missing`, 404));
    renderItem("/invoice/missing");

    expect(await screen.findByText("Not found")).toBeInTheDocument();
    expect(screen.getByText("This item doesn't exist or is not accessible.")).toBeInTheDocument();
  });

  it("shows the access-denied error state on a 403 problem", async () => {
    useDefaultHandlers(invoiceItems);
    server.use(problemHandler(`${API_URL}/invoices/inv-001`, 403));
    renderItem("/invoice/inv-001");

    expect(await screen.findByText("Access denied")).toBeInTheDocument();
  });
});
