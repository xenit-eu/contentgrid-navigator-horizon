/**
 * Tests for `EntityItemView`: it renders an already-loaded item (no loading of its own, no
 * toolbar or page chrome), wires each relation section's callbacks to its own props, and fills
 * the space it is given.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { EntityItem } from "@contentgrid/navigator-data";
import { EntityItemView } from "./entity-item-view";

vi.mock("@contentgrid/navigator-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@contentgrid/navigator-data")>()),
  useLoadedProfileEntities: () => ({ profiles: [], isLoading: false }),
}));

vi.mock("./attributes/entity-item-attributes", () => ({
  EntityItemAttributes: () => <div>attributes</div>,
}));
vi.mock("./variations/entity-item-reference", () => ({
  EntityItemReference: () => <div>reference</div>,
}));
vi.mock("./relations/relation-to-one-section", () => ({
  RelationToOneSection: (props: {
    relation: { name: string };
    onItemClick?: (entity: string, id: string) => void;
    onCreateNew?: (entity: string) => void;
    onMissingRelationTargetClick?: (url: string) => void;
  }) => (
    <div>
      <button onClick={() => props.onItemClick?.("company", "c-1")}>one-click</button>
      <button onClick={() => props.onCreateNew?.("company")}>one-create</button>
      <button onClick={() => props.onMissingRelationTargetClick?.("https://x")}>one-missing</button>
    </div>
  ),
}));
vi.mock("./relations/relation-to-many-section", () => ({
  RelationToManySection: (props: {
    relation: { name: string };
    onRequiredRelationClick?: (relation: string) => void;
  }) => (
    <button onClick={() => props.onRequiredRelationClick?.(props.relation.name)}>
      many-required
    </button>
  ),
}));

function makeItem(options: { toOne?: number; toMany?: number }): EntityItem {
  return {
    toOneRelations: Array.from({ length: options.toOne ?? 0 }, () => ({ name: "owner" })),
    toManyRelations: Array.from({ length: options.toMany ?? 0 }, () => ({ name: "lines" })),
  } as unknown as EntityItem;
}

describe("EntityItemView", () => {
  it("renders the item's reference and attributes, and no relations section without relations", () => {
    render(<EntityItemView item={makeItem({})} />);
    expect(screen.getByText("reference")).toBeInTheDocument();
    expect(screen.getByText("attributes")).toBeInTheDocument();
    expect(screen.queryByText("Relations")).not.toBeInTheDocument();
  });

  it("fills its parent and draws no padding or toolbar of its own", () => {
    const { container } = render(<EntityItemView item={makeItem({})} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass("h-full", "min-h-0");
    expect(root.className).not.toMatch(/\bp[xy]?-\d/);
  });

  it("wires every relation callback to its own props", async () => {
    const onRelationItemClick = vi.fn();
    const onRelationItemCreateNew = vi.fn();
    const onMissingRelationTargetClick = vi.fn();
    const onRequiredRelationClick = vi.fn();
    render(
      <EntityItemView
        item={makeItem({ toOne: 1, toMany: 1 })}
        onRelationItemClick={onRelationItemClick}
        onRelationItemCreateNew={onRelationItemCreateNew}
        onMissingRelationTargetClick={onMissingRelationTargetClick}
        onRequiredRelationClick={onRequiredRelationClick}
      />,
    );

    expect(screen.getByText("Relations")).toBeInTheDocument();
    await userEvent.click(screen.getByText("one-click"));
    await userEvent.click(screen.getByText("one-create"));
    await userEvent.click(screen.getByText("one-missing"));
    await userEvent.click(screen.getByText("many-required"));

    expect(onRelationItemClick).toHaveBeenCalledWith("company", "c-1");
    expect(onRelationItemCreateNew).toHaveBeenCalledWith("company");
    expect(onMissingRelationTargetClick).toHaveBeenCalledWith("https://x");
    expect(onRequiredRelationClick).toHaveBeenCalledWith("lines");
  });
});
