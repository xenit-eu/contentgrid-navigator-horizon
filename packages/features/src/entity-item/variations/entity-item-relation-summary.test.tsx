import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type EntityItem,
  type EntityItemToManyRelation,
  type EntityItemToOneRelation,
  useEntityItemToManyRelation,
  useEntityItemToOneRelation,
} from "@contentgrid/navigator-data";
import { EntityItemRelationSummary } from "./entity-item-relation-summary";

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return {
    ...actual,
    useEntityItemToOneRelation: vi.fn(),
    useEntityItemToManyRelation: vi.fn(),
  };
});

function makeRelation<T>(name: string, title?: string): T {
  return { name, profileRelation: { title } } as unknown as T;
}

function makeItem(
  toOneRelations: EntityItemToOneRelation[],
  toManyRelations: EntityItemToManyRelation[] = [],
): EntityItem {
  return { toOneRelations, toManyRelations } as unknown as EntityItem;
}

function mockToOne(state: Partial<{ isPending: boolean; isSuccess: boolean; data: unknown }>) {
  vi.mocked(useEntityItemToOneRelation).mockReturnValue({
    isPending: false,
    isSuccess: false,
    data: undefined,
    ...state,
  } as unknown as ReturnType<typeof useEntityItemToOneRelation>);
}

function mockToMany(state: Partial<{ isPending: boolean; data: unknown }>) {
  vi.mocked(useEntityItemToManyRelation).mockReturnValue({
    isPending: false,
    data: undefined,
    ...state,
  } as unknown as ReturnType<typeof useEntityItemToManyRelation>);
}

afterEach(() => {
  vi.mocked(useEntityItemToOneRelation).mockReset();
  vi.mocked(useEntityItemToManyRelation).mockReset();
});

describe("EntityItemRelationSummary", () => {
  it("renders nothing for an item without relations", () => {
    const { container } = render(<EntityItemRelationSummary item={makeItem([])} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("counts a linked to-one relation as 1 and an empty one as 0", () => {
    vi.mocked(useEntityItemToOneRelation).mockImplementation(
      (relation) =>
        ({
          isPending: false,
          isSuccess: true,
          data: relation?.name === "customer" ? {} : null,
        }) as unknown as ReturnType<typeof useEntityItemToOneRelation>,
    );
    render(
      <EntityItemRelationSummary
        item={makeItem([
          makeRelation("customer", "Customer"),
          makeRelation("supplier", "Supplier"),
        ])}
      />,
    );

    const entries = screen.getAllByRole("listitem");
    expect(entries[0]).toHaveTextContent("1Customer");
    expect(entries[1]).toHaveTextContent("0Supplier");
  });

  it("shows a to-many relation's total and falls back to the relation name without a title", () => {
    mockToMany({ data: { totalItems: { count: 12, isEstimated: false } } });
    render(
      <EntityItemRelationSummary item={makeItem([], [makeRelation("invoices", undefined)])} />,
    );

    expect(screen.getByRole("listitem")).toHaveTextContent("12invoices");
  });

  it("shows a loading count while a relation is pending", () => {
    mockToOne({ isPending: true });
    mockToMany({ isPending: true });
    render(
      <EntityItemRelationSummary
        item={makeItem(
          [makeRelation("customer", "Customer")],
          [makeRelation("invoices", "Invoices")],
        )}
      />,
    );

    expect(screen.getAllByText("Loading count")).toHaveLength(2);
  });

  it("renders plain entries without a click handler", () => {
    mockToOne({ isSuccess: true, data: null });
    render(<EntityItemRelationSummary item={makeItem([makeRelation("customer", "Customer")])} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Customer")).toBeInTheDocument();
  });

  it("calls onRelationClick with the relation's name", async () => {
    const user = userEvent.setup();
    const onRelationClick = vi.fn();
    mockToOne({ isSuccess: true, data: null });
    mockToMany({ data: { totalItems: { count: 3, isEstimated: true } } });
    render(
      <EntityItemRelationSummary
        item={makeItem(
          [makeRelation("customer", "Customer")],
          [makeRelation("invoices", "Invoices")],
        )}
        onRelationClick={onRelationClick}
        className="extra"
      />,
    );

    expect(screen.getByRole("list", { name: "Relations" })).toHaveClass("extra");
    await user.click(screen.getByRole("button", { name: /Customer/ }));
    await user.click(screen.getByRole("button", { name: /Invoices/ }));
    expect(onRelationClick.mock.calls).toEqual([["customer"], ["invoices"]]);
  });
});
