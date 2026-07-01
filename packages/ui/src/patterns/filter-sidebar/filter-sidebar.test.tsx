import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FilterSidebar } from "./filter-sidebar";
import type { SearchFilterProperty } from "./filter-sidebar";

// ---------------------------------------------------------------------------
// Fixtures — pre-computed SearchFilterProperty objects as buildFilterProperties
// in @contentgrid/navigator-data would produce them.
// ---------------------------------------------------------------------------

const TEXT_PROP: SearchFilterProperty = {
  name: "title",
  label: "Title",
  inputKind: "text",
  searchOperator: "exact-match",
  groupKey: "title",
};

const ENUM_PROP: SearchFilterProperty = {
  name: "status",
  label: "Status",
  inputKind: "select",
  searchOperator: "exact-match",
  groupKey: "status",
  options: ["active", "inactive", "pending"],
};

const DATE_PROP: SearchFilterProperty = {
  name: "created_at",
  label: "Created At",
  inputKind: "date",
  searchOperator: "exact-match",
  groupKey: "created_at",
  dateEncoding: "iso",
};

const DATE_GT_PROP: SearchFilterProperty = {
  name: "created_at~greater-than",
  label: "Created At",
  inputKind: "date",
  searchOperator: "greater-than",
  groupKey: "created_at",
  directionLabel: "After",
  dateEncoding: "iso",
};

const DATE_LT_PROP: SearchFilterProperty = {
  name: "created_at~less-than",
  label: "Created At",
  inputKind: "date",
  searchOperator: "less-than",
  groupKey: "created_at",
  directionLabel: "Before",
  dateEncoding: "iso",
};

// greater-than-or-equal → "From" direction (inclusive lower bound)
const DATE_GTE_PROP: SearchFilterProperty = {
  name: "due~greater-than-or-equal-to",
  label: "Due",
  inputKind: "date",
  searchOperator: "greater-than-or-equal",
  groupKey: "due",
  directionLabel: "From",
  dateEncoding: "iso",
};

// less-than-or-equal → "Until" direction (inclusive upper bound)
const DATE_LTE_PROP: SearchFilterProperty = {
  name: "due~less-than-or-equal-to",
  label: "Due",
  inputKind: "date",
  searchOperator: "less-than-or-equal",
  groupKey: "due",
  directionLabel: "Until",
  dateEncoding: "iso",
};

const PREFIX_PROP: SearchFilterProperty = {
  name: "number~prefix",
  label: "Number",
  inputKind: "text",
  searchOperator: "prefix-match",
  groupKey: "number",
};

const EXACT_PROP: SearchFilterProperty = {
  name: "number",
  label: "Number",
  inputKind: "text",
  searchOperator: "exact-match",
  groupKey: "number",
};

function renderSidebar(
  filterProperties: SearchFilterProperty[],
  filters: Record<string, string> = {},
  overrides: Partial<{
    onFilterChange: (key: string, value: string | undefined) => void;
    onClearAll: () => void;
    onTypeaheadSearch: (fieldParam: string, query: string) => void;
    typeaheadSuggestions: Record<string, string[]>;
    typeaheadIsLoading: Record<string, boolean>;
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
        onTypeaheadSearch={overrides.onTypeaheadSearch}
        typeaheadSuggestions={overrides.typeaheadSuggestions}
        typeaheadIsLoading={overrides.typeaheadIsLoading}
      />,
    ),
  };
}

describe("FilterSidebar — structure", () => {
  it("renders the 'Filters' heading", () => {
    renderSidebar([TEXT_PROP]);
    // Verifies the sidebar label is present and visible
    expect(screen.getByText("Filters")).toBeVisible();
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

describe("FilterSidebar — text filter", () => {
  it("renders an accessible text input labeled by the property label", () => {
    renderSidebar([TEXT_PROP]);
    expect(screen.getByLabelText("Title")).toHaveAttribute("type", "text");
  });

  it("shows the current filter value in the input", () => {
    renderSidebar([TEXT_PROP], { title: "hello world" });
    expect(screen.getByLabelText("Title")).toHaveValue("hello world");
  });

  it("calls onFilterChange with the typed value when text input changes", () => {
    const onFilterChange = vi.fn();
    renderSidebar([TEXT_PROP], {}, { onFilterChange });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "hello" } });
    expect(onFilterChange).toHaveBeenCalledWith("title", "hello");
  });

  it("calls onFilterChange with undefined when text input is cleared", () => {
    const onFilterChange = vi.fn();
    renderSidebar([TEXT_PROP], { title: "existing" }, { onFilterChange });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "" } });
    expect(onFilterChange).toHaveBeenCalledWith("title", undefined);
  });

  it("calls onFilterChange with undefined when the clear button is clicked on a text filter with a value", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    renderSidebar([TEXT_PROP], { title: "hello" }, { onFilterChange });
    await user.click(screen.getByRole("button", { name: /clear/i }));
    expect(onFilterChange).toHaveBeenCalledWith("title", undefined);
  });
});

describe("FilterSidebar — enum filter", () => {
  it("shows 'All' as the default placeholder when no value is selected", () => {
    renderSidebar([ENUM_PROP]);
    expect(screen.getByRole("combobox", { name: /status/i })).toHaveTextContent("All");
  });

  it("shows the current selected option in the combobox", () => {
    renderSidebar([ENUM_PROP], { status: "active" });
    expect(screen.getByRole("combobox", { name: /status/i })).toHaveTextContent("Active");
  });

  it("calls onFilterChange with the selected value when an option is chosen", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    renderSidebar([ENUM_PROP], {}, { onFilterChange });
    await user.click(screen.getByRole("combobox", { name: /status/i }));
    await user.click(screen.getByRole("option", { name: /pending/i }));
    expect(onFilterChange).toHaveBeenCalledWith("status", "pending");
  });

  it("calls onFilterChange with undefined when clear button is clicked", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    renderSidebar([ENUM_PROP], { status: "active" }, { onFilterChange });
    await user.click(screen.getByRole("button", { name: /clear/i }));
    expect(onFilterChange).toHaveBeenCalledWith("status", undefined);
  });
});

describe("FilterSidebar — single date filter (inputKind=date)", () => {
  it("renders a date input for date props", () => {
    renderSidebar([DATE_PROP]);
    expect(screen.getByLabelText("Created At")).toHaveAttribute("type", "date");
  });

  it("calls onFilterChange with ISO format when date input changes", () => {
    const onFilterChange = vi.fn();
    renderSidebar([DATE_PROP], {}, { onFilterChange });
    fireEvent.change(screen.getByLabelText("Created At"), { target: { value: "2024-01-15" } });
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
    const clearBtn = screen.getByRole("button", { name: /clear/i });
    await user.click(clearBtn);
    expect(onFilterChange).toHaveBeenCalledWith("created_at", undefined);
  });
});

describe("FilterSidebar — date direction filters (single props with directionLabel)", () => {
  it("accessible label for greater-than includes 'after' direction sub-label", () => {
    renderSidebar([DATE_GT_PROP]);
    expect(screen.getByLabelText(/created at after/i)).toHaveAttribute("type", "date");
  });

  it("accessible label for less-than includes 'before' direction sub-label", () => {
    renderSidebar([DATE_LT_PROP]);
    expect(screen.getByLabelText(/created at before/i)).toHaveAttribute("type", "date");
  });

  it("accessible label for greater-than-or-equal includes 'from' direction sub-label", () => {
    renderSidebar([DATE_GTE_PROP]);
    expect(screen.getByLabelText(/due from/i)).toHaveAttribute("type", "date");
  });

  it("accessible label for less-than-or-equal includes 'until' direction sub-label", () => {
    renderSidebar([DATE_LTE_PROP]);
    expect(screen.getByLabelText(/due until/i)).toHaveAttribute("type", "date");
  });
});

describe("FilterSidebar — date group filter (multiple date props for same groupKey)", () => {
  it("renders DateGroupFilter with group label and direction labels when multiple date props share the same groupKey", () => {
    renderSidebar([DATE_GT_PROP, DATE_LT_PROP]);
    expect(screen.getByText("Created At")).toBeInTheDocument();
    expect(screen.getByText("After")).toBeInTheDocument();
    expect(screen.getByText("Before")).toBeInTheDocument();
  });

  it("renders From/Until direction labels for gte/lte props", () => {
    renderSidebar([DATE_GTE_PROP, DATE_LTE_PROP]);
    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByText("Until")).toBeInTheDocument();
  });

  it("calls onFilterChange for the correct param when the After date input changes", () => {
    const onFilterChange = vi.fn();
    renderSidebar([DATE_GT_PROP, DATE_LT_PROP], {}, { onFilterChange });
    fireEvent.change(screen.getByLabelText(/created at after/i), {
      target: { value: "2024-03-01" },
    });
    expect(onFilterChange).toHaveBeenCalledWith("created_at~greater-than", "2024-03-01T00:00:00Z");
  });

  it("calls onFilterChange for the correct param when the Before date input changes", () => {
    const onFilterChange = vi.fn();
    renderSidebar([DATE_GT_PROP, DATE_LT_PROP], {}, { onFilterChange });
    fireEvent.change(screen.getByLabelText(/created at before/i), {
      target: { value: "2024-06-30" },
    });
    expect(onFilterChange).toHaveBeenCalledWith("created_at~less-than", "2024-06-30T00:00:00Z");
  });
});

describe("FilterSidebar — label rendering", () => {
  it("uses the pre-computed label as the accessible name for its input", () => {
    const prop: SearchFilterProperty = {
      name: "complex_field",
      label: "My Label",
      inputKind: "select",
      searchOperator: "exact-match",
      groupKey: "complex_field",
      options: ["a"],
    };
    renderSidebar([prop]);
    expect(screen.getByRole("combobox", { name: "My Label" })).toHaveTextContent("All");
  });

  it("renders a select and a date input when two different-kind props are given", () => {
    renderSidebar([ENUM_PROP, DATE_PROP]);
    expect(screen.getByRole("combobox", { name: /status/i })).toBeVisible();
    expect(screen.getByLabelText(/created at/i)).toHaveAttribute("type", "date");
  });
});

describe("FilterSidebar — range-pair operators (field.~op)", () => {
  const DATE_FROM_PROP: SearchFilterProperty = {
    name: "created.~from",
    label: "Created",
    inputKind: "date",
    searchOperator: "greater-than-or-equal",
    groupKey: "created",
    directionLabel: "From",
    dateEncoding: "plain",
  };
  const DATE_UNTIL_PROP: SearchFilterProperty = {
    name: "created.~until",
    label: "Created",
    inputKind: "date",
    searchOperator: "less-than-or-equal",
    groupKey: "created",
    directionLabel: "Until",
    dateEncoding: "plain",
  };
  const NUM_GTE_PROP: SearchFilterProperty = {
    name: "amount.~gte",
    label: "Amount",
    inputKind: "text",
    searchOperator: "greater-than-or-equal",
    groupKey: "amount",
    directionLabel: "From",
  };
  const NUM_LTE_PROP: SearchFilterProperty = {
    name: "amount.~lte",
    label: "Amount",
    inputKind: "text",
    searchOperator: "less-than-or-equal",
    groupKey: "amount",
    directionLabel: "Until",
  };

  it("renders date inputs for ~from and ~until operators", () => {
    renderSidebar([DATE_FROM_PROP, DATE_UNTIL_PROP]);
    expect(screen.getByLabelText(/created from/i)).toHaveAttribute("type", "date");
    expect(screen.getByLabelText(/created until/i)).toHaveAttribute("type", "date");
  });

  it("renders the group heading exactly once (not once per date input)", () => {
    renderSidebar([DATE_FROM_PROP, DATE_UNTIL_PROP]);
    expect(screen.getAllByText("Created")).toHaveLength(1);
    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByText("Until")).toBeInTheDocument();
  });

  it("encodes ~from value as plain yyyy-MM-dd (no ISO time suffix)", () => {
    const onFilterChange = vi.fn();
    renderSidebar([DATE_FROM_PROP], {}, { onFilterChange });
    fireEvent.change(screen.getByLabelText(/created from/i), { target: { value: "2026-01-01" } });
    expect(onFilterChange).toHaveBeenCalledWith("created.~from", "2026-01-01");
  });

  it("encodes ~until value as plain yyyy-MM-dd (no ISO time suffix)", () => {
    const onFilterChange = vi.fn();
    renderSidebar([DATE_UNTIL_PROP], {}, { onFilterChange });
    fireEvent.change(screen.getByLabelText(/created until/i), { target: { value: "2026-12-31" } });
    expect(onFilterChange).toHaveBeenCalledWith("created.~until", "2026-12-31");
  });

  it("decodes plain yyyy-MM-dd value back into the date input (lossless round-trip)", () => {
    renderSidebar([DATE_FROM_PROP], { "created.~from": "2026-06-15" });
    expect(screen.getByDisplayValue("2026-06-15")).toHaveAttribute("type", "date");
  });

  it("calls onFilterChange with undefined when ~from input is cleared", () => {
    const onFilterChange = vi.fn();
    renderSidebar([DATE_FROM_PROP], { "created.~from": "2026-01-01" }, { onFilterChange });
    const input = screen.getByDisplayValue("2026-01-01");
    fireEvent.change(input, { target: { value: "" } });
    expect(onFilterChange).toHaveBeenCalledWith("created.~from", undefined);
  });

  it("encodes grouped ~from value as plain date (no ISO) in DateGroupFilter", () => {
    const onFilterChange = vi.fn();
    renderSidebar([DATE_FROM_PROP, DATE_UNTIL_PROP], {}, { onFilterChange });
    fireEvent.change(screen.getByLabelText(/created from/i), { target: { value: "2026-03-01" } });
    expect(onFilterChange).toHaveBeenCalledWith("created.~from", "2026-03-01");
  });

  it("encodes grouped ~until value as plain date (no ISO) in DateGroupFilter", () => {
    const onFilterChange = vi.fn();
    renderSidebar([DATE_FROM_PROP, DATE_UNTIL_PROP], {}, { onFilterChange });
    fireEvent.change(screen.getByLabelText(/created until/i), { target: { value: "2026-12-31" } });
    expect(onFilterChange).toHaveBeenCalledWith("created.~until", "2026-12-31");
  });

  it("renders ~gte and ~lte text fields with From/Until direction labels", () => {
    renderSidebar([NUM_GTE_PROP, NUM_LTE_PROP]);
    expect(screen.getByLabelText(/amount from/i)).toHaveAttribute("type", "text");
    expect(screen.getByLabelText(/amount until/i)).toHaveAttribute("type", "text");
  });

  it("encodes ~gte value in onFilterChange", () => {
    const onFilterChange = vi.fn();
    renderSidebar([NUM_GTE_PROP], {}, { onFilterChange });
    const input = screen.getByLabelText(/amount from/i);
    fireEvent.change(input, { target: { value: "100" } });
    expect(onFilterChange).toHaveBeenCalledWith("amount.~gte", "100");
  });

  it("encodes ~lte value in onFilterChange", () => {
    const onFilterChange = vi.fn();
    renderSidebar([NUM_LTE_PROP], {}, { onFilterChange });
    const input = screen.getByLabelText(/amount until/i);
    fireEvent.change(input, { target: { value: "500" } });
    expect(onFilterChange).toHaveBeenCalledWith("amount.~lte", "500");
  });
});

describe("FilterSidebar — apiToDate conversion", () => {
  it("strips the time component from ISO date strings for the date input", () => {
    renderSidebar([DATE_PROP], { created_at: "2024-06-15T00:00:00Z" });
    expect(screen.getByDisplayValue("2024-06-15")).toHaveAttribute("type", "date");
  });

  it("passes plain yyyy-MM-dd strings through unchanged to the date input", () => {
    renderSidebar([DATE_PROP], { created_at: "2024-06-15" });
    expect(screen.getByDisplayValue("2024-06-15")).toHaveAttribute("type", "date");
  });

  it("renders the date input without crashing for non-parseable date strings", () => {
    // jsdom sanitises date input values to "" for invalid strings — the meaningful
    // check is that the component renders without throwing
    renderSidebar([DATE_PROP], { created_at: "not-a-date-at-all" });
    expect(screen.getByLabelText("Created At")).toHaveAttribute("type", "date");
  });
});

describe("FilterSidebar — DateFilter clear button (single date prop)", () => {
  it("calls onFilterChange with undefined when the clear button is clicked on a date filter with a value", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    renderSidebar(
      [DATE_GT_PROP],
      { "created_at~greater-than": "2024-01-01T00:00:00Z" },
      { onFilterChange },
    );
    const clearBtn = screen.getByRole("button", { name: /clear/i });
    await user.click(clearBtn);
    expect(onFilterChange).toHaveBeenCalledWith("created_at~greater-than", undefined);
  });
});

describe("FilterSidebar — exact-match suppression when a prefix-match sibling exists", () => {
  it("hides the exact-match field when a prefix-match sibling exists in the same group", () => {
    renderSidebar([EXACT_PROP, PREFIX_PROP]);
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(1);
  });

  it("the remaining input fires onFilterChange with the prefix-match param, not the exact-match param", () => {
    const onFilterChange = vi.fn();
    renderSidebar([EXACT_PROP, PREFIX_PROP], {}, { onFilterChange });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "abc" } });
    expect(onFilterChange).toHaveBeenCalledWith("number~prefix", "abc");
    expect(onFilterChange).not.toHaveBeenCalledWith("number", expect.anything());
  });

  it("renders both fields as separate inputs when they have different groupKeys", () => {
    const A: SearchFilterProperty = {
      name: "title",
      label: "Title",
      inputKind: "text",
      searchOperator: "exact-match",
      groupKey: "title",
    };
    const B: SearchFilterProperty = {
      name: "code",
      label: "Code",
      inputKind: "text",
      searchOperator: "exact-match",
      groupKey: "code",
    };
    renderSidebar([A, B]);
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
  });
});

describe("FilterSidebar — TypeaheadTextFilter", () => {
  it("renders a plain TextFilter for prefix-match fields when onTypeaheadSearch is not provided", () => {
    renderSidebar([PREFIX_PROP]);
    expect(screen.getByRole("textbox")).not.toHaveAttribute("autocomplete", "off");
  });

  it("renders a typeahead input for prefix-match fields when onTypeaheadSearch is provided", () => {
    const onTypeaheadSearch = vi.fn();
    renderSidebar([PREFIX_PROP], {}, { onTypeaheadSearch });
    expect(screen.getByRole("textbox")).toHaveAttribute("autocomplete", "off");
  });

  it("shows the current filter value in the typeahead input", () => {
    renderSidebar([PREFIX_PROP], { "number~prefix": "INV-001" }, { onTypeaheadSearch: vi.fn() });
    expect(screen.getByRole("textbox")).toHaveValue("INV-001");
  });

  it("calls onTypeaheadSearch and onFilterChange when user types", () => {
    const onFilterChange = vi.fn();
    const onTypeaheadSearch = vi.fn();
    renderSidebar([PREFIX_PROP], {}, { onFilterChange, onTypeaheadSearch });

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "INV" } });

    expect(onFilterChange).toHaveBeenCalledWith("number~prefix", "INV");
    expect(onTypeaheadSearch).toHaveBeenCalledWith("number~prefix", "INV");
  });

  it("calls onFilterChange with undefined and onTypeaheadSearch with empty when input is cleared", () => {
    const onFilterChange = vi.fn();
    const onTypeaheadSearch = vi.fn();
    renderSidebar([PREFIX_PROP], { "number~prefix": "INV" }, { onFilterChange, onTypeaheadSearch });

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });

    expect(onFilterChange).toHaveBeenCalledWith("number~prefix", undefined);
    expect(onTypeaheadSearch).toHaveBeenCalledWith("number~prefix", "");
  });

  it("shows all suggestions as selectable options when typeaheadSuggestions are provided and input is typed", () => {
    const onTypeaheadSearch = vi.fn();
    renderSidebar(
      [PREFIX_PROP],
      {},
      {
        onTypeaheadSearch,
        typeaheadSuggestions: { "number~prefix": ["INV-001", "INV-002"] },
      },
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "INV" } });

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("INV-001");
    expect(options[1]).toHaveTextContent("INV-002");
  });

  it("calls onFilterChange with the suggestion and clears search when a suggestion is clicked", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    const onTypeaheadSearch = vi.fn();
    renderSidebar(
      [PREFIX_PROP],
      {},
      {
        onFilterChange,
        onTypeaheadSearch,
        typeaheadSuggestions: { "number~prefix": ["INV-001", "INV-002"] },
      },
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "INV" } });
    await user.click(screen.getByText("INV-001"));

    expect(onFilterChange).toHaveBeenCalledWith("number~prefix", "INV-001");
    expect(onTypeaheadSearch).toHaveBeenCalledWith("number~prefix", "");
  });

  it("clears the filter and search when the clear button is clicked on a typeahead field", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    const onTypeaheadSearch = vi.fn();
    renderSidebar(
      [PREFIX_PROP],
      { "number~prefix": "INV-001" },
      { onFilterChange, onTypeaheadSearch },
    );

    const clearBtn = screen.getByRole("button", { name: /clear/i });
    await user.click(clearBtn);

    expect(onFilterChange).toHaveBeenCalledWith("number~prefix", undefined);
    expect(onTypeaheadSearch).toHaveBeenCalledWith("number~prefix", "");
  });
});

describe("FilterSidebar — DateGroupFilter clear button (grouped date props)", () => {
  it("calls onFilterChange with undefined when the clear button is clicked in a DateGroupFilter with a value", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    renderSidebar(
      [DATE_GT_PROP, DATE_LT_PROP],
      { "created_at~greater-than": "2024-01-01T00:00:00Z" },
      { onFilterChange },
    );
    // Each date group item gets its own descriptive clear button label
    const clearBtn = screen.getByRole("button", { name: /clear created at after/i });
    await user.click(clearBtn);
    expect(onFilterChange).toHaveBeenCalledWith("created_at~greater-than", undefined);
  });
});
