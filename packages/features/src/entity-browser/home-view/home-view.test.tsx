import { screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import {
  demoInvoiceItems,
  demoSupplierItems,
} from "@contentgrid/navigator-data/test-fixtures/msw/demo-fixtures";
import { server } from "../../../test-setup";
import {
  PROFILE_URL,
  collectionHandler,
  pendingHandler,
  problemHandler,
  renderEntityBrowser,
  useDefaultHandlers,
} from "../test-utils";
import { HomeView } from "./home-view";

function renderHome() {
  return renderEntityBrowser("/", { home: () => <HomeView /> });
}

describe("HomeView", () => {
  it("shows the welcome header and a skeleton grid while the profile loads", async () => {
    server.use(pendingHandler(PROFILE_URL));
    renderHome();

    expect(await screen.findByText("Welcome to ContentGrid Navigator")).toBeInTheDocument();
    expect(screen.getByText("Entities")).toBeInTheDocument();
  });

  it("shows an error message when the profile fails to load", async () => {
    server.use(problemHandler(PROFILE_URL, 500, { title: "Server error" }));
    renderHome();

    await waitFor(() => {
      expect(screen.getByText(/Failed to load entities/)).toBeInTheDocument();
    });
  });

  it("shows an empty message when the profile has no entities", async () => {
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
            "cg:entity": [],
          },
        }),
      ),
    );
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("No entities found.")).toBeInTheDocument();
    });
    expect(screen.getByText(/0 entity types/)).toBeInTheDocument();
  });

  it("renders an entity card per profile entity with item counts", async () => {
    useDefaultHandlers(demoInvoiceItems as unknown as Record<string, unknown>[]);
    server.use(collectionHandler("suppliers", demoSupplierItems as never));
    renderHome();

    await waitFor(() => {
      expect(screen.getByText("Invoice")).toBeInTheDocument();
    });
    expect(screen.getByText("Supplier")).toBeInTheDocument();
    expect(screen.getByText(/2 entity types/)).toBeInTheDocument();

    // Counts come from page.total_items_exact (3 invoices, 2 suppliers)
    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
    });
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("links each card title to its collection route", async () => {
    useDefaultHandlers(demoInvoiceItems as unknown as Record<string, unknown>[]);
    server.use(collectionHandler("suppliers", demoSupplierItems as never));
    renderHome();

    const link = await screen.findByRole("link", { name: /Invoice/ });
    expect(link).toHaveAttribute("href", expect.stringContaining("/invoice"));
  });

  it("renders a create action per entity card", async () => {
    useDefaultHandlers(demoInvoiceItems as unknown as Record<string, unknown>[]);
    server.use(collectionHandler("suppliers", demoSupplierItems as never));
    renderHome();

    await screen.findByText("Invoice");
    expect(screen.getByRole("button", { name: "Create Invoice" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Supplier" })).toBeInTheDocument();
  });
});
