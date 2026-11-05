import { flushSync } from "react-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  CUSTOMER_NEXT_PAGE_URL,
  SUPPLIER_COLLECTION_URL,
  createCollectionFixtureFetch,
} from "../test-fixtures/collection";
import { CUSTOMER_COLLECTION_URL } from "../test-fixtures/item-detail";
import { createItemDetailTestHarness } from "../test-fixtures/item-detail-harness";
import { EntityItemCollectionView } from "./entity-item-collection-view";

function setup(options?: Parameters<typeof createCollectionFixtureFetch>[0]) {
  const fixture = createCollectionFixtureFetch(options);
  return { ...createItemDetailTestHarness({ fetchFn: fixture.fetch }), fixture };
}

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

  it("opens a clicked item through the navigation object", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemCollectionView entityName="customer" />, { wrapper: Wrapper });

    await userEvent.click(await findFirstItem());

    expect(recording.calls).toEqual([{ method: "openItem", args: ["customer", "cust-001"] }]);
  });

  it("opens an item's full page from the row's Open link, a real link to the item", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemCollectionView entityName="customer" />, { wrapper: Wrapper });
    await findFirstItem();

    const open = screen.getAllByRole("link", { name: "Open" })[0];
    expect(open).toHaveAttribute("href", "/customer/cust-001");
    await userEvent.click(open);

    expect(recording.calls).toEqual([
      { method: "openItem", args: ["customer", "cust-001", { openInFullPage: true }] },
    ]);
  });

  it("leaves a modified click on the row's Open link to the browser, and does not select the row", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemCollectionView entityName="customer" />, { wrapper: Wrapper });
    await findFirstItem();

    fireEvent.click(screen.getAllByRole("link", { name: "Open" })[0], { metaKey: true });

    expect(recording.calls).toEqual([]);
  });

  it("offers create only when the profile has a create form", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemCollectionView entityName="customer" />, { wrapper: Wrapper });

    await userEvent.click(await screen.findByRole("button", { name: "Create customer" }));
    expect(recording.calls).toEqual([
      { method: "openCreateItem", args: ["customer", { openInNewTab: true }] },
    ]);
  });

  it("draws no create action without a create form", async () => {
    const { Wrapper } = setup({ creatable: false });
    render(<EntityItemCollectionView entityName="customer" />, { wrapper: Wrapper });

    await findFirstItem();
    expect(screen.queryByRole("button", { name: /Create/ })).not.toBeInTheDocument();
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
    expect(fixture.collectionRequests).toEqual([link]);
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
    expect(fixture.collectionRequests).toEqual([link]);
  });

  it("uncontrolled, switches to a new link's own page and filters when the collectionUrl prop changes", async () => {
    const { Wrapper, fixture } = setup();
    const firstLink = `${CUSTOMER_COLLECTION_URL}?name~prefix=acme`;
    const secondLink = `${CUSTOMER_COLLECTION_URL}?name~prefix=globex`;

    const { rerender } = render(<EntityItemCollectionView collectionUrl={firstLink} />, {
      wrapper: Wrapper,
    });
    await findFirstItem();
    expect(fixture.collectionRequests).toEqual([firstLink]);

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

  it("applies a sort change when uncontrolled", async () => {
    const { Wrapper, fixture } = setup();
    render(<EntityItemCollectionView entityName="customer" />, { wrapper: Wrapper });

    await findFirstItem();
    await userEvent.click(screen.getByRole("button", { name: /Name/ }));

    await waitFor(() =>
      expect(fixture.collectionRequests.some((url) => url.includes("_sort=name"))).toBe(true),
    );
  });

  it("reports a sort change once, with the sort and the page reset, when controlled", async () => {
    const { Wrapper } = setup();
    const onStateChange = vi.fn();
    render(
      <EntityItemCollectionView
        entityName="customer"
        state={{ filters: {}, pageUrl: CUSTOMER_NEXT_PAGE_URL }}
        onStateChange={onStateChange}
      />,
      { wrapper: Wrapper },
    );

    await findFirstItem();
    await userEvent.click(screen.getByRole("button", { name: /Name/ }));

    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledWith({
      filters: {},
      sort: "name,asc",
      pageUrl: undefined,
    });
  });
});

describe("EntityItemCollectionView state changes", () => {
  const typeFilter = async (value: string) => {
    await userEvent.click(screen.getByRole("button", { name: /filters/i }));
    await userEvent.type(screen.getByRole("combobox", { name: /Name/ }), `${value}{Enter}`);
  };

  it("resets the page when a filter changes (controlled)", async () => {
    const { Wrapper } = setup();
    const onStateChange = vi.fn();
    render(
      <EntityItemCollectionView
        entityName="customer"
        state={{ filters: {}, pageUrl: CUSTOMER_NEXT_PAGE_URL }}
        onStateChange={onStateChange}
      />,
      { wrapper: Wrapper },
    );

    await findFirstItem();
    await typeFilter("acme");

    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledWith({
      filters: { "name~prefix": "acme" },
      pageUrl: undefined,
    });
  });

  it("resets the page when a filter changes (uncontrolled)", async () => {
    const { Wrapper, fixture } = setup();
    render(<EntityItemCollectionView entityName="customer" />, { wrapper: Wrapper });

    await findFirstItem();
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(fixture.collectionRequests).toContain(CUSTOMER_NEXT_PAGE_URL));
    await typeFilter("acme");

    // Back on page 1 of the new search, not on the old page link.
    await waitFor(() => expect(fixture.collectionRequests.at(-1)).toContain("name%7Eprefix=acme"));
    expect(fixture.collectionRequests.at(-1)).not.toContain("_cursor");
  });

  it("keeps both changes when a filter and a page change arrive in the same tick (controlled)", async () => {
    const { Wrapper } = setup();
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
    const next = screen.getByRole("button", { name: /next/i });
    await userEvent.click(screen.getByRole("button", { name: /filters/i }));
    const combobox = screen.getByRole("combobox", { name: /Name/ });
    await userEvent.type(combobox, "acme");
    act(() => {
      fireEvent.keyDown(combobox, { key: "Enter" });
      fireEvent.click(next);
    });

    expect(onStateChange).toHaveBeenLastCalledWith({
      filters: { "name~prefix": "acme" },
      pageUrl: CUSTOMER_NEXT_PAGE_URL,
    });
  });

  it("keeps both changes across an unrelated re-render when controlled with no state yet", async () => {
    const { Wrapper } = setup();
    const onStateChange = vi.fn();
    const view = (activeItemId: string) => (
      <EntityItemCollectionView
        entityName="customer"
        onStateChange={onStateChange}
        activeItemId={activeItemId}
      />
    );
    const { rerender } = render(view("a"), { wrapper: Wrapper });

    await findFirstItem();
    const next = screen.getByRole("button", { name: /next/i });
    await userEvent.click(screen.getByRole("button", { name: /filters/i }));
    const combobox = screen.getByRole("combobox", { name: /Name/ });
    await userEvent.type(combobox, "acme");
    act(() => {
      fireEvent.keyDown(combobox, { key: "Enter" });
      // The host re-renders for an unrelated reason between the two updates; `state` is still
      // undefined, so the default must keep its identity.
      flushSync(() => rerender(view("b")));
      fireEvent.click(next);
    });

    expect(onStateChange).toHaveBeenLastCalledWith({
      filters: { "name~prefix": "acme" },
      pageUrl: CUSTOMER_NEXT_PAGE_URL,
    });
  });

  it("does not leak state to another entity", async () => {
    const fixture = createCollectionFixtureFetch();
    const { Wrapper } = createItemDetailTestHarness({ fetchFn: fixture.fetch });

    // Every profile loads up front, so the switch below has no pending or not-found step that
    // would unmount the body whether or not it is keyed.
    const { rerender } = render(<EntityItemCollectionView entityName="customer" />, {
      wrapper: Wrapper,
    });
    await findFirstItem();
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(fixture.collectionRequests).toContain(CUSTOMER_NEXT_PAGE_URL));

    rerender(<EntityItemCollectionView entityName="supplier" />);
    await screen.findAllByText("Initech Supplies");

    // The supplier list was fetched from its own collection, with nothing carried over.
    expect(fixture.collectionRequests.at(-1)).toBe(SUPPLIER_COLLECTION_URL);
    expect(
      fixture.collectionRequests.filter((url) => url.startsWith(SUPPLIER_COLLECTION_URL)),
    ).toEqual([SUPPLIER_COLLECTION_URL]);
  });
});
