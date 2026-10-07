import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeSearchBarProfiles } from "@contentgrid/navigator-data/test-fixtures/msw/search-bar-fixtures";
import { resolveHalFormsFields } from "../../hal-forms";
import { type NumberQuickFilter as Model, buildQuickFilters } from "../util/build-quick-filters";
import { buildSearchParamDescriptors } from "../util/build-search-param-descriptors";
import { NumberQuickFilter } from "./number-quick-filter";

const { searchBar, all } = makeSearchBarProfiles();
const searchTemplate = searchBar.searchTemplate!;
const { fields } = resolveHalFormsFields(searchTemplate);
const descriptors = buildSearchParamDescriptors(fields, searchTemplate, all);
const quantityFields = fields.filter((f) => f.name.startsWith("quantity"));

function renderQuantity(filters: Record<string, string> = {}) {
  const quickFilter = buildQuickFilters(descriptors, filters).find(
    (q) => q.groupKey === "quantity",
  ) as Model;
  const onApply = vi.fn();
  const onClear = vi.fn();
  render(
    <NumberQuickFilter
      quickFilter={quickFilter}
      fields={quantityFields}
      searchTemplate={searchTemplate}
      filters={filters}
      onApply={onApply}
      onClear={onClear}
    />,
  );
  return { onApply, onClear };
}

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Quantity" }));
  return screen.findByRole("form", { name: "Quantity filter" });
}

describe("NumberQuickFilter", () => {
  it("renders the exact field on its own row and Min / Max side by side, through hal-forms", async () => {
    const user = userEvent.setup();
    renderQuantity();
    const form = await open(user);
    const inputs = within(form).getAllByRole("spinbutton");
    expect(inputs).toHaveLength(3);
    const min = within(form).getByLabelText("Quantity: Min");
    const max = within(form).getByLabelText("Quantity: Max");
    // Min and Max share one row (a two-column grid); the exact field does not.
    const row = (el: HTMLElement) => el.closest("[class*='grid']");
    expect(row(min)).not.toBeNull();
    expect(row(min)).toBe(row(max));
    expect(row(within(form).getByLabelText("Quantity"))).not.toBe(row(min));
  });

  it("applies only the inputs the user filled in", async () => {
    const user = userEvent.setup();
    const { onApply } = renderQuantity();
    const form = await open(user);
    await user.type(within(form).getByLabelText("Quantity: Min"), "3");
    await user.type(within(form).getByLabelText("Quantity: Max"), "10");
    await user.click(within(form).getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith("quantity", {
      quantity: undefined,
      "quantity~gte": "3",
      "quantity~lte": "10",
    });
  });

  it("starts from the current filters and applies nothing before Apply", async () => {
    const user = userEvent.setup();
    const { onApply } = renderQuantity({ "quantity~gte": "5" });
    const form = await open(user);
    expect(within(form).getByLabelText("Quantity: Min")).toHaveValue(5);
    await user.type(within(form).getByLabelText("Quantity: Max"), "9");
    expect(onApply).not.toHaveBeenCalled();
  });

  it("clears every parameter of the attribute", async () => {
    const user = userEvent.setup();
    const { onClear } = renderQuantity({ "quantity~gte": "5" });
    const form = await open(user);
    await user.click(within(form).getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalledWith("quantity");
  });
});
