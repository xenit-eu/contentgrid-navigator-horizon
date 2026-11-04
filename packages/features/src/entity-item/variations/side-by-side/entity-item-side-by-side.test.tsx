import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EntityItem } from "@contentgrid/navigator-data";
import { EntityItemSideBySide } from "./entity-item-side-by-side";

vi.mock("@contentgrid/navigator-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@contentgrid/navigator-data")>()),
  useLoadedProfileEntities: () => ({ profiles: [], isLoading: false }),
}));

vi.mock("../../entity-item-sections", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../entity-item-sections")>();
  return {
    ...actual,
    EntityItemSections: ({
      show = "all",
      relationVariant = "row",
    }: {
      show?: string;
      relationVariant?: string;
    }) => <div>{`sections ${show} ${relationVariant}`}</div>,
  };
});

vi.mock("../item-reference/entity-item-reference", () => ({
  EntityItemReference: () => <div>reference</div>,
}));

function renderVariation(relations: string[]) {
  const item = {
    id: "item-1",
    selfLink: { href: "https://api.example.com/invoices/item-1" },
    toOneRelations: relations.map((name) => ({ name })),
    toManyRelations: [],
  } as unknown as EntityItem;

  render(<EntityItemSideBySide item={item} />);
}

describe("EntityItemSideBySide", () => {
  it("moves the relations to a column of cards next to the card", () => {
    renderVariation(["customer"]);

    expect(screen.getByText("sections details row")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Relations" })).getByText(
        "sections relations card",
      ),
    ).toBeInTheDocument();
  });

  it("keeps the single card for an item without relations", () => {
    renderVariation([]);

    expect(screen.getByText("sections all row")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Relations" })).not.toBeInTheDocument();
  });

  it("shows no relation summary under the item's title", () => {
    renderVariation(["customer"]);

    expect(screen.queryByRole("list", { name: "Relations" })).not.toBeInTheDocument();
  });
});
