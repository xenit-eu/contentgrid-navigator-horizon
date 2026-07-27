import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { format } from "date-fns";
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

const BOOLEAN_PROP: SearchFilterProperty = {
  name: "active",
  label: "Active",
  inputKind: "boolean",
  searchOperator: "exact-match",
  groupKey: "active",
};

const NUMBER_PROP: SearchFilterProperty = {
  name: "amount",
  label: "Amount",
  inputKind: "number",
  searchOperator: "exact-match",
  groupKey: "amount",
};

const DATETIME_PROP: SearchFilterProperty = {
  name: "due_at",
  label: "Due At",
  inputKind: "datetime",
  searchOperator: "exact-match",
  groupKey: "due_at",
  dateEncoding: "iso",
};

const DATETIME_GT_PROP: SearchFilterProperty = {
  name: "due_at~greater-than",
  label: "Due At",
  inputKind: "datetime",
  searchOperator: "greater-than",
  groupKey: "due_at",
  directionLabel: "After",
  dateEncoding: "iso",
};

const DATETIME_LT_PROP: SearchFilterProperty = {
  name: "due_at~less-than",
  label: "Due At",
  inputKind: "datetime",
  searchOperator: "less-than",
  groupKey: "due_at",
  directionLabel: "Before",
  dateEncoding: "iso",
};

function renderSidebar(
  filterProperties: SearchFilterProperty[],
  filters: Record<string, string> = {},
  overrides: Partial<{
    onFilterChange: (key: string, value: string | undefined) => void;
    onClearAll: () => void;
    onTypeaheadSearch: (fieldParam: string, query: string) => void;
    activeTypeaheadField: string;
    typeaheadSuggestions: string[];
    typeaheadIsLoading: boolean;
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
        activeTypeaheadField={overrides.activeTypeaheadField}
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

// Clear-button and text-input wiring are already covered by the "text filter" describe
// block above — number reuses that same component, so only the kind-specific behavior
// (the number input type) is tested here.

describe("FilterSidebar — boolean filter (inputKind=boolean)", () => {
  it("renders as an unchecked checkbox by default and reports 'true' when checked", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    renderSidebar([BOOLEAN_PROP], {}, { onFilterChange });
    const checkbox = screen.getByRole("checkbox", { name: /active/i });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(onFilterChange).toHaveBeenCalledWith("active", "true");
  });

  it("reports 'false' (not undefined) when an already-true filter is unchecked", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    renderSidebar([BOOLEAN_PROP], { active: "true" }, { onFilterChange });
    const checkbox = screen.getByRole("checkbox", { name: /active/i });
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(onFilterChange).toHaveBeenCalledWith("active", "false");
  });
});

describe("FilterSidebar — number filter (inputKind=number)", () => {
  it("renders a number input and forwards the typed value", () => {
    const onFilterChange = vi.fn();
    renderSidebar([NUMBER_PROP], {}, { onFilterChange });
    const input = screen.getByLabelText("Amount");
    expect(input).toHaveAttribute("type", "number");
    fireEvent.change(input, { target: { value: "42" } });
    expect(onFilterChange).toHaveBeenCalledWith("amount", "42");
  });
});

// The datetime-local input has no timezone marker, so encoding must convert the entered
// local wall-clock time to a true UTC instant. Expected values are computed the same way
// (rather than hardcoded) so the test is correct under any runner timezone.
function localDatetimeToUtcIso(raw: string): string {
  return `${new Date(raw).toISOString().split(".")[0]}Z`;
}

describe("FilterSidebar — datetime filter (inputKind=datetime)", () => {
  it("renders a datetime-local input and encodes the entered local time as a UTC instant", () => {
    const onFilterChange = vi.fn();
    renderSidebar([DATETIME_PROP], {}, { onFilterChange });
    const input = screen.getByLabelText("Due At");
    expect(input).toHaveAttribute("type", "datetime-local");
    fireEvent.change(input, { target: { value: "2024-01-15T10:30" } });
    expect(onFilterChange).toHaveBeenCalledWith(
      "due_at",
      localDatetimeToUtcIso("2024-01-15T10:30"),
    );
  });

  it("decodes a stored ISO value back into the datetime-local input (timezone-safe round trip)", () => {
    const iso = "2024-01-15T10:30:00Z";
    renderSidebar([DATETIME_PROP], { due_at: iso });
    const expected = format(new Date(iso), "yyyy-MM-dd'T'HH:mm");
    expect(screen.getByDisplayValue(expected)).toHaveAttribute("type", "datetime-local");
  });

  it("renders paired datetime-local inputs in a group and encodes the correct param", () => {
    const onFilterChange = vi.fn();
    renderSidebar([DATETIME_GT_PROP, DATETIME_LT_PROP], {}, { onFilterChange });
    const after = screen.getByLabelText(/due at after/i);
    expect(after).toHaveAttribute("type", "datetime-local");
    fireEvent.change(after, { target: { value: "2024-03-01T08:00" } });
    expect(onFilterChange).toHaveBeenCalledWith(
      "due_at~greater-than",
      localDatetimeToUtcIso("2024-03-01T08:00"),
    );
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
  it("renders RangeGroupFilter with group label and direction labels when multiple date props share the same groupKey", () => {
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
    inputKind: "number",
    searchOperator: "greater-than-or-equal",
    groupKey: "amount",
    directionLabel: "From",
  };
  const NUM_LTE_PROP: SearchFilterProperty = {
    name: "amount.~lte",
    label: "Amount",
    inputKind: "number",
    searchOperator: "less-than-or-equal",
    groupKey: "amount",
    directionLabel: "Until",
  };

  // Reproduces a real bug report: the backend's own prompt for each range operator can
  // already contain operator wording (e.g. "Total amount: Greater than", "Total amount:
  // Min"). Rendered standalone (pre-fix), each field concatenated that with our own
  // directionLabel too, producing "Total amount: Greater than after". Grouped, only the
  // clean directionLabel ("From"/"Until") should show per item — and, matching the legacy
  // Navigator's range-pairing behavior (RangedJsfFormConvertor/NestedRange), the strict
  // gt/lt bound is dropped once the inclusive gte/lte bound covering the same direction
  // exists, leaving exactly two inputs instead of four. Covered by the three tests below.
  const GT_PROP: SearchFilterProperty = {
    name: "total.~gt",
    label: "Total amount: Greater than",
    inputKind: "number",
    searchOperator: "greater-than",
    groupKey: "total",
    directionLabel: "After",
  };
  const GTE_PROP: SearchFilterProperty = {
    name: "total.~gte",
    label: "Total amount: Min",
    inputKind: "number",
    searchOperator: "greater-than-or-equal",
    groupKey: "total",
    directionLabel: "From",
  };
  const LT_PROP: SearchFilterProperty = {
    name: "total.~lt",
    label: "Total amount: Less than",
    inputKind: "number",
    searchOperator: "less-than",
    groupKey: "total",
    directionLabel: "Before",
  };
  const LTE_PROP: SearchFilterProperty = {
    name: "total.~lte",
    label: "Total amount: Max",
    inputKind: "number",
    searchOperator: "less-than-or-equal",
    groupKey: "total",
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

  it("encodes grouped ~from value as plain date (no ISO) in RangeGroupFilter", () => {
    const onFilterChange = vi.fn();
    renderSidebar([DATE_FROM_PROP, DATE_UNTIL_PROP], {}, { onFilterChange });
    fireEvent.change(screen.getByLabelText(/created from/i), { target: { value: "2026-03-01" } });
    expect(onFilterChange).toHaveBeenCalledWith("created.~from", "2026-03-01");
  });

  it("encodes grouped ~until value as plain date (no ISO) in RangeGroupFilter", () => {
    const onFilterChange = vi.fn();
    renderSidebar([DATE_FROM_PROP, DATE_UNTIL_PROP], {}, { onFilterChange });
    fireEvent.change(screen.getByLabelText(/created until/i), { target: { value: "2026-12-31" } });
    expect(onFilterChange).toHaveBeenCalledWith("created.~until", "2026-12-31");
  });

  it("renders ~gte and ~lte number fields with From/Until direction labels", () => {
    renderSidebar([NUM_GTE_PROP, NUM_LTE_PROP]);
    expect(screen.getByLabelText(/amount from/i)).toHaveAttribute("type", "number");
    expect(screen.getByLabelText(/amount until/i)).toHaveAttribute("type", "number");
  });

  it("renders the number group heading exactly once (not once per number input)", () => {
    renderSidebar([NUM_GTE_PROP, NUM_LTE_PROP]);
    expect(screen.getAllByText("Amount")).toHaveLength(1);
    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByText("Until")).toBeInTheDocument();
  });

  it("groups all four range operators under one heading, not four separate compound labels", () => {
    renderSidebar([GT_PROP, GTE_PROP, LT_PROP, LTE_PROP]);

    expect(screen.getAllByText("Total amount: Greater than")).toHaveLength(1);
    expect(screen.queryByText(/total amount: min/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/total amount: less than/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/total amount: max/i)).not.toBeInTheDocument();
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

describe("FilterSidebar — isoToDateInputValue conversion", () => {
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

describe("FilterSidebar — grouping by groupKey", () => {
  // Redundant-sibling suppression (bare exact-match alongside a prefix/full-text/range
  // variant) is decided in buildFilterProperties() (@contentgrid/navigator-data) — see
  // filter-properties.test.ts — not in FilterSidebar, which just renders whatever list of
  // properties it's given.
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
  const RELATION_PREFIX_PROP: SearchFilterProperty = {
    name: "customer.name~prefix",
    label: "Customer Name",
    inputKind: "text",
    searchOperator: "prefix-match",
    groupKey: "customer.name",
    relationKey: "customer",
  };

  it("renders a plain TextFilter for prefix-match fields when onTypeaheadSearch is not provided", () => {
    renderSidebar([PREFIX_PROP]);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("renders a typeahead combobox for prefix-match fields when onTypeaheadSearch is provided", () => {
    const onTypeaheadSearch = vi.fn();
    renderSidebar([PREFIX_PROP], {}, { onTypeaheadSearch });
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("shows the current filter value in the typeahead input", () => {
    renderSidebar([PREFIX_PROP], { "number~prefix": "INV-001" }, { onTypeaheadSearch: vi.fn() });
    expect(screen.getByRole("combobox")).toHaveValue("INV-001");
  });

  it("calls onTypeaheadSearch and onFilterChange when user types", () => {
    const onFilterChange = vi.fn();
    const onTypeaheadSearch = vi.fn();
    renderSidebar([PREFIX_PROP], {}, { onFilterChange, onTypeaheadSearch });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "INV" } });

    expect(onFilterChange).toHaveBeenCalledWith("number~prefix", "INV");
    expect(onTypeaheadSearch).toHaveBeenCalledWith("number~prefix", "INV");
  });

  it("calls onFilterChange with undefined and onTypeaheadSearch with empty when input is cleared", () => {
    const onFilterChange = vi.fn();
    const onTypeaheadSearch = vi.fn();
    renderSidebar([PREFIX_PROP], { "number~prefix": "INV" }, { onFilterChange, onTypeaheadSearch });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });

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
        activeTypeaheadField: "number~prefix",
        typeaheadSuggestions: ["INV-001", "INV-002"],
      },
    );

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "INV" } });

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
        activeTypeaheadField: "number~prefix",
        typeaheadSuggestions: ["INV-001", "INV-002"],
      },
    );

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "INV" } });
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

  it("navigates suggestions with arrow keys and selects the highlighted one on Enter", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    const onTypeaheadSearch = vi.fn();
    renderSidebar(
      [PREFIX_PROP],
      {},
      {
        onFilterChange,
        onTypeaheadSearch,
        activeTypeaheadField: "number~prefix",
        typeaheadSuggestions: ["INV-001", "INV-002"],
      },
    );
    const input = screen.getByRole("combobox");
    await user.click(input);
    fireEvent.change(input, { target: { value: "INV" } });

    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", expect.stringContaining("option-0"));

    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", expect.stringContaining("option-1"));

    await user.keyboard("{Enter}");
    expect(onFilterChange).toHaveBeenCalledWith("number~prefix", "INV-002");
  });

  it("renders a typeahead combobox for a relation-traversal prefix-match field too", () => {
    // useTypeahead resolves the related entity's own profile/collection for relationKey
    // properties (see use-typeahead.ts), so there's no reason to fall back to a plain text
    // input here — the field param name (e.g. "customer.name~prefix") is all FilterSidebar
    // needs to pass through to onTypeaheadSearch/typeaheadSuggestions.
    const onTypeaheadSearch = vi.fn();
    renderSidebar([RELATION_PREFIX_PROP], {}, { onTypeaheadSearch });

    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});

describe("FilterSidebar — RangeGroupFilter clear button (grouped date props)", () => {
  it("calls onFilterChange with undefined when the clear button is clicked in a RangeGroupFilter with a value", async () => {
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
