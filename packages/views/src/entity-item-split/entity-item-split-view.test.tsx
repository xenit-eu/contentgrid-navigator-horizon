import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CUSTOMER_NEXT_PAGE_URL, createCollectionFixtureFetch } from "../test-fixtures/collection";
import { createItemDetailTestHarness } from "../test-fixtures/item-detail-harness";
import { EntityItemSplitView, type EntityItemSplitViewState } from "./entity-item-split-view";

function setup(options?: Parameters<typeof createCollectionFixtureFetch>[0]) {
  const fixture = createCollectionFixtureFetch(options);
  return { ...createItemDetailTestHarness({ fetchFn: fixture.fetch }), fixture };
}

// The item name shows in its row; once selected it shows in the breadcrumb too.
const row = async (name: string) => (await screen.findAllByText(name))[0];
const currentCrumb = () => document.querySelector("[aria-current='page']");

describe("EntityItemSplitView", () => {
  it("shows the list and an empty detail pane under one Home, collection toolbar", async () => {
    const { Wrapper } = setup();
    render(<EntityItemSplitView entityName="customer" />, { wrapper: Wrapper });

    await row("Acme Corp");
    expect(screen.getByText("Select an item to see its details.")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Home" })).toHaveLength(1);
    expect(currentCrumb()).toHaveTextContent("Customers");
  });

  it("shows the selected item in the detail pane without calling the route-level openItem", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemSplitView entityName="customer" />, { wrapper: Wrapper });

    await userEvent.click(await row("Acme Corp"));
    await waitFor(() => expect(currentCrumb()).toHaveTextContent("Acme Corp"));

    await userEvent.click(await row("Globex"));
    await waitFor(() => expect(currentCrumb()).toHaveTextContent("Globex"));

    expect(screen.queryByText("Select an item to see its details.")).not.toBeInTheDocument();
    expect(recording.calls.filter((call) => call.method === "openItem")).toEqual([]);
  });

  it("draws exactly one toolbar for both panes", async () => {
    const { Wrapper } = setup();
    render(<EntityItemSplitView entityName="customer" />, { wrapper: Wrapper });

    await userEvent.click(await row("Acme Corp"));
    await waitFor(() => expect(currentCrumb()).toHaveTextContent("Acme Corp"));

    expect(screen.getAllByRole("navigation", { name: /breadcrumb/i })).toHaveLength(1);
    expect(document.querySelectorAll("[aria-current='page']")).toHaveLength(1);
  });

  it("draws no toolbar when hidden, and still works", async () => {
    const { Wrapper } = setup();
    render(<EntityItemSplitView entityName="customer" toolbar={false} />, { wrapper: Wrapper });

    await userEvent.click(await row("Acme Corp"));

    await waitFor(() =>
      expect(screen.queryByText("Select an item to see its details.")).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
  });

  it("adds the host's actions next to the create action", async () => {
    const { Wrapper, recording } = setup();
    render(
      <EntityItemSplitView
        entityName="customer"
        toolbar={{ actions: <button>Host action</button> }}
      />,
      { wrapper: Wrapper },
    );

    expect(await screen.findByRole("button", { name: "Host action" })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Create customer" }));
    expect(recording.calls).toEqual([
      { method: "openCreateItem", args: ["customer", { openInNewTab: true }] },
    ]);
  });

  it("sends a Home click to the parent's navigation", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemSplitView entityName="customer" />, { wrapper: Wrapper });

    await userEvent.click(await screen.findByRole("link", { name: "Home" }));

    expect(recording.calls).toEqual([{ method: "openHome", args: [] }]);
  });

  it("keeps a pane change out of the list pane's state, and each pane's state apart", async () => {
    const { Wrapper, fixture } = setup();
    render(<EntityItemSplitView entityName="customer" />, { wrapper: Wrapper });

    await userEvent.click(await row("Acme Corp"));
    await waitFor(() => expect(currentCrumb()).toHaveTextContent("Acme Corp"));
    // Paging the list afterwards leaves the selection alone.
    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => expect(fixture.collectionRequests).toContain(CUSTOMER_NEXT_PAGE_URL));
    expect(currentCrumb()).toHaveTextContent("Acme Corp");
  });
});

describe("EntityItemSplitView state", () => {
  it("starts from a given state without onStateChange and keeps its own afterwards", async () => {
    const { Wrapper } = setup();
    render(<EntityItemSplitView entityName="customer" state={{ selectedItemId: "cust-001" }} />, {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(currentCrumb()).toHaveTextContent("Acme Corp"));
    await userEvent.click(await row("Globex"));
    await waitFor(() => expect(currentCrumb()).toHaveTextContent("Globex"));
  });

  it("reports a selection once with the full next state when controlled, and renders only the given state", async () => {
    const { Wrapper } = setup();
    const onStateChange = vi.fn();
    const state: EntityItemSplitViewState = { collection: { filters: {} } };
    render(
      <EntityItemSplitView entityName="customer" state={state} onStateChange={onStateChange} />,
      { wrapper: Wrapper },
    );

    await userEvent.click(await row("Globex"));

    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledWith({
      collection: { filters: {} },
      selectedItemId: "cust-002",
    });
    // Controlled: nothing changes until the host echoes the state back.
    expect(screen.getByText("Select an item to see its details.")).toBeInTheDocument();
  });

  it("reports a list change under the collection key and keeps the selection", async () => {
    const { Wrapper } = setup();
    const onStateChange = vi.fn();
    render(
      <EntityItemSplitView
        entityName="customer"
        state={{ selectedItemId: "cust-001" }}
        onStateChange={onStateChange}
      />,
      { wrapper: Wrapper },
    );

    await row("Acme Corp");
    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledWith({
      selectedItemId: "cust-001",
      collection: { pageUrl: CUSTOMER_NEXT_PAGE_URL },
    });
  });

  it("shows the selected item of a controlled state in the detail pane", async () => {
    const { Wrapper } = setup();
    render(
      <EntityItemSplitView
        entityName="customer"
        state={{ selectedItemId: "cust-002" }}
        onStateChange={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(currentCrumb()).toHaveTextContent("Globex"));
  });
});
