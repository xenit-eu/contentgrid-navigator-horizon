import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FilterSidebar } from "./filter-sidebar";
import type { SearchProperty } from "./filter-sidebar";

const TEXT_PROP: SearchProperty = { name: "title", type: "text" };
const ENUM_PROP: SearchProperty = {
  name: "status",
  type: "text",
  options: { inline: ["active", "inactive", "pending"] },
};
const DATE_PROP: SearchProperty = { name: "created_at", type: "datetime" };
const DATE_AFTER_PROP: SearchProperty = {
  name: "created_at~after",
  type: "datetime",
};
const DATE_BEFORE_PROP: SearchProperty = {
  name: "created_at~before",
  type: "datetime",
};
const DATE_GTE_PROP: SearchProperty = {
  name: "due~gte",
  type: "datetime",
};
const DATE_LTE_PROP: SearchProperty = {
  name: "due~lte",
  type: "datetime",
};

function renderSidebar(
  filterProperties: SearchProperty[],
  filters: Record<string, string> = {},
  overrides: Partial<{
    onFilterChange: (key: string, value: string | undefined) => void;
    onClearAll: () => void;
  }> = {},
) {
  const onFilterChange = overrides.onFilterChange ?? vi.fn();
  const onClearAll = overrides.onClearAll;
  return {
    onFilterChange,
    ...render(
      <FilterSidebar
        filterProperties={filterProperties}
        filters={filters}
        onFilterChange={onFilterChange}
        onClearAll={onClearAll}
      />,
    ),
  };
}

describe("FilterSidebar — structure", () => {
  it("renders the 'Filters' heading", () => {
    renderSidebar([TEXT_PROP]);
    expect(screen.getByText("Filters")).toBeInTheDocument();
  });

  it("does not show 'Clear all' button when no active filters", () => {
    renderSidebar([TEXT_PROP], {}, { onClearAll: vi.fn() });
    expect(screen.queryByRole("button", { name: /clear all/i })).not.toBeInTheDocument();
  });

  it("shows 'Clear all' button when there are active filters and onClearAll is provided", () => {
    renderSidebar([TEXT_PROP], { title: "hello" }, { onClearAll: vi.fn() });
    expect(screen.getByRole("button", { name: /clear all/i })).toBeInTheDocument();
  });

  it("does not show 'Clear all' when onClearAll is undefined", () => {
    renderSidebar([TEXT_PROP], { title: "hello" });
    expect(screen.queryByRole("button", { name: /clear all/i })).not.toBeInTheDocument();
  });

  it("calls onClearAll when Clear all is clicked", async () => {
    const user = userEvent.setup();
    const onClearAll = vi.fn();
    renderSidebar([TEXT_PROP], { title: "hello" }, { onClearAll });
    await user.click(screen.getByRole("button", { name: /clear all/i }));
    expect(onClearAll).toHaveBeenCalled();
  });
});

describe("FilterSidebar — text filter (type=text, no options)", () => {
  it("renders a text input for plain text props", () => {
    renderSidebar([TEXT_PROP]);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders an <input type='text'> for a text-type search property", () => {
    renderSidebar([TEXT_PROP]);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.type).toBe("text");
  });

  it("calls onFilterChange with the typed value when text input changes", () => {
    const onFilterChange = vi.fn();
    renderSidebar([TEXT_PROP], {}, { onFilterChange });
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "hello" } });
    expect(onFilterChange).toHaveBeenCalledWith("title", "hello");
  });

  it("calls onFilterChange with undefined when text input is cleared", () => {
    const onFilterChange = vi.fn();
    renderSidebar([TEXT_PROP], { title: "existing" }, { onFilterChange });
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "" } });
    expect(onFilterChange).toHaveBeenCalledWith("title", undefined);
  });
});

describe("FilterSidebar — enum filter", () => {
  it("renders label for enum property", () => {
    renderSidebar([ENUM_PROP]);
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("shows clear button as invisible when no value is set", () => {
    const { container } = renderSidebar([ENUM_PROP], {});
    const clearBtn = container.querySelector("button.invisible");
    expect(clearBtn).toBeInTheDocument();
  });

  it("shows clear button as visible when a value is set", () => {
    const { container } = renderSidebar([ENUM_PROP], { status: "active" });
    // The invisible class should NOT be on the clear button
    const clearBtn = container.querySelector("button.invisible");
    expect(clearBtn).not.toBeInTheDocument();
  });

  it("calls onFilterChange with undefined when clear button is clicked", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    renderSidebar([ENUM_PROP], { status: "active" }, { onFilterChange });
    // The clear X button
    const clearBtn = screen.getByRole("button");
    await user.click(clearBtn);
    expect(onFilterChange).toHaveBeenCalledWith("status", undefined);
  });
});

describe("FilterSidebar — single date filter (type=datetime)", () => {
  it("renders a date input for datetime type props", () => {
    renderSidebar([DATE_PROP]);
    expect(screen.getByDisplayValue("")).toBeInTheDocument();
  });

  it("calls onFilterChange with ISO format when date input changes", () => {
    const onFilterChange = vi.fn();
    renderSidebar([DATE_PROP], {}, { onFilterChange });
    const input = screen.getByDisplayValue("");
    fireEvent.change(input, { target: { value: "2024-01-15" } });
    expect(onFilterChange).toHaveBeenCalledWith("created_at", "2024-01-15T00:00:00Z");
  });

  it("calls onFilterChange with undefined when date input is cleared", () => {
    const onFilterChange = vi.fn();
    renderSidebar([DATE_PROP], { created_at: "2024-01-15T00:00:00Z" }, { onFilterChange });
    const input = screen.getAllByDisplayValue("2024-01-15")[0];
    fireEvent.change(input, { target: { value: "" } });
    expect(onFilterChange).toHaveBeenCalledWith("created_at", undefined);
  });

  it("clears date filter when clear button is clicked", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    renderSidebar([DATE_PROP], { created_at: "2024-01-15T00:00:00Z" }, { onFilterChange });
    const clearBtn = screen.getByRole("button");
    await user.click(clearBtn);
    expect(onFilterChange).toHaveBeenCalledWith("created_at", undefined);
  });
});

describe("FilterSidebar — date suffix filters (DateFilter with direction)", () => {
  it("renders date inputs for the after suffix", () => {
    renderSidebar([DATE_AFTER_PROP]);
    const label = screen.getByText(/created at after/i);
    expect(label).toBeInTheDocument();
  });

  it("renders date inputs for the before suffix", () => {
    renderSidebar([DATE_BEFORE_PROP]);
    expect(screen.getByText(/created at before/i)).toBeInTheDocument();
  });

  it("renders date inputs for the gte suffix (from → After)", () => {
    renderSidebar([DATE_GTE_PROP]);
    expect(screen.getByText(/due after/i)).toBeInTheDocument();
  });

  it("renders date inputs for the lte suffix (until → Before)", () => {
    renderSidebar([DATE_LTE_PROP]);
    expect(screen.getByText(/due before/i)).toBeInTheDocument();
  });
});

describe("FilterSidebar — date group filter (multiple date props for same field)", () => {
  it("renders DateGroupFilter when multiple date-suffix props share the same base", () => {
    renderSidebar([DATE_AFTER_PROP, DATE_BEFORE_PROP]);
    // DateGroupFilter renders a span with the label
    const createdLabel = screen.getByText("Created At");
    expect(createdLabel).toBeInTheDocument();
  });

  it("renders After/Before direction labels in the group", () => {
    renderSidebar([DATE_AFTER_PROP, DATE_BEFORE_PROP]);
    expect(screen.getByText("After")).toBeInTheDocument();
    expect(screen.getByText("Before")).toBeInTheDocument();
  });

  it("renders After/Before direction labels for gte/lte suffixes (from/until map to After/Before)", () => {
    renderSidebar([DATE_GTE_PROP, DATE_LTE_PROP]);
    expect(screen.getByText("After")).toBeInTheDocument();
    expect(screen.getByText("Before")).toBeInTheDocument();
  });

  it("calls onFilterChange when a date input changes in a group", async () => {
    const onFilterChange = vi.fn();
    renderSidebar([DATE_AFTER_PROP, DATE_BEFORE_PROP], {}, { onFilterChange });
    const inputs = screen.getAllByDisplayValue("");
    fireEvent.change(inputs[0], { target: { value: "2024-03-01" } });
    expect(onFilterChange).toHaveBeenCalledWith("created_at~after", "2024-03-01T00:00:00Z");
  });
});

describe("FilterSidebar — label formatting", () => {
  it("uses prompt when provided", () => {
    const prop: SearchProperty = { name: "complex_field", type: "text", prompt: "My Label" };
    renderSidebar([ENUM_PROP, { ...prop, options: { inline: ["a"] } }]);
    expect(screen.getByText("My Label")).toBeInTheDocument();
  });

  it("capitalises underscore-separated field names", () => {
    const prop: SearchProperty = {
      name: "some_field_name",
      type: "text",
      options: { inline: ["x"] },
    };
    renderSidebar([prop]);
    expect(screen.getByText("Some Field Name")).toBeInTheDocument();
  });

  it("renders separator between groups", () => {
    const { container } = renderSidebar([ENUM_PROP, DATE_PROP]);
    // Two different groups → a separator should be rendered
    expect(container.querySelector("[data-orientation='horizontal']")).toBeInTheDocument();
  });
});

describe("FilterSidebar — numeric range operators (~gt/~gte/~lt/~lte on non-date fields)", () => {
  const AMOUNT_GTE_PROP: SearchProperty = { name: "amount~gte", type: "number" };
  const AMOUNT_LTE_PROP: SearchProperty = { name: "amount~lte", type: "number" };

  it("renders numeric range fields as text inputs with After/Before direction labels", () => {
    // gte/lte map to the "from"/"until" search-type label, which getDirectionLabel
    // normalises to the same "After"/"Before" wording used for gt/lt and after/before.
    renderSidebar([AMOUNT_GTE_PROP, AMOUNT_LTE_PROP]);
    expect(screen.getByLabelText(/amount after/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount before/i)).toBeInTheDocument();
  });

  it("renders as two independent text inputs rather than a date group", () => {
    renderSidebar([AMOUNT_GTE_PROP, AMOUNT_LTE_PROP]);
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
  });

  it("encodes the raw text value in onFilterChange for a numeric range field", () => {
    const onFilterChange = vi.fn();
    renderSidebar([AMOUNT_GTE_PROP], {}, { onFilterChange });
    const input = screen.getByLabelText(/amount after/i);
    fireEvent.change(input, { target: { value: "100" } });
    expect(onFilterChange).toHaveBeenCalledWith("amount~gte", "100");
  });
});

describe("FilterSidebar — apiToDate conversion", () => {
  it("shows existing ISO date value as yyyy-MM-dd in the input", () => {
    renderSidebar([DATE_PROP], { created_at: "2024-06-15T00:00:00Z" });
    expect(screen.getByDisplayValue("2024-06-15")).toBeInTheDocument();
  });

  it("handles non-ISO date string gracefully (plain yyyy-MM-dd)", () => {
    renderSidebar([DATE_PROP], { created_at: "2024-06-15" });
    expect(screen.getByDisplayValue("2024-06-15")).toBeInTheDocument();
  });

  it("renders without throwing when date value is a garbage/invalid string (apiToDate fallback)", () => {
    expect(() => renderSidebar([DATE_PROP], { created_at: "not-a-date-at-all" })).not.toThrow();
  });
});

describe("FilterSidebar — DateFilter clear button (single date prop)", () => {
  it("calls onFilterChange with undefined when the clear button is clicked on a date filter with a value", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    renderSidebar(
      [DATE_AFTER_PROP],
      { "created_at~after": "2024-01-01T00:00:00Z" },
      { onFilterChange },
    );
    const clearBtn = screen.getByRole("button");
    await user.click(clearBtn);
    expect(onFilterChange).toHaveBeenCalledWith("created_at~after", undefined);
  });
});

describe("FilterSidebar — DateGroupFilter clear button (grouped date props)", () => {
  it("calls onFilterChange with undefined when the clear button is clicked in a DateGroupFilter with a value", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    // Two props with the same base ("created_at") → DateGroupFilter renders (isDateGroup=true)
    renderSidebar(
      [DATE_AFTER_PROP, DATE_BEFORE_PROP],
      { "created_at~after": "2024-01-01T00:00:00Z" },
      { onFilterChange },
    );
    // The clear button for the prop with a value should be visible (not invisible)
    const buttons = screen.getAllByRole("button");
    const visibleClear = buttons.find((btn) => !btn.classList.contains("invisible"));
    expect(visibleClear).toBeDefined();
    await user.click(visibleClear!);
    expect(onFilterChange).toHaveBeenCalledWith("created_at~after", undefined);
  });
});
