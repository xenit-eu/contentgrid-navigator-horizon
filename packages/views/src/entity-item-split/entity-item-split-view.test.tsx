import { useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  CUSTOMER_NEXT_PAGE_URL,
  SUPPLIER_COLLECTION_URL,
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
const collectionPane = () => screen.getByRole("region", { name: "Collection" });
const previewPane = () => screen.getByRole("region", { name: "Preview" });
// The preview pane's own header (item reference) names the selected item.
const previewShows = (name: string) =>
  waitFor(() => expect(within(previewPane()).getAllByText(name).length).toBeGreaterThan(0));

describe("EntityItemSplitView", () => {
  it("shows only the list, full width, under one Home, collection toolbar while nothing is selected", async () => {
    const { Wrapper } = setup();
    render(<EntityItemSplitView entityName="customer" />, { wrapper: Wrapper });

    await row("Acme Corp");
    expect(screen.queryByRole("region", { name: "Preview" })).not.toBeInTheDocument();
    expect(collectionPane()).not.toHaveClass("hidden");
    expect(screen.getAllByRole("link", { name: "Home" })).toHaveLength(1);
    expect(currentCrumb()).toHaveTextContent("Customers");
  });

  it("shows the selected item in the preview pane without calling the route-level openItem", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemSplitView entityName="customer" />, { wrapper: Wrapper });

    await userEvent.click(await row("Acme Corp"));
    await previewShows("Acme Corp");

    await userEvent.click(await row("Globex"));
    await previewShows("Globex");

    expect(recording.calls.filter((call) => call.method === "openItem")).toEqual([]);
  });

  it("draws exactly one breadcrumb toolbar, always Home > collection, plus the preview's pane header", async () => {
    const { Wrapper } = setup();
    render(<EntityItemSplitView entityName="customer" />, { wrapper: Wrapper });

    await userEvent.click(await row("Acme Corp"));
    await previewShows("Acme Corp");

    expect(screen.getAllByRole("navigation", { name: /breadcrumb/i })).toHaveLength(1);
    expect(document.querySelectorAll("[aria-current='page']")).toHaveLength(1);
    // The selected item is not a crumb: the collection stays the current location.
    expect(currentCrumb()).toHaveTextContent("Customers");
    expect(
      within(screen.getByRole("navigation", { name: /breadcrumb/i })).queryByText("Acme Corp"),
    ).toBeNull();
    expect(collectionPane()).toBeInTheDocument();
    // The preview keeps its own header with the item and its Open / Close actions.
    expect(within(previewPane()).getByRole("link", { name: "Open" })).toBeInTheDocument();
    expect(
      within(previewPane()).getByRole("button", { name: "Close preview" }),
    ).toBeInTheDocument();
  });

  it("draws no toolbar when hidden, and still works", async () => {
    const { Wrapper } = setup();
    render(<EntityItemSplitView entityName="customer" toolbar={false} />, { wrapper: Wrapper });

    await userEvent.click(await row("Acme Corp"));

    await waitFor(() =>
      expect(screen.queryByText("Select an item to preview it.")).not.toBeInTheDocument(),
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
    await previewShows("Acme Corp");

    await userEvent.click((await screen.findAllByText("Globex"))[0]);
    // A selection change leaves `collection` exactly as it was.
    expect(reported.at(-1)).toEqual({
      selectedItemId: "cust-002",
      collection: { pageUrl: CUSTOMER_NEXT_PAGE_URL },
    });
  });

  it("selecting an item requests it once: the toolbar shares the preview pane's cache entry", async () => {
    const { Wrapper, fixture } = setup();
    render(<EntityItemSplitView entityName="customer" />, { wrapper: Wrapper });

    await userEvent.click(await row("Acme Corp"));
    await previewShows("Acme Corp");

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

    await previewShows("Acme Corp");
    await userEvent.click(await row("Globex"));
    await previewShows("Globex");
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
    expect(screen.queryByRole("region", { name: "Preview" })).not.toBeInTheDocument();
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

  it("reports a sort change once with the sort and the page reset when controlled", async () => {
    const { Wrapper } = setup();
    const onStateChange = vi.fn();
    render(
      <EntityItemSplitView
        entityName="customer"
        state={{ selectedItemId: "cust-001", collection: { pageUrl: CUSTOMER_NEXT_PAGE_URL } }}
        onStateChange={onStateChange}
      />,
      { wrapper: Wrapper },
    );

    await row("Acme Corp");
    await userEvent.click(screen.getByRole("button", { name: /Name/ }));

    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledWith({
      selectedItemId: "cust-001",
      collection: { sort: "name,asc", pageUrl: undefined },
    });
  });

  it("applies a sort change when uncontrolled", async () => {
    const { Wrapper, fixture } = setup();
    render(<EntityItemSplitView entityName="customer" />, { wrapper: Wrapper });

    await row("Acme Corp");
    await userEvent.click(screen.getByRole("button", { name: /Name/ }));

    await waitFor(() =>
      expect(fixture.collectionRequests.some((url) => url.includes("_sort=name"))).toBe(true),
    );
  });

  it("keeps both changes when a list change and a selection arrive in the same tick (uncontrolled)", async () => {
    const { Wrapper, fixture } = setup();
    render(<EntityItemSplitView entityName="customer" />, { wrapper: Wrapper });

    const globex = await row("Globex");
    const next = screen.getByRole("button", { name: /next/i });
    // One batched update: the second change must build on the first, not on the render's state.
    act(() => {
      fireEvent.click(next);
      fireEvent.click(globex);
    });

    await waitFor(() => expect(fixture.collectionRequests).toContain(CUSTOMER_NEXT_PAGE_URL));
    await previewShows("Globex");
  });

  it("does not build on a change the host ignored when the next change arrives in a later tick", async () => {
    const { Wrapper } = setup();
    const onStateChange = vi.fn();
    render(
      <EntityItemSplitView
        entityName="customer"
        state={{ collection: { filters: {} } }}
        onStateChange={onStateChange}
      />,
      { wrapper: Wrapper },
    );

    await userEvent.click(await row("Globex"));
    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(onStateChange).toHaveBeenCalledTimes(2);
    // The host ignored the selection, so the page change must not carry it.
    expect(onStateChange).toHaveBeenLastCalledWith({
      collection: { filters: {}, pageUrl: CUSTOMER_NEXT_PAGE_URL },
    });
  });

  it("reports both changes in the second onStateChange when they arrive in the same tick (controlled)", async () => {
    const { Wrapper } = setup();
    const onStateChange = vi.fn();
    render(
      <EntityItemSplitView
        entityName="customer"
        state={{ collection: { filters: {} } }}
        onStateChange={onStateChange}
      />,
      { wrapper: Wrapper },
    );

    const globex = await row("Globex");
    const next = screen.getByRole("button", { name: /next/i });
    act(() => {
      fireEvent.click(next);
      fireEvent.click(globex);
    });

    expect(onStateChange).toHaveBeenCalledTimes(2);
    expect(onStateChange).toHaveBeenLastCalledWith({
      collection: { filters: {}, pageUrl: CUSTOMER_NEXT_PAGE_URL },
      selectedItemId: "cust-002",
    });
  });

  it("shows the selected item of a controlled state in the preview pane", async () => {
    const { Wrapper } = setup();
    render(
      <EntityItemSplitView
        entityName="customer"
        state={{ selectedItemId: "cust-002" }}
        onStateChange={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    await previewShows("Globex");
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
    await previewShows("Acme Corp");
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await row("Page two item");

    rerender(<EntityItemSplitView entityName="supplier" />);
    // The old item is gone from the preview pane and the toolbar; the supplier's own list shows.
    await row("Initech Supplies");
    expect(screen.queryByRole("region", { name: "Preview" })).not.toBeInTheDocument();
    expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
    expect(fixture.collectionRequests.at(-1)).toBe(SUPPLIER_COLLECTION_URL);

    rerender(<EntityItemSplitView entityName="customer" />);
    // Back on the first page with nothing selected, not on the old entity's page and item.
    await row("Acme Corp");
    expect(screen.queryByText("Page two item")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Preview" })).not.toBeInTheDocument();
    expect(document.querySelector("[role='row'][aria-current='true']")).toBeNull();
  });
});

describe("EntityItemSplitView preview pane", () => {
  const selectAcme = async () => {
    await userEvent.click(await row("Acme Corp"));
    return screen.findByRole("button", { name: "Close preview" });
  };

  it("shows the read-only preview of the selected item, always selecting on a row click", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemSplitView entityName="customer" />, { wrapper: Wrapper });

    await selectAcme();

    // The list's table and the preview's attribute table.
    await waitFor(() => expect(screen.getAllByRole("table")).toHaveLength(2));
    expect(within(previewPane()).getByRole("link", { name: "Open" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit|delete/i })).not.toBeInTheDocument();
    expect(recording.calls.filter((call) => call.method === "openItem")).toEqual([]);
  });

  it("clears the selection on Close, reporting it to a controlling host", async () => {
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

    await userEvent.click(await screen.findByRole("button", { name: "Close preview" }));

    expect(onStateChange).toHaveBeenCalledWith({ selectedItemId: undefined });
  });

  it("removes the preview pane and returns to the full-width list when Close is clicked (uncontrolled)", async () => {
    const { Wrapper } = setup();
    render(<EntityItemSplitView entityName="customer" />, { wrapper: Wrapper });

    await userEvent.click(await selectAcme());

    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Preview" })).not.toBeInTheDocument(),
    );
    expect(collectionPane()).not.toHaveClass("hidden");
    expect(document.querySelector("[role='row'][aria-current='true']")).toBeNull();
  });

  it("opens the full detail view through the parent's navigation, leaving the selection alone", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemSplitView entityName="customer" state={{ selectedItemId: "cust-002" }} />, {
      wrapper: Wrapper,
    });

    await userEvent.click(
      await within(await screen.findByRole("region", { name: "Preview" })).findByRole("link", {
        name: "Open",
      }),
    );

    expect(recording.calls).toEqual([{ method: "openItem", args: ["customer", "cust-002"] }]);
    expect(previewPane()).toBeInTheDocument();
  });

  it("lays out in one column without a selection, in two from lg with one, and keeps the list mounted", async () => {
    const { Wrapper } = setup();
    render(<EntityItemSplitView entityName="customer" toolbar={false} />, { wrapper: Wrapper });
    await row("Acme Corp");
    const grid = () => collectionPane().parentElement;
    const listTable = screen.getAllByRole("table")[0];

    // Nothing selected: the list alone, at every width.
    expect(grid()).not.toHaveClass("lg:grid-cols-2");
    expect(collectionPane()).not.toHaveClass("hidden");

    await selectAcme();

    // Selected: side by side from lg; below it the list gives way to the preview (hidden, mounted).
    expect(grid()).toHaveClass("grid-cols-1", "lg:grid-cols-2");
    expect(collectionPane()).toHaveClass("hidden", "lg:block");
    expect(previewPane()).not.toHaveClass("hidden");
    expect(collectionPane()).toContainElement(listTable);

    await userEvent.click(screen.getByRole("button", { name: "Close preview" }));

    // Closed: the same list element is back at full width.
    await waitFor(() => expect(screen.queryByRole("region", { name: "Preview" })).toBeNull());
    expect(collectionPane()).toContainElement(listTable);
    expect(collectionPane()).not.toHaveClass("hidden");
  });

  it("sends a row's Open action to the parent's openItem (the detail page), not to the preview", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemSplitView entityName="customer" />, { wrapper: Wrapper });
    await row("Acme Corp");

    await userEvent.click(screen.getAllByRole("link", { name: "Open" })[0]);

    expect(recording.calls).toEqual([
      { method: "openItem", args: ["customer", "cust-001", { openInFullPage: true }] },
    ]);
    expect(screen.queryByRole("region", { name: "Preview" })).not.toBeInTheDocument();
  });

  it("leaves a modified click on a row's Open link to the browser", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemSplitView entityName="customer" />, { wrapper: Wrapper });
    await row("Acme Corp");

    const open = screen.getAllByRole("link", { name: "Open" })[0];
    expect(open).toHaveAttribute("href", "/customer/cust-001");
    fireEvent.click(open, { ctrlKey: true });

    expect(recording.calls).toEqual([]);
    expect(screen.queryByRole("region", { name: "Preview" })).not.toBeInTheDocument();
  });
});

describe("EntityItemSplitView focus", () => {
  // jsdom applies no Tailwind: stand in for `hidden` (below lg) so the list pane's computed
  // display is `none` exactly as the browser has it, while an item is selected.
  const hideBelowLg = () => {
    const style = document.createElement("style");
    style.textContent = ".hidden { display: none; }";
    document.head.append(style);
    return () => style.remove();
  };

  it("returns focus to the closed item's row after Close", async () => {
    const { Wrapper } = setup();
    render(<EntityItemSplitView entityName="customer" />, { wrapper: Wrapper });

    await userEvent.click(await row("Globex"));
    await userEvent.click(await screen.findByRole("button", { name: "Close preview" }));

    await waitFor(() => {
      const focused = document.activeElement;
      expect(focused).toHaveAttribute("role", "row");
      expect(focused).toHaveTextContent("Globex");
    });
  });

  it("falls back to the list container when the closed row is gone", async () => {
    const { Wrapper } = setup();
    render(<EntityItemSplitView entityName="customer" state={{ selectedItemId: "cust-001" }} />, {
      wrapper: Wrapper,
    });
    await row("Acme Corp");
    // No row is marked for the item (e.g. it is not on this page): nothing to give focus back to.
    const marked = document.querySelector("[role='row'][aria-current='true']");
    marked?.removeAttribute("aria-current");

    await userEvent.click(await screen.findByRole("button", { name: "Close preview" }));

    await waitFor(() => expect(document.activeElement).toBe(collectionPane()));
  });

  it("moves focus to the preview pane on select when the list is hidden (narrow)", async () => {
    const { Wrapper } = setup();
    render(<EntityItemSplitView entityName="customer" />, { wrapper: Wrapper });
    const restore = hideBelowLg();
    try {
      await userEvent.click(await row("Acme Corp"));

      await waitFor(() => expect(document.activeElement).toBe(previewPane()));
    } finally {
      restore();
    }
  });

  it("keeps focus on the row on select when the list is beside the preview (wide)", async () => {
    const { Wrapper } = setup();
    render(<EntityItemSplitView entityName="customer" />, { wrapper: Wrapper });

    await userEvent.click(await row("Acme Corp"));
    await previewShows("Acme Corp");

    expect(document.activeElement).toHaveAttribute("role", "row");
    expect(document.activeElement).toHaveTextContent("Acme Corp");
  });

  it("does not steal focus when it mounts with a selection", async () => {
    const { Wrapper } = setup();
    render(<EntityItemSplitView entityName="customer" state={{ selectedItemId: "cust-001" }} />, {
      wrapper: Wrapper,
    });
    const restore = hideBelowLg();
    try {
      await previewShows("Acme Corp");
      expect(document.activeElement).toBe(document.body);
    } finally {
      restore();
    }
  });
});
