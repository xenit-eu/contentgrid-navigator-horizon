import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import {
  type EntityItemCollection,
  NavigatorDataProvider,
  type ProfileEntity,
  createApiClient,
  createContentClient,
  useEntityItemCollection,
} from "@contentgrid/navigator-data";
import { server } from "../../test-setup";
import { useEntityDisplayPreferencesStore } from "../preferences";
import {
  INVOICE_COLLECTION_URL,
  INVOICE_PROFILE_URL,
  invoiceCollectionBody,
  makeInvoiceProfile,
} from "../test-fixtures/invoice-collection";
import { EntityItemCollectionTable } from "./entity-item-collection-table";

const ALL_COLUMNS = ["reference", "amount", "issued", "paid", "file", "annex"];

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const apiFetch = createApiClient(async () => null);
  const contentFetch = createContentClient(async () => null);
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={apiFetch}
          contentFetch={contentFetch}
          profileUrl={INVOICE_PROFILE_URL}
        >
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  };
}

async function fetchInvoices(): Promise<{
  profile: ProfileEntity;
  collection: EntityItemCollection;
}> {
  server.use(http.get(INVOICE_COLLECTION_URL, () => HttpResponse.json(invoiceCollectionBody())));
  const profile = makeInvoiceProfile();
  const { result } = renderHook(() => useEntityItemCollection({ profileEntity: profile }), {
    wrapper: makeWrapper(),
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  useEntityDisplayPreferencesStore
    .getState()
    .setOverride(INVOICE_PROFILE_URL, "invoice", { nameAttribute: "reference" });
  return { profile, collection: result.current.data! };
}

afterEach(() => {
  localStorage.clear();
  useEntityDisplayPreferencesStore.setState({ overrides: {} });
});

function renderTable(
  profile: ProfileEntity,
  collection: EntityItemCollection,
  look: "default" | "collection" = "collection",
) {
  return render(
    <EntityItemCollectionTable
      look={look}
      profile={profile}
      collection={collection}
      visibleColumnNames={ALL_COLUMNS}
      onSort={() => {}}
    />,
    { wrapper: makeWrapper() },
  );
}

/** The cells of the data row for the item with this reference. */
function rowOf(reference: string): HTMLElement {
  // The reference shows in the title cell and in its own column; the title cell comes first.
  return screen.getAllByText(reference)[0].closest<HTMLElement>('[role="row"]')!;
}

describe("EntityItemCollectionTable — cell values", () => {
  it("capitalises the title column's header", async () => {
    const { profile, collection } = await fetchInvoices();
    renderTable(profile, collection);

    expect(screen.getByRole("columnheader", { name: "Invoice" })).toBeInTheDocument();
  });

  it("shows booleans as True, False and Not set pills", async () => {
    const { profile, collection } = await fetchInvoices();
    renderTable(profile, collection);

    const pill = (reference: string, text: string) =>
      within(rowOf(reference)).getByText(text).closest('[data-slot="status-pill"]');
    expect(pill("INV-2026-04812", "True")).toHaveClass("text-[#266B49]");
    expect(pill("INV-2026-04807", "False")).toHaveClass("text-[#B3261E]");
    expect(pill("INV-2026-04809", "Not set")).toHaveClass("text-[#3C5667]");
  });

  it("shows a content column as a file tile with name and size, or a dash", async () => {
    const { profile, collection } = await fetchInvoices();
    renderTable(profile, collection);

    const withAnnex = within(rowOf("INV-2026-04812"));
    expect(withAnnex.getByText("terms.pdf · 88 KB")).toBeInTheDocument();
    const withoutAnnex = within(rowOf("INV-2026-04809"));
    expect(withoutAnnex.queryByText(/terms\.pdf/)).not.toBeInTheDocument();
    // The title cell's "No file" line is the file; the annex column holds the dash.
    expect(withoutAnnex.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("right-aligns number cells and their column header, and nothing else", async () => {
    const { profile, collection } = await fetchInvoices();
    renderTable(profile, collection);

    expect(screen.getByRole("columnheader", { name: /amount/i })).toHaveClass("text-right");
    expect(screen.getByRole("columnheader", { name: /issue date/i })).not.toHaveClass("text-right");
    const cells = within(rowOf("INV-2026-04812")).getAllByRole("cell");
    const amount = cells.find((cell) => /24.?800/.test(cell.textContent ?? ""));
    expect(amount).toHaveClass("text-right");
    expect(cells[0]).not.toHaveClass("text-right");
  });

  it("names the next sort in each sortable header's tooltip by the column's type", async () => {
    const { profile, collection } = await fetchInvoices();
    renderTable(profile, collection);

    expect(screen.getByRole("button", { name: /amount/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /issue date/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^paid$/i })).not.toBeInTheDocument();
  });
});

describe("EntityItemCollectionTable — default look keeps the relation tables as they were", () => {
  it("keeps the header as the singular name and the compact header and row classes", async () => {
    const { profile, collection } = await fetchInvoices();
    renderTable(profile, collection, "default");

    expect(screen.getByRole("columnheader", { name: "invoice" })).toBeInTheDocument();
    const [headerRow, firstRow] = screen.getAllByRole("row");
    expect(headerRow).toHaveClass("gap-3", "px-4", "py-2");
    expect(firstRow).toHaveClass("gap-3", "px-4", "py-3");
    expect(firstRow).not.toHaveClass("min-h-11");
  });

  it("shows no pills, file tiles or right-aligned numbers, and the old file size", async () => {
    const { profile, collection } = await fetchInvoices();
    const { container } = renderTable(profile, collection, "default");

    expect(container.querySelector('[data-slot="status-pill"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-slot="file-tile"]')).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /amount/i })).not.toHaveClass("text-right");
    expect(within(rowOf("INV-2026-04812")).getByText("terms.pdf · 88.0 kB")).toBeInTheDocument();
  });

  it("keeps the View and Delete buttons and the item count, with no row menu or title link", async () => {
    const { profile, collection } = await fetchInvoices();
    renderTable(profile, collection, "default");

    expect(screen.queryByRole("button", { name: /^Actions for/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/^Showing \d+ of/)).toBeInTheDocument();
  });
});
