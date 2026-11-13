import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useViewNavigation } from "../navigation";
import { createItemDetailTestHarness } from "../test-fixtures/item-detail-harness";
import { EntityItemSplitView } from "./entity-item-split-view";

// A stand-in list that reports each kind of call the real one's children could make, so the
// split view's per-child navigation can be checked call by call.
vi.mock("../entity-item-collection", () => ({
  EntityItemCollectionView: function StubList() {
    const navigation = useViewNavigation();
    return (
      <>
        <button onClick={() => navigation.openItem("customer", "cust-002")}>same entity</button>
        <button onClick={() => navigation.openItem("customer", "cust-002", { openInNewTab: true })}>
          new tab
        </button>
        <button onClick={() => navigation.openItem("invoice", "inv-1")}>other entity</button>
        <button onClick={() => navigation.openEntityItemCollection("customer")}>collection</button>
      </>
    );
  },
}));

describe("EntityItemSplitView per-child navigation", () => {
  it("shows an item of the same entity in the detail pane instead of navigating", async () => {
    const { Wrapper, recording } = createItemDetailTestHarness();
    render(<EntityItemSplitView entityName="customer" toolbar={false} />, { wrapper: Wrapper });

    await userEvent.click(screen.getByRole("button", { name: "same entity" }));

    expect(recording.calls).toEqual([]);
    expect(screen.queryByText("Select an item to see its details.")).not.toBeInTheDocument();
  });

  it("delegates a new-tab request, another entity's item and every other call to the parent", async () => {
    const { Wrapper, recording } = createItemDetailTestHarness();
    render(<EntityItemSplitView entityName="customer" toolbar={false} />, { wrapper: Wrapper });

    await userEvent.click(screen.getByRole("button", { name: "new tab" }));
    await userEvent.click(screen.getByRole("button", { name: "other entity" }));
    await userEvent.click(screen.getByRole("button", { name: "collection" }));

    expect(recording.calls).toEqual([
      { method: "openItem", args: ["customer", "cust-002", { openInNewTab: true }] },
      { method: "openItem", args: ["invoice", "inv-1"] },
      { method: "openEntityItemCollection", args: ["customer"] },
    ]);
    expect(screen.getByText("Select an item to see its details.")).toBeInTheDocument();
  });
});
