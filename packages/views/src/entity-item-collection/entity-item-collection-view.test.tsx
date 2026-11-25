import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CUSTOMER_NEXT_PAGE_URL, createCollectionFixtureFetch } from "../test-fixtures/collection";
import { CUSTOMER_COLLECTION_URL } from "../test-fixtures/item-detail";
import { createItemDetailTestHarness } from "../test-fixtures/item-detail-harness";
import { EntityItemCollectionView } from "./entity-item-collection-view";

function setup(options?: Parameters<typeof createCollectionFixtureFetch>[0]) {
  const fixture = createCollectionFixtureFetch(options);
  return { ...createItemDetailTestHarness({ fetchFn: fixture.fetch }), fixture };
}

/**
 * The requests that carry a query. A list opened on a filtering link also reads the entity's
 * unfiltered total (the plain collection URL) for its "Filtered from" line.
 */
const filteredRequests = (fixture: { collectionRequests: string[] }) =>
  fixture.collectionRequests.filter((url) => url !== CUSTOMER_COLLECTION_URL);

// The item name can show more than once in its row.
const findFirstItem = async () => (await screen.findAllByText("Acme Corp"))[0];

describe("EntityItemCollectionView", () => {
  it("shows the list under a Home, collection breadcrumb", async () => {
    const { Wrapper } = setup();
    render(<EntityItemCollectionView entityName="customer" />, { wrapper: Wrapper });

    expect(await findFirstItem()).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(document.querySelector("[aria-current='page']")).toHaveTextContent("Customers");
  });

  it("opens an item from its row menu's Open item through the navigation object", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemCollectionView entityName="customer" />, { wrapper: Wrapper });

    await findFirstItem();
    await userEvent.click(screen.getByRole("button", { name: "Actions for Acme Corp" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Open" }));

    expect(recording.calls).toEqual([{ method: "openItem", args: ["customer", "cust-001"] }]);
  });

  it("makes a row's title a link to the item page and opens it through the navigation object", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemCollectionView entityName="customer" />, { wrapper: Wrapper });

    await findFirstItem();
    const link = screen.getAllByRole("link", { name: "Acme Corp" })[0];
    expect(link).toHaveAttribute(
      "href",
      recording.navigation.hrefFor?.item("customer", "cust-001"),
    );
    await userEvent.click(link);

    expect(recording.calls).toEqual([{ method: "openItem", args: ["customer", "cust-001"] }]);
  });

  it("offers create only when the profile has a create form", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemCollectionView entityName="customer" />, { wrapper: Wrapper });

    await userEvent.click(await screen.findByRole("button", { name: "New customer" }));
    expect(recording.calls).toEqual([{ method: "openCreateItem", args: ["customer"] }]);
  });

  it("names the create action 'New' plus the lower-cased singular name, with a plus icon", async () => {
    const { Wrapper } = setup();
    render(<EntityItemCollectionView entityName="customer" />, { wrapper: Wrapper });

    const button = await screen.findByRole("button", { name: "New customer" });
    expect(button.querySelector("svg")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create customer" })).not.toBeInTheDocument();
  });

  it("titles the page with the plural name and the count", async () => {
    const { Wrapper } = setup();
    render(<EntityItemCollectionView entityName="customer" />, { wrapper: Wrapper });

    expect(await screen.findByRole("heading", { level: 1, name: "Customers" })).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelector("[data-slot='collection-count']")).toHaveTextContent("2"),
    );
    expect(screen.queryByText(/Filtered from/)).not.toBeInTheDocument();
  });

  it("shows the filtered count and the unfiltered total while a filter is active", async () => {
    const { Wrapper } = setup({
      unfilteredPage: { size: 2, total_items_exact: 1284 },
      filteredPage: { size: 2, total_items_exact: 37 },
    });
    render(
      <EntityItemCollectionView
        entityName="customer"
        state={{ filters: { "name~prefix": "acme" } }}
        onStateChange={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    expect(await screen.findByText(/^Filtered from 1\s284 items$/)).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelector("[data-slot='collection-count']")).toHaveTextContent("37"),
    );
  });

  it("asks for the unfiltered total once, and not at all without a filter", async () => {
    const plain = setup();
    render(<EntityItemCollectionView entityName="customer" />, { wrapper: plain.Wrapper });
    await findFirstItem();
    expect(plain.fixture.collectionRequests).toEqual([CUSTOMER_COLLECTION_URL]);

    const filtered = setup({ filteredPage: { size: 2, total_items_exact: 1 } });
    render(
      <EntityItemCollectionView
        entityName="customer"
        state={{ filters: { "name~prefix": "acme" } }}
        onStateChange={vi.fn()}
      />,
      { wrapper: filtered.Wrapper },
    );
    await screen.findByText(/^Filtered from 2 items$/);
    expect(
      filtered.fixture.collectionRequests.filter((url) => url === CUSTOMER_COLLECTION_URL),
    ).toHaveLength(1);
  });

  it("words an estimated total as 'about'", async () => {
    const { Wrapper } = setup({
      unfilteredPage: { size: 2, total_items_estimate: 1204 },
      filteredPage: { size: 2, total_items_exact: 3 },
    });
    render(
      <EntityItemCollectionView
        entityName="customer"
        state={{ filters: { "name~prefix": "acme" } }}
        onStateChange={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    expect(await screen.findByText(/^Filtered from about 1\s204 items$/)).toBeInTheDocument();
  });

  it("keeps the title above the empty collection", async () => {
    const { Wrapper } = setup({ empty: true });
    render(<EntityItemCollectionView entityName="customer" />, { wrapper: Wrapper });

    expect(await screen.findByRole("heading", { level: 1, name: "Customers" })).toBeInTheDocument();
    expect(await screen.findByText("0 items")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "No customers yet" })).toBeInTheDocument();
  });

  it("hides the toolbar's New action while the list is empty, as the empty state offers create", async () => {
    const { Wrapper } = setup({ empty: true });
    render(<EntityItemCollectionView entityName="customer" />, { wrapper: Wrapper });

    expect(await screen.findByRole("heading", { name: "No customers yet" })).toBeInTheDocument();
    // One button: the empty state's own, not also the toolbar's.
    expect(screen.getAllByRole("button", { name: "New customer" })).toHaveLength(1);
  });

  it("shows the toolbar's New action when the list has items", async () => {
    const { Wrapper } = setup();
    render(<EntityItemCollectionView entityName="customer" />, { wrapper: Wrapper });

    await findFirstItem();
    expect(screen.getAllByRole("button", { name: "New customer" })).toHaveLength(1);
  });

  it("draws no create action without a create form", async () => {
    const { Wrapper } = setup({ creatable: false });
    render(<EntityItemCollectionView entityName="customer" />, { wrapper: Wrapper });

    await findFirstItem();
    expect(screen.queryByRole("button", { name: /Create/ })).not.toBeInTheDocument();
  });

  it("opens create in a new tab from the empty collection", async () => {
    const { Wrapper, recording } = setup({ empty: true });
    // Without the toolbar, the empty state's button is the only create action.
    render(<EntityItemCollectionView entityName="customer" toolbar={false} />, {
      wrapper: Wrapper,
    });

    await userEvent.click(await screen.findByRole("button", { name: "New customer" }));
    expect(recording.calls).toEqual([
      { method: "openCreateItem", args: ["customer", { openInNewTab: true }] },
    ]);
  });

  it("draws no toolbar when hidden", async () => {
    const { Wrapper } = setup();
    render(<EntityItemCollectionView entityName="customer" toolbar={false} />, {
      wrapper: Wrapper,
    });

    await findFirstItem();
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
  });

  it("shows not-found for an unknown entity, with only the Home crumb", async () => {
    const { Wrapper } = setup();
    render(<EntityItemCollectionView entityName="nope" />, { wrapper: Wrapper });

    expect(await screen.findByText(/No profile for entity "nope"/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(document.querySelector("[aria-current='page']")).toBeNull();
  });
});

describe("EntityItemCollectionView by link", () => {
  it("finds the profile through its describes links and fetches the link itself", async () => {
    const { Wrapper, fixture } = setup();
    const link = `${CUSTOMER_COLLECTION_URL}?name~prefix=acme`;
    render(<EntityItemCollectionView collectionUrl={link} />, { wrapper: Wrapper });

    expect(await findFirstItem()).toBeInTheDocument();
    expect(document.querySelector("[aria-current='page']")).toHaveTextContent("Customers");
    expect(fixture.collectionRequests).toContain(link);
    expect(filteredRequests(fixture)).toEqual([link]);
  });

  it("shows not-found for a link no profile describes", async () => {
    const { Wrapper } = setup();
    render(<EntityItemCollectionView collectionUrl="https://api.example.com/unknown" />, {
      wrapper: Wrapper,
    });

    expect(await screen.findByText(/No profile describes/)).toBeInTheDocument();
  });

  it("controlled with no state yet still starts from the link's own page and filters", async () => {
    const { Wrapper, fixture } = setup();
    const link = `${CUSTOMER_COLLECTION_URL}?name~prefix=acme`;
    render(<EntityItemCollectionView collectionUrl={link} onStateChange={vi.fn()} />, {
      wrapper: Wrapper,
    });

    expect(await findFirstItem()).toBeInTheDocument();
    // Not the plain collection URL: the link's own filter/page must reach the feature even
    // though the host hasn't echoed a `state` back yet.
    expect(filteredRequests(fixture)).toEqual([link]);
  });

  it("uncontrolled, switches to a new link's own page and filters when the collectionUrl prop changes", async () => {
    const { Wrapper, fixture } = setup();
    const firstLink = `${CUSTOMER_COLLECTION_URL}?name~prefix=acme`;
    const secondLink = `${CUSTOMER_COLLECTION_URL}?name~prefix=globex`;

    const { rerender } = render(<EntityItemCollectionView collectionUrl={firstLink} />, {
      wrapper: Wrapper,
    });
    await findFirstItem();
    expect(filteredRequests(fixture)).toEqual([firstLink]);

    rerender(<EntityItemCollectionView collectionUrl={secondLink} />);

    // Same entity both times, but a different link — the view must not keep showing the first
    // link's stale internal state.
    await waitFor(() => expect(fixture.collectionRequests).toContain(secondLink));
  });
});

describe("EntityItemCollectionView state", () => {
  it("keeps its own state without onStateChange", async () => {
    const { Wrapper, fixture } = setup();
    render(<EntityItemCollectionView entityName="customer" />, { wrapper: Wrapper });

    await findFirstItem();
    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => expect(fixture.collectionRequests).toContain(CUSTOMER_NEXT_PAGE_URL));
  });

  it("reports every change once with the full next state when controlled", async () => {
    const { Wrapper, fixture } = setup();
    const onStateChange = vi.fn();
    render(
      <EntityItemCollectionView
        entityName="customer"
        state={{ filters: {} }}
        onStateChange={onStateChange}
      />,
      { wrapper: Wrapper },
    );

    await findFirstItem();
    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledWith({ filters: {}, pageUrl: CUSTOMER_NEXT_PAGE_URL });
    // The host did not apply it, so the view keeps showing the state it was given.
    expect(fixture.collectionRequests).not.toContain(CUSTOMER_NEXT_PAGE_URL);
  });
});
