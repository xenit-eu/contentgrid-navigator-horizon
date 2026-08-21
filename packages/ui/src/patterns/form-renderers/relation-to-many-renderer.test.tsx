import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { EntityPickerOption } from "../entity-picker";
import {
  RelationToManyRenderer,
  type RelationToManyRendererProps,
} from "./relation-to-many-renderer";
import { relationToManyField } from "./test-fixtures";

const OPTIONS: EntityPickerOption[] = [{ id: "1", href: "/products/1", data: { name: "Widget" } }];

const BASE_PROPS: RelationToManyRendererProps = {
  field: relationToManyField(),
  value: [],
  onChange: vi.fn(),
  options: OPTIONS,
  isLoading: false,
  searchQuery: "",
  onSearch: vi.fn(),
  hasPreviousPage: false,
  hasNextPage: false,
  onPreviousPage: vi.fn(),
  onNextPage: vi.fn(),
  selectedItemsData: {},
  onItemResolved: vi.fn(),
};

function renderRenderer(overrides: Partial<RelationToManyRendererProps> = {}) {
  return render(<RelationToManyRenderer {...BASE_PROPS} {...overrides} />);
}

describe("RelationToManyRenderer", () => {
  it("shows a Link button and no items when nothing is linked", () => {
    renderRenderer();
    expect(screen.getByRole("button", { name: /link products/i })).toBeInTheDocument();
  });

  it("lists each linked item's data", () => {
    renderRenderer({
      value: ["/products/1", "/products/2"],
      selectedItemsData: { "/products/1": { name: "Widget" }, "/products/2": { name: "Gadget" } },
    });
    expect(screen.getByText("Widget")).toBeInTheDocument();
    expect(screen.getByText("Gadget")).toBeInTheDocument();
  });

  it("adds one item per picker selection, appending to the existing value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onItemResolved = vi.fn();
    renderRenderer({
      value: ["/products/2"],
      selectedItemsData: { "/products/2": { name: "Gadget" } },
      onChange,
      onItemResolved,
    });

    await user.click(screen.getByRole("button", { name: /link products/i }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByText("Widget").closest("tr")!);
    await user.click(within(dialog).getByRole("button", { name: "Select" }));

    expect(onChange).toHaveBeenCalledWith(["/products/2", "/products/1"]);
    expect(onItemResolved).toHaveBeenCalledWith("/products/1", { name: "Widget" });
  });

  it("removes one item by calling onChange with it filtered out", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderRenderer({
      value: ["/products/1", "/products/2"],
      selectedItemsData: { "/products/1": { name: "Widget" }, "/products/2": { name: "Gadget" } },
      onChange,
    });

    const [firstUnlink] = screen.getAllByRole("button", { name: /unlink/i });
    await user.click(firstUnlink);
    await user.click(screen.getByRole("button", { name: "Unlink" }));

    expect(onChange).toHaveBeenCalledWith(["/products/2"]);
  });

  it("hides Link/Unlink actions when the field is read-only", () => {
    renderRenderer({
      field: relationToManyField({ readOnly: true }),
      value: ["/products/1"],
      selectedItemsData: { "/products/1": { name: "Widget" } },
    });
    expect(screen.queryByRole("button", { name: /unlink/i })).not.toBeInTheDocument();
  });

  it("shows the validation error message", () => {
    renderRenderer({ error: "Something went wrong" });
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });
});
