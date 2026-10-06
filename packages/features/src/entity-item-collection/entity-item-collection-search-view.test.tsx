import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProfileEntity } from "@contentgrid/navigator-data";
import { EntityItemCollectionSearchView } from "./entity-item-collection-search-view";

vi.mock("./entity-item-collection-view", () => ({
  EntityItemCollectionView: (props: { filters?: Record<string, string> }) => (
    <div data-testid="collection">{JSON.stringify(props.filters)}</div>
  ),
}));

describe("EntityItemCollectionSearchView", () => {
  it("passes its props to the collection and adds no toolbar or page chrome", () => {
    const { container } = render(
      <EntityItemCollectionSearchView
        profile={{ name: "invoice" } as ProfileEntity}
        filters={{ status: "open" }}
      />,
    );
    expect(screen.getByTestId("collection")).toHaveTextContent('{"status":"open"}');
    // The collection is the root: nothing wraps it.
    expect(container.firstElementChild).toBe(screen.getByTestId("collection"));
  });
});
