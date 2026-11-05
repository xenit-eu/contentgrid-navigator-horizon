import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  CUSTOMER_NEXT_PAGE_URL,
  createCollectionFixtureFetch,
  customerCollectionBody,
} from "../test-fixtures/collection";
import { CUSTOMER_COLLECTION_URL } from "../test-fixtures/item-detail";
import { createItemDetailTestHarness } from "../test-fixtures/item-detail-harness";
import { EntityItemSplitView, type EntityItemSplitViewState } from "./entity-item-split-view";

function setup(options?: Parameters<typeof createCollectionFixtureFetch>[0]) {
  const fixture = createCollectionFixtureFetch(options);
  return { ...createItemDetailTestHarness({ fetchFn: fixture.fetch }), fixture };
}

const pageTwoItem = {
  id: "cust-099",
  name: "Page two item",
  _links: { self: { href: `${CUSTOMER_COLLECTION_URL}/cust-099` } },
};

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

  it("keeps the selection and the list's state apart: paging leaves the selection, selecting leaves the page", async () => {
    const { Wrapper, fixture } = setup();
    const reported: EntityItemSplitViewState[] = [];
    // A host that echoes every reported state back, as an app writing it to its address would.
    function EchoHost() {
      const [state, setState] = useState<EntityItemSplitViewState>({ selectedItemId: "cust-001" });
      return (
        <EntityItemSplitView
          entityName="customer"
          state={state}
          onStateChange={(next) => {
            reported.push(next);
            setState(next);
          }}
        />
      );
    }
    render(<EchoHost />, { wrapper: Wrapper });

    await row("Acme Corp");
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(fixture.collectionRequests).toContain(CUSTOMER_NEXT_PAGE_URL));
    // The list's own payload never carries the selection; the split view adds it.
    expect(reported.at(-1)).toEqual({
      selectedItemId: "cust-001",
      collection: { pageUrl: CUSTOMER_NEXT_PAGE_URL },
    });
    expect(currentCrumb()).toHaveTextContent("Acme Corp");

    await userEvent.click((await screen.findAllByText("Globex"))[0]);
    // A selection change leaves `collection` exactly as it was.
    expect(reported.at(-1)).toEqual({
      selectedItemId: "cust-002",
      collection: { pageUrl: CUSTOMER_NEXT_PAGE_URL },
    });
  });

  it("selecting an item requests it once: the toolbar shares the detail pane's cache entry", async () => {
    const { Wrapper, fixture } = setup();
    render(<EntityItemSplitView entityName="customer" />, { wrapper: Wrapper });

    await userEvent.click(await row("Acme Corp"));
    await waitFor(() => expect(currentCrumb()).toHaveTextContent("Acme Corp"));

    expect(fixture.itemCounts.item).toBe(1);
  });
});

describe("EntityItemSplitView active row", () => {
  it("marks the selected item's row as current and no other", async () => {
    const { Wrapper } = setup();
    render(<EntityItemSplitView entityName="customer" />, { wrapper: Wrapper });

    expect(document.querySelector("[role='row'][aria-current='true']")).toBeNull();
    await userEvent.click(await row("Acme Corp"));

    await waitFor(() =>
      expect(document.querySelectorAll("[role='row'][aria-current='true']")).toHaveLength(1),
    );
    const marked = document.querySelector("[role='row'][aria-current='true']");
    expect(marked).toHaveTextContent("Acme Corp");
    expect(marked).not.toHaveTextContent("Globex");
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

describe("EntityItemSplitView entity change", () => {
  it("resets the selection and the page when the entity name changes", async () => {
    const fixture = createCollectionFixtureFetch();
    // The second page lists another item, so which page is shown is visible.
    const fetchFn = async (input: Request | string | URL): Promise<Response> => {
      if ((input instanceof Request ? input.url : String(input)) !== CUSTOMER_NEXT_PAGE_URL) {
        return fixture.fetch(input);
      }
      const body = { ...customerCollectionBody, _embedded: { item: [pageTwoItem] } };
      return new Response(JSON.stringify(body), {
        headers: { "Content-Type": "application/hal+json" },
      });
    };
    const { Wrapper } = createItemDetailTestHarness({ fetchFn });
    const { rerender } = render(<EntityItemSplitView entityName="customer" />, {
      wrapper: Wrapper,
    });

    await userEvent.click(await row("Acme Corp"));
    await waitFor(() => expect(currentCrumb()).toHaveTextContent("Acme Corp"));
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await row("Page two item");

    rerender(<EntityItemSplitView entityName="invoice" />);
    // The old item is gone from the detail pane and the toolbar.
    expect(await screen.findByText("Select an item to see its details.")).toBeInTheDocument();
    expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();

    rerender(<EntityItemSplitView entityName="customer" />);
    // Back on the first page with nothing selected, not on the old entity's page and item.
    await row("Acme Corp");
    expect(screen.queryByText("Page two item")).not.toBeInTheDocument();
    expect(screen.getByText("Select an item to see its details.")).toBeInTheDocument();
    expect(document.querySelector("[role='row'][aria-current='true']")).toBeNull();
  });
});
