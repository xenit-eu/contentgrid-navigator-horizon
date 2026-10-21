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

  it("offers create only when the profile has a create form", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemCollectionView entityName="customer" />, { wrapper: Wrapper });

    await userEvent.click(await screen.findByRole("button", { name: "Create customer" }));
    expect(recording.calls).toEqual([{ method: "openCreateItem", args: ["customer"] }]);
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
