import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import {
  API_URL,
  emptyInvoicesList,
  invoiceProfileHandler,
  profileRootHandler,
  renderEntityList,
  sampleItem,
} from "./test-support";

// Handlers shared by every test: profile root + entity profile + empty
// collection (the item route only needs the item fetch itself to vary).
function baseHandlers() {
  return [profileRootHandler(), invoiceProfileHandler(), emptyInvoicesList];
}

function itemHandler(body: Record<string, unknown> | null, status = 200) {
  return http.get(`${API_URL}/invoices/inv-001`, () => HttpResponse.json(body, { status }));
}

describe("EntityItemDetailPage", () => {
  beforeEach(() => {
    server.use(...baseHandlers());
  });

  it("renders item breadcrumb, attribute values, and heading", async () => {
    server.use(itemHandler(sampleItem));

    renderEntityList("/invoice/inv-001");

    // Breadcrumb shows the item id (available immediately, before the item
    // fetch resolves) and the "All entities" back link.
    expect(await screen.findByText("inv-001")).toBeInTheDocument();
    expect(screen.getByText("All entities")).toBeInTheDocument();
    // User-defined attribute value + its profile-derived label — these only
    // appear once the item fetch resolves, so they need their own wait.
    expect(await screen.findByText("INV-2024-001")).toBeInTheDocument();
    expect(screen.getByText("Invoice Number")).toBeInTheDocument();
    // Heading shows entity plural name + " detail"
    expect(screen.getByText(/detail/)).toBeInTheDocument();
  });

  it("shows error on item detail page when item fetch fails", async () => {
    server.use(itemHandler(null, 500));

    renderEntityList("/invoice/inv-001");

    expect(await screen.findByText(/Failed to load item/)).toBeInTheDocument();
  });

  it("navigates back to entity list via entity breadcrumb", async () => {
    const user = userEvent.setup();
    server.use(itemHandler(sampleItem));

    renderEntityList("/invoice/inv-001");

    await screen.findByText("All entities");
    await user.click(screen.getAllByRole("button", { name: "Invoice" })[0]);

    expect(await screen.findByText("All entities")).toBeInTheDocument();
  });

  it("navigates back to root via all entities breadcrumb", async () => {
    const user = userEvent.setup();
    server.use(itemHandler(sampleItem));

    renderEntityList("/invoice/inv-001");

    await user.click(await screen.findByText("All entities"));

    // After navigating back, the overview header should appear
    expect(await screen.findByText("1 entity type available")).toBeInTheDocument();
  });
});
