import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { sampleInvoiceItems } from "@contentgrid/navigator-data/test-fixtures/hal/fixtures";
import { createListHandler } from "@contentgrid/navigator-data/test-fixtures/msw/handlers";
import { server } from "../../test-setup";
import {
  API_URL,
  PROFILE_URL,
  customerProfileHandler,
  emptyInvoicesList,
  invoiceProfileHandler,
  profileRootHandler,
  profileRootWithTwoEntitiesHandler,
  renderEntityList,
} from "./test-support";

// The invoices-collection handler is identical across the single- and
// multi-entity scenarios below, so it's factored out rather than retyped.
function invoiceCollectionHandler() {
  return createListHandler({
    url: `${API_URL}/invoices`,
    items: sampleInvoiceItems,
    page: { size: 20, total_items_exact: sampleInvoiceItems.length },
  });
}

describe("EntityOverviewPage", () => {
  // Shared by most tests below: profile root (single entity) + entity
  // profile. Tests exercising a different profile shape (two entities, no
  // entities) override this via their own server.use() call.
  beforeEach(() => {
    server.use(profileRootHandler(), invoiceProfileHandler());
  });

  it("renders entities discovered from the profile as entity cards", async () => {
    server.use(invoiceCollectionHandler());

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
      invoiceCollectionHandler(),
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
    server.use(http.get(`${API_URL}/invoices`, () => HttpResponse.json(null, { status: 500 })));

    renderEntityList();

    // EntityCard shows "—" as the count placeholder when the collection request fails
    expect(await screen.findByText("—")).toBeInTheDocument();
  });

  it("clicking an entity card title navigates to entity detail page", async () => {
    const user = userEvent.setup();

    server.use(emptyInvoicesList);

    renderEntityList();

    // Wait for the entity card to appear (card title)
    await screen.findByText("1 entity type available");
    // Click the card title which navigates to the entity
    const cardTitle = screen.getAllByText("Invoice")[0];
    await user.click(cardTitle);

    // After click, should be on detail page (breadcrumb appears)
    expect(await screen.findByText("All entities")).toBeInTheDocument();
  });
});
