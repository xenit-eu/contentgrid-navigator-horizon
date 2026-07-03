import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SearchProperty } from "../search-property-utils";
import { FilterChips } from "./filter-chips";
import type { FilterChipsProps } from "./filter-chips";

const STATUS_PROP: SearchProperty = {
  name: "status",
  prompt: "Status",
  type: "string",
  options: { inline: ["draft", "paid"] },
};
const PREFIX_PROP: SearchProperty = {
  name: "number~prefix-match",
  prompt: "Number",
  type: "string",
};
const EXACT_PROP: SearchProperty = { name: "ref~exact-match", prompt: "Ref", type: "string" };
const FULL_TEXT_PROP: SearchProperty = {
  name: "notes~full-text",
  prompt: "Notes",
  type: "string",
};
const RANGE_FROM_PROP: SearchProperty = { name: "amount.~from", prompt: "Amount", type: "string" };
const RANGE_UNTIL_PROP: SearchProperty = {
  name: "amount.~until",
  prompt: "Amount",
  type: "string",
};

function issuedDateProp(op: string): SearchProperty {
  return { name: `issued_date~${op}`, prompt: "Issued date", type: "date" };
}

const ALL_PROPS = [
  STATUS_PROP,
  PREFIX_PROP,
  EXACT_PROP,
  issuedDateProp("greater-than"),
  issuedDateProp("greater-than-or-equal"),
  issuedDateProp("less-than"),
  issuedDateProp("less-than-or-equal"),
  RANGE_FROM_PROP,
  RANGE_UNTIL_PROP,
  FULL_TEXT_PROP,
];

function renderChips(
  filters: Record<string, string>,
  filterProperties: SearchProperty[] = ALL_PROPS,
  overrides: Partial<Pick<FilterChipsProps, "onRemoveFilter" | "onClearAll">> = {},
) {
  const onRemoveFilter = overrides.onRemoveFilter ?? vi.fn();
  const onClearAll = overrides.onClearAll;
  return {
    onRemoveFilter,
    ...render(
      <FilterChips
        filters={filters}
        filterProperties={filterProperties}
        onRemoveFilter={onRemoveFilter}
        onClearAll={onClearAll}
      />,
    ),
  };
}

describe("FilterChips — rendering", () => {
  it("renders nothing when filters is empty", () => {
    const { container } = renderChips({});
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when all filter values are empty strings", () => {
    const { container } = renderChips({ status: "", "number~prefix-match": "" });
    expect(container.firstChild).toBeNull();
  });

  it("renders a chip for each non-empty filter", () => {
    renderChips({ status: "paid", "number~prefix-match": "INV-001" });
    expect(screen.getByText("paid", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("INV-001", { exact: false })).toBeInTheDocument();
  });

  it("renders one chip for a single active filter", () => {
    renderChips({ status: "draft" });
    const dismissButtons = screen.getAllByRole("button");
    expect(dismissButtons).toHaveLength(1);
  });
});

describe("FilterChips — chip content", () => {
  it("shows the prompt as the field label", () => {
    renderChips({ status: "paid" });
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("formats field name from key when no prompt is provided", () => {
    const prop: SearchProperty = { name: "invoice_id", type: "string" };
    renderChips({ invoice_id: "42" }, [prop]);
    expect(screen.getByText("Invoice ID")).toBeInTheDocument();
  });

  it("shows the filter value in the chip", () => {
    renderChips({ status: "paid" });
    expect(screen.getByText(/paid/)).toBeInTheDocument();
  });
});

describe("FilterChips — operator display (IMPLICIT_OPS suppressed)", () => {
  it("does not show operator label for prefix-match operator", () => {
    renderChips({ "number~prefix-match": "INV" });
    expect(screen.queryByText("prefix")).not.toBeInTheDocument();
  });

  it("does not show operator label for prefix-match on a different field", () => {
    const prop: SearchProperty = { name: "ref~prefix-match", prompt: "Ref", type: "string" };
    renderChips({ "ref~prefix-match": "ABC" }, [prop]);
    expect(screen.queryByText("prefix")).not.toBeInTheDocument();
  });

  it("does not show operator label for exact-match operator", () => {
    renderChips({ "ref~exact-match": "X100" });
    expect(screen.queryByText("exact")).not.toBeInTheDocument();
  });

  it("shows 'after' operator label for greater-than date filter", () => {
    renderChips({ "issued_date~greater-than": "2024-01-01T00:00:00Z" });
    expect(screen.getByText("after")).toBeInTheDocument();
  });

  it("shows 'from' operator label for greater-than-or-equal date filter", () => {
    renderChips({ "issued_date~greater-than-or-equal": "2024-01-01T00:00:00Z" }, [
      issuedDateProp("greater-than-or-equal"),
    ]);
    expect(screen.getByText("from")).toBeInTheDocument();
  });

  it("shows 'before' operator label for less-than date filter", () => {
    renderChips({ "issued_date~less-than": "2024-12-31T00:00:00Z" });
    expect(screen.getByText("before")).toBeInTheDocument();
  });

  it("shows 'until' operator label for less-than-or-equal date filter", () => {
    renderChips({ "issued_date~less-than-or-equal": "2024-12-31T00:00:00Z" }, [
      issuedDateProp("less-than-or-equal"),
    ]);
    expect(screen.getByText("until")).toBeInTheDocument();
  });

  it("shows 'contains' operator label for full-text filter", () => {
    renderChips({ "notes~full-text": "invoice" }, [FULL_TEXT_PROP]);
    expect(screen.getByText("contains")).toBeInTheDocument();
  });

  it("shows 'from' operator label for range-pair ~from filter", () => {
    renderChips({ "amount.~from": "100" });
    expect(screen.getByText("from")).toBeInTheDocument();
  });

  it("shows 'until' operator label for range-pair ~until filter", () => {
    renderChips({ "amount.~until": "500" });
    expect(screen.getByText("until")).toBeInTheDocument();
  });
});

describe("FilterChips — date value display", () => {
  it("strips ISO timestamp suffix for date-type properties", () => {
    renderChips({ "issued_date~greater-than": "2024-01-01T00:00:00Z" });
    expect(screen.getByText(/2024-01-01/)).toBeInTheDocument();
    expect(screen.queryByText(/T00:00:00/)).not.toBeInTheDocument();
  });

  it("strips ISO timestamp suffix for greater-than-or-equal date filter", () => {
    renderChips({ "issued_date~greater-than-or-equal": "2024-03-15T00:00:00Z" }, [
      issuedDateProp("greater-than-or-equal"),
    ]);
    expect(screen.getByText(/2024-03-15/)).toBeInTheDocument();
    expect(screen.queryByText(/T00:00:00/)).not.toBeInTheDocument();
  });

  it("strips ISO timestamp suffix for less-than-or-equal date filter", () => {
    renderChips({ "issued_date~less-than-or-equal": "2024-06-30T00:00:00Z" }, [
      issuedDateProp("less-than-or-equal"),
    ]);
    expect(screen.getByText(/2024-06-30/)).toBeInTheDocument();
    expect(screen.queryByText(/T00:00:00/)).not.toBeInTheDocument();
  });

  it("leaves plain date string unchanged for date-type properties", () => {
    renderChips({ "issued_date~greater-than": "2024-06-15" });
    expect(screen.getByText(/2024-06-15/)).toBeInTheDocument();
  });

  it("does not strip value for plain string properties", () => {
    renderChips({ status: "2024-01-01T00:00:00Z" });
    expect(screen.getByText(/2024-01-01T00:00:00Z/)).toBeInTheDocument();
  });
});

describe("FilterChips — dismiss button", () => {
  it("renders a dismiss button for each active chip", () => {
    renderChips({ status: "paid", "number~prefix-match": "INV" });
    const dismissButtons = screen.getAllByRole("button");
    expect(dismissButtons).toHaveLength(2);
  });

  it("calls onRemoveFilter with the filter key when dismiss is clicked", async () => {
    const user = userEvent.setup();
    const onRemoveFilter = vi.fn();
    renderChips({ status: "paid" }, ALL_PROPS, { onRemoveFilter });
    const btn = screen.getByRole("button", { name: /remove status filter/i });
    await user.click(btn);
    expect(onRemoveFilter).toHaveBeenCalledWith("status");
  });

  it("calls onRemoveFilter with the correct key for an operator-suffixed field", async () => {
    const user = userEvent.setup();
    const onRemoveFilter = vi.fn();
    renderChips({ "issued_date~greater-than": "2024-01-01T00:00:00Z" }, ALL_PROPS, {
      onRemoveFilter,
    });
    const btn = screen.getByRole("button", { name: /remove issued date after filter/i });
    await user.click(btn);
    expect(onRemoveFilter).toHaveBeenCalledWith("issued_date~greater-than");
  });

  it("aria-label on dismiss button includes the field label", () => {
    renderChips({ status: "paid" });
    expect(screen.getByRole("button", { name: /remove status filter/i })).toBeInTheDocument();
  });

  it("aria-labels are unique when two date chips share the same field", () => {
    renderChips({
      "issued_date~greater-than": "2024-01-01T00:00:00Z",
      "issued_date~less-than": "2024-12-31T00:00:00Z",
    });
    expect(
      screen.getByRole("button", { name: /remove issued date after filter/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /remove issued date before filter/i }),
    ).toBeInTheDocument();
  });
});

describe("FilterChips — Clear all button", () => {
  it("does not render Clear all when only one chip is active", () => {
    renderChips({ status: "paid" }, ALL_PROPS, { onClearAll: vi.fn() });
    expect(screen.queryByRole("button", { name: /clear all/i })).not.toBeInTheDocument();
  });

  it("renders Clear all when two or more chips are active and onClearAll is provided", () => {
    renderChips({ status: "paid", "number~prefix-match": "INV" }, ALL_PROPS, {
      onClearAll: vi.fn(),
    });
    expect(screen.getByRole("button", { name: /clear all/i })).toBeInTheDocument();
  });

  it("does not render Clear all even with multiple chips when onClearAll is not provided", () => {
    renderChips({ status: "paid", "number~prefix-match": "INV" });
    expect(screen.queryByRole("button", { name: /clear all/i })).not.toBeInTheDocument();
  });

  it("calls onClearAll when Clear all is clicked", async () => {
    const user = userEvent.setup();
    const onClearAll = vi.fn();
    renderChips({ status: "paid", "number~prefix-match": "INV" }, ALL_PROPS, { onClearAll });
    await user.click(screen.getByRole("button", { name: /clear all/i }));
    expect(onClearAll).toHaveBeenCalled();
  });
});

describe("FilterChips — unknown filter key (no matching SearchProperty)", () => {
  it("renders a chip even when the filter key has no matching SearchProperty", () => {
    renderChips({ unknown_field: "value" }, []);
    expect(screen.getByText(/Unknown Field/i)).toBeInTheDocument();
  });

  it("renders the raw value for an unknown filter key", () => {
    renderChips({ unknown_field: "somevalue" }, []);
    expect(screen.getByText(/somevalue/)).toBeInTheDocument();
  });
});

describe("FilterChips — operator not in SEARCH_TYPE_LABELS (graceful fallback)", () => {
  it("displays the raw operator string when the op is not in SEARCH_TYPE_LABELS", () => {
    const prop: SearchProperty = { name: "notes~soundex", prompt: "Notes", type: "string" };
    renderChips({ "notes~soundex": "invoice" }, [prop]);
    // Falls back to SEARCH_TYPE_LABELS[op] ?? op, so raw "soundex" is shown
    expect(screen.getByText("soundex")).toBeInTheDocument();
  });

  it("does NOT crash or hide the chip value for an unknown operator", () => {
    const prop: SearchProperty = { name: "ref~future-op", prompt: "Ref", type: "string" };
    renderChips({ "ref~future-op": "X42" }, [prop]);
    expect(screen.getByText(/X42/)).toBeInTheDocument();
  });
});

describe("FilterChips — date stripping for range-pair props typed as non-date", () => {
  it("strips ISO timestamp suffix from .~from prop even when type is 'string'", () => {
    // .~from suffix triggers name-based date detection regardless of the declared type
    const prop: SearchProperty = { name: "budget.~from", prompt: "Budget", type: "string" };
    renderChips({ "budget.~from": "2024-01-01T00:00:00Z" }, [prop]);
    expect(screen.getByText(/2024-01-01/)).toBeInTheDocument();
    expect(screen.queryByText(/T00:00:00/)).not.toBeInTheDocument();
  });

  it("does NOT strip a plain ISO-like string from a true plain-string prop", () => {
    renderChips({ status: "2024-01-01T00:00:00Z" });
    expect(screen.getByText(/2024-01-01T00:00:00Z/)).toBeInTheDocument();
  });
});
