import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EntityItem, EntityItemLayout } from "@contentgrid/navigator-data";
import { EntityItemAttributeFocus } from "./entity-item-attribute-focus";

const preferences = vi.hoisted(() => ({ itemLayout: undefined as string | undefined }));

vi.mock("@contentgrid/navigator-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@contentgrid/navigator-data")>()),
  useLoadedProfileEntities: () => ({ profiles: [], isLoading: false }),
}));

vi.mock("../../../preferences", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../preferences")>()),
  useEntityDisplayPreferences: () => ({ preferences: { itemLayout: preferences.itemLayout } }),
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

vi.mock("../../relations/relation-summary", () => ({
  EntityItemRelationSummary: () => null,
}));

function renderVariation(itemLayout: EntityItemLayout, relations: string[]) {
  preferences.itemLayout = itemLayout;
  const item = {
    id: "item-1",
    selfLink: { href: "https://api.example.com/invoices/item-1" },
    toOneRelations: relations.map((name) => ({ name })),
    toManyRelations: [],
  } as unknown as EntityItem;

  render(<EntityItemAttributeFocus item={item} />);
}

describe("EntityItemAttributeFocus sections layout", () => {
  it("stacked: renders every section in the card", () => {
    renderVariation("stacked", ["customer"]);

    expect(screen.getByText("sections all row")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Relations" })).not.toBeInTheDocument();
  });

  it("columns: moves the relations to a column of cards next to the card", () => {
    renderVariation("columns", ["customer"]);

    expect(screen.getByText("sections details row")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Relations" })).getByText(
        "sections relations card",
      ),
    ).toBeInTheDocument();
  });

  it("columns: keeps the single card for an item without relations", () => {
    renderVariation("columns", []);

    expect(screen.getByText("sections all row")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Relations" })).not.toBeInTheDocument();
  });
});
