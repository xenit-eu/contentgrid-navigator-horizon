import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { EntityPickerOption } from "../entity-picker";
import { RelationToOneRenderer, type RelationToOneRendererProps } from "./relation-to-one-renderer";
import { relationToOneField } from "./test-fixtures";

const OPTIONS: EntityPickerOption[] = [
  { id: "1", href: "/suppliers/1", data: { name: "Acme Corp" } },
];

const BASE_PROPS: RelationToOneRendererProps = {
  field: relationToOneField(),
  value: undefined,
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

function renderRenderer(overrides: Partial<RelationToOneRendererProps> = {}) {
  return render(<RelationToOneRenderer {...BASE_PROPS} {...overrides} />);
}

describe("RelationToOneRenderer", () => {
  it("shows a Link button and no dialog when nothing is linked", () => {
    renderRenderer();
    expect(screen.getByRole("button", { name: /link supplier/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the linked item's data when a value is set", () => {
    renderRenderer({
      value: "/suppliers/1",
      selectedItemsData: { "/suppliers/1": { name: "Acme Corp" } },
    });
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("opens the picker on Link and calls onChange + onItemResolved on selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onItemResolved = vi.fn();
    renderRenderer({ onChange, onItemResolved });

    await user.click(screen.getByRole("button", { name: /link supplier/i }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByText("Acme Corp").closest("tr")!);
    await user.click(within(dialog).getByRole("button", { name: "Select" }));

    expect(onChange).toHaveBeenCalledWith("/suppliers/1");
    expect(onItemResolved).toHaveBeenCalledWith("/suppliers/1", { name: "Acme Corp" });
  });

  it("unlinks by calling onChange(undefined)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderRenderer({
      value: "/suppliers/1",
      selectedItemsData: { "/suppliers/1": { name: "Acme Corp" } },
      onChange,
    });

    await user.click(screen.getByRole("button", { name: /unlink/i }));
    await user.click(screen.getByRole("button", { name: "Unlink" }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("hides Link/Unlink actions when the field is read-only", () => {
    renderRenderer({ field: relationToOneField({ readOnly: true }) });
    expect(screen.queryByRole("button", { name: /link supplier/i })).not.toBeInTheDocument();
  });

  it("shows the validation error message", () => {
    renderRenderer({ error: "Supplier is required" });
    expect(screen.getByText("Supplier is required")).toBeInTheDocument();
  });
});
