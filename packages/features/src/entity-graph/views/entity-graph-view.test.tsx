import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRelationDemoHandlers,
  RELATION_DEMO_IDS as ids,
} from "@contentgrid/navigator-data/test-fixtures/msw/relation-demo-handlers";
import { server } from "../../../test-setup";
import { useEntityDisplayPreferencesStore } from "../../preferences";
import { TEST_API_URL, makeNavigatorDataWrapper } from "../../util/test-navigator-data-wrapper";
import type { TrailEntry } from "../util/graph-state";
import { EntityGraphView, type EntityGraphViewProps } from "./entity-graph-view";

const PROFILE_URL = `${TEST_API_URL}/profile`;

function renderGraph(
  props: Partial<EntityGraphViewProps> & Pick<EntityGraphViewProps, "entityName" | "itemId">,
) {
  const callbacks = {
    onOpenItem: vi.fn(),
    onOpenCollection: vi.fn(),
    onTrailChange: vi.fn(),
  };
  const view = render(<EntityGraphView {...callbacks} {...props} />, {
    wrapper: makeNavigatorDataWrapper(),
  });
  return { ...view, ...callbacks };
}

const graph = () => screen.getByRole("application");
/** The canvas node body for an item id (the React Flow node wrapper holds the click handler). */
const nodeEl = (container: HTMLElement, id: string) =>
  container.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);

function useDemo() {
  server.use(...createRelationDemoHandlers(TEST_API_URL, { requireBearer: false }));
}

afterEach(() => {
  useEntityDisplayPreferencesStore.setState({ overrides: {} });
});

describe("EntityGraphView — US1 relations of an item", () => {
  it("draws the root's named relations: a to-one target and every small to-many target", async () => {
    useDemo();
    renderGraph({ entityName: "order", itemId: ids.order(1) });

    const canvas = await screen.findByRole("application");
    for (const name of ["Big Corp", "Widget", "Gadget", "Sprocket"]) {
      expect(await within(canvas).findByText(name)).toBeInTheDocument();
    }
    await waitFor(() =>
      expect(
        within(canvas).getByRole("button", { name: "ORD-001 — Customer → Big Corp" }),
      ).toBeInTheDocument(),
    );
    expect(within(canvas).getAllByRole("button", { name: /ORD-001 — Products →/ })).toHaveLength(3);
    expect(within(canvas).queryByText(/more$/)).not.toBeInTheDocument();
  });

  it("caps a large to-many relation at 10 targets plus an estimated overflow count", async () => {
    useDemo();
    const { container } = renderGraph({ entityName: "customer", itemId: ids.bigCorp });

    expect(
      await within(await screen.findByRole("application")).findByText("+ ~15 more"),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(within(graph()).getAllByRole("button", { name: /Big Corp — Orders →/ })).toHaveLength(
        10,
      ),
    );
    expect(nodeEl(container, ids.order(11))).toBeNull();
  });

  it("colours nodes with the user's entity-type preference", async () => {
    useEntityDisplayPreferencesStore
      .getState()
      .setOverride(PROFILE_URL, "customer", { color: "rgb(1, 2, 3)" });
    useDemo();
    const { container } = renderGraph({ entityName: "order", itemId: ids.order(1) });

    await within(await screen.findByRole("application")).findByText("Big Corp");
    const badge = container.querySelector(
      `[data-kg-node="${ids.bigCorp}"] [data-slot="icon-badge"]`,
    );
    expect(badge?.getAttribute("style")).toContain("rgb(1, 2, 3)");
  });

  it("shows an error page when the root item does not exist", async () => {
    useDemo();
    renderGraph({ entityName: "order", itemId: "does-not-exist" });
    expect(await screen.findByText(/not found/i)).toBeInTheDocument();
    expect(screen.queryByRole("application")).not.toBeInTheDocument();
  });

  it("reports a failing relation with a retry while the other relations still render", async () => {
    useDemo(); // server.use prepends — register the demo first so the override below wins
    server.use(
      http.get(`${TEST_API_URL}/orders/${ids.order(1)}/products`, () =>
        HttpResponse.json(
          { status: 500, title: "Boom" },
          { status: 500, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );
    renderGraph({ entityName: "order", itemId: ids.order(1) });

    expect(
      await screen.findByText("Couldn't load Products of ORD-001.", {}, { timeout: 15_000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(within(graph()).getByText("Big Corp")).toBeInTheDocument();
  }, 20_000);

  it("says so when the item has no relations", async () => {
    useDemo();
    renderGraph({ entityName: "supplier", itemId: ids.acme });
    expect(await screen.findByText("This item has no relations.")).toBeInTheDocument();
  });
});

describe("EntityGraphView — US2 details and node menu", () => {
  it("clicking a node selects it, shows its details and opens View / Explore", async () => {
    useDemo();
    const { container, onOpenItem } = renderGraph({ entityName: "order", itemId: ids.order(1) });
    await within(await screen.findByRole("application")).findByText("Widget");

    fireEvent.click(nodeEl(container, ids.product(1))!);

    const menu = await screen.findByRole("menu", { name: "Widget" });
    expect(within(menu).getByRole("menuitem", { name: "View" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Explore relations" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
    // Details panel switches to the product.
    const details = screen.getByRole("region", { name: "Item details" });
    expect(await within(details).findByText("Supplier")).toBeInTheDocument();

    fireEvent.click(within(menu).getByRole("menuitem", { name: "View" }));
    expect(onOpenItem).toHaveBeenCalledWith({ entityName: "product", itemId: ids.product(1) });
  });

  it("does not offer Explore for the focus item nor Delete without a delete template", async () => {
    useDemo();
    const { container } = renderGraph({ entityName: "order", itemId: ids.order(1) });
    await within(await screen.findByRole("application")).findByText("Widget");

    fireEvent.click(nodeEl(container, ids.order(1))!);
    const menu = await screen.findByRole("menu", { name: "ORD-001" });
    expect(
      within(menu).queryByRole("menuitem", { name: "Explore relations" }),
    ).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("Escape closes the menu and keeps the selection in the panel", async () => {
    useDemo();
    const { container } = renderGraph({ entityName: "order", itemId: ids.order(1) });
    await within(await screen.findByRole("application")).findByText("Widget");

    fireEvent.click(nodeEl(container, ids.product(2))!);
    const menu = await screen.findByRole("menu", { name: "Gadget" });
    fireEvent.keyDown(menu, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    const details = screen.getByRole("region", { name: "Item details" });
    expect((await within(details).findAllByText("Gadget")).length).toBeGreaterThan(0);
  });
});

describe("EntityGraphView — US3 traversal and trail", () => {
  it("exploring keeps the path visible, collapses older items and reports the trail", async () => {
    useDemo();
    const { container, onTrailChange } = renderGraph({
      entityName: "customer",
      itemId: ids.bigCorp,
    });
    await within(await screen.findByRole("application")).findByText("+ ~15 more");

    fireEvent.click(nodeEl(container, ids.order(1))!);
    fireEvent.click(
      within(await screen.findByRole("menu", { name: "ORD-001" })).getByRole("menuitem", {
        name: "Explore relations",
      }),
    );

    await waitFor(() =>
      expect(onTrailChange).toHaveBeenLastCalledWith([
        { entityName: "order", id: ids.order(1), via: "orders" },
      ]),
    );
    // Order's products are drawn; Big Corp (previous focus) is still fully expanded.
    expect(await within(graph()).findByText("Widget")).toBeInTheDocument();
    expect(within(graph()).getByText("+ ~15 more")).toBeInTheDocument();

    // Explore a product next: only product + order expanded; Big Corp is trail-only.
    fireEvent.click(nodeEl(container, ids.product(1))!);
    fireEvent.click(
      within(await screen.findByRole("menu", { name: "Widget" })).getByRole("menuitem", {
        name: "Explore relations",
      }),
    );
    expect(await within(graph()).findByText("ACME")).toBeInTheDocument();
    await waitFor(() => expect(within(graph()).queryByText("+ ~15 more")).not.toBeInTheDocument());
    expect(nodeEl(container, ids.bigCorp)).not.toBeNull();
    expect(nodeEl(container, ids.order(2))).toBeNull();

    // Breadcrumb shows the path and returns to the root in one action.
    const path = screen.getByRole("navigation", { name: "Explored path" });
    expect(within(path).getByText("Widget")).toBeInTheDocument();
    fireEvent.click(within(path).getByRole("button", { name: "Big Corp" }));
    await waitFor(() => expect(onTrailChange).toHaveBeenLastCalledWith([]));
    expect(await within(graph()).findByText("+ ~15 more")).toBeInTheDocument();
  });

  it("restores the focus from the trail prop and never duplicates a node", async () => {
    useDemo();
    const trail: TrailEntry[] = [{ entityName: "order", id: ids.order(1), via: "orders" }];
    const { container } = renderGraph({ entityName: "customer", itemId: ids.bigCorp, trail });

    expect(
      await within(await screen.findByRole("application")).findByText("Widget"),
    ).toBeInTheDocument();
    const orderNodes = container.querySelectorAll(`.react-flow__node[data-id="${ids.order(1)}"]`);
    expect(orderNodes).toHaveLength(1);
  });
});

describe("EntityGraphView — US4 overflow list", () => {
  it("lists every target page by page and pins one into the graph", async () => {
    useDemo();
    const { container } = renderGraph({ entityName: "customer", itemId: ids.bigCorp });
    const overflow = await within(await screen.findByRole("application")).findByText("+ ~15 more");

    fireEvent.click(overflow.closest(".react-flow__node")!);
    const list = await screen.findByRole("region", { name: "Orders of Big Corp" });
    expect(await within(list).findByText(/About 25 items \(estimated\)/)).toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(list).getAllByRole("button", { name: /Show in graph|Already in graph/ }),
      ).toHaveLength(20),
    );

    fireEvent.click(within(list).getByRole("button", { name: "Load more" }));
    await waitFor(() =>
      expect(
        within(list).getAllByRole("button", { name: /Show in graph|Already in graph/ }),
      ).toHaveLength(25),
    );

    // Order 15 is not drawn yet — pin it.
    const row = within(list).getByText("ORD-015").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "Show in graph" }));
    await waitFor(() => expect(nodeEl(container, ids.order(15))).not.toBeNull());
    expect(within(graph()).getByText("+ ~14 more")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Already in graph" })).toBeDisabled();
  });
});

describe("EntityGraphView — US5 remove link", () => {
  it("offers Remove link only when permitted and removes a to-many link after confirmation", async () => {
    useDemo();
    const { container } = renderGraph({ entityName: "order", itemId: ids.order(1) });
    const label = await within(await screen.findByRole("application")).findByRole("button", {
      name: "ORD-001 — Products → Gadget",
    });

    fireEvent.click(label);
    const menu = await screen.findByRole("menu", { name: "Products" });
    expect(screen.getByText("ORD-001 → Gadget")).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Remove link" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Both items are kept/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove link" }));

    await waitFor(() => expect(nodeEl(container, ids.product(2))).toBeNull());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("hides Remove link without a clear template", async () => {
    useDemo();
    renderGraph({ entityName: "order", itemId: ids.order(2) });
    const label = await within(await screen.findByRole("application")).findByRole("button", {
      name: "ORD-002 — Customer → Big Corp",
    });
    fireEvent.click(label);
    const menu = await screen.findByRole("menu", { name: "Customer" });
    expect(within(menu).queryByRole("menuitem", { name: "Remove link" })).not.toBeInTheDocument();
  });

  it("keeps the edge and explains why when the server refuses", async () => {
    useDemo();
    renderGraph({ entityName: "order", itemId: ids.order(1) });
    const label = await within(await screen.findByRole("application")).findByRole("button", {
      name: "ORD-001 — Customer → Big Corp",
    });
    fireEvent.click(label);
    fireEvent.click(
      within(await screen.findByRole("menu", { name: "Customer" })).getByRole("menuitem", {
        name: "Remove link",
      }),
    );
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove link" }));

    expect(await within(dialog).findByText(/Customer is required/)).toBeInTheDocument();
    expect(within(graph()).getByText("Big Corp")).toBeInTheDocument();
  });

  it("does nothing when the confirmation is cancelled", async () => {
    useDemo();
    const { container } = renderGraph({ entityName: "order", itemId: ids.order(1) });
    const label = await within(await screen.findByRole("application")).findByRole("button", {
      name: "ORD-001 — Products → Gadget",
    });
    fireEvent.click(label);
    fireEvent.click(
      within(await screen.findByRole("menu", { name: "Products" })).getByRole("menuitem", {
        name: "Remove link",
      }),
    );
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(nodeEl(container, ids.product(2))).not.toBeNull();
  });
});

describe("EntityGraphView — US6 delete item", () => {
  it("deletes a target item after confirmation", async () => {
    useDemo();
    const { container } = renderGraph({ entityName: "order", itemId: ids.order(1) });
    await within(await screen.findByRole("application")).findByText("Sprocket");

    fireEvent.click(nodeEl(container, ids.product(3))!);
    fireEvent.click(
      within(await screen.findByRole("menu", { name: "Sprocket" })).getByRole("menuitem", {
        name: "Delete",
      }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/permanently deletes the product/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(nodeEl(container, ids.product(3))).toBeNull());
  });

  it("keeps the node and shows the reason when another item requires it", async () => {
    useDemo();
    const { container } = renderGraph({ entityName: "order", itemId: ids.order(1) });
    await within(await screen.findByRole("application")).findByText("Big Corp");

    fireEvent.click(nodeEl(container, ids.bigCorp)!);
    fireEvent.click(
      within(await screen.findByRole("menu", { name: "Big Corp" })).getByRole("menuitem", {
        name: "Delete",
      }),
    );
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await within(dialog).findByText(/requires this item/)).toBeInTheDocument();
    expect(nodeEl(container, ids.bigCorp)).not.toBeNull();
  });

  it("deleting the current focus steps back along the trail", async () => {
    useDemo();
    const trail: TrailEntry[] = [
      { entityName: "order", id: ids.order(1), via: "orders" },
      { entityName: "product", id: ids.product(1), via: "products" },
    ];
    const { container, onTrailChange } = renderGraph({
      entityName: "customer",
      itemId: ids.bigCorp,
      trail,
    });
    await within(await screen.findByRole("application")).findByText("ACME");

    fireEvent.click(nodeEl(container, ids.product(1))!);
    fireEvent.click(
      within(await screen.findByRole("menu", { name: "Widget" })).getByRole("menuitem", {
        name: "Delete",
      }),
    );
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );

    await waitFor(() =>
      expect(onTrailChange).toHaveBeenLastCalledWith([
        { entityName: "order", id: ids.order(1), via: "orders" },
      ]),
    );
  });

  it("deleting the root shows the deleted state with a way back to the collection", async () => {
    useDemo();
    const { container, onOpenCollection } = renderGraph({
      entityName: "customer",
      itemId: ids.lonelyLtd,
    });
    await screen.findByRole("application");
    await waitFor(() => expect(nodeEl(container, ids.lonelyLtd)).not.toBeNull());

    fireEvent.click(nodeEl(container, ids.lonelyLtd)!);
    fireEvent.click(
      within(await screen.findByRole("menu", { name: "Lonely Ltd" })).getByRole("menuitem", {
        name: "Delete",
      }),
    );
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );

    expect(await screen.findByText("This item was deleted")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Back to Customer/ }));
    expect(onOpenCollection).toHaveBeenCalledWith("customer");
  });
});
