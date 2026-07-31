import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SearchProperty } from "../search-property-utils";
import { FilterChips } from "./filter-chips";
import type { FilterChipsProps } from "./filter-chips";

const STATUS_PROP: SearchProperty = {
  name: "status",
  prompt: "Status",
  type: "text",
  options: { inline: ["draft", "paid"] },
};
const PREFIX_PROP: SearchProperty = {
  name: "number~prefix",
  prompt: "Number",
  type: "text",
};
// Exact-match search params have no operator suffix at all on this platform.
const EXACT_PROP: SearchProperty = { name: "ref", prompt: "Ref", type: "text" };
const FULL_TEXT_PROP: SearchProperty = {
  name: "notes~fts",
  prompt: "Notes",
  type: "text",
};
const RANGE_FROM_PROP: SearchProperty = { name: "amount~from", prompt: "Amount", type: "text" };
const RANGE_UNTIL_PROP: SearchProperty = {
  name: "amount~until",
  prompt: "Amount",
  type: "text",
};

function issuedDateProp(op: string): SearchProperty {
  return { name: `issued_date~${op}`, prompt: "Issued date", type: "datetime" };
}

const ALL_PROPS = [
  STATUS_PROP,
  PREFIX_PROP,
  EXACT_PROP,
  issuedDateProp("after"),
  issuedDateProp("gte"),
  issuedDateProp("before"),
  issuedDateProp("lte"),
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
    const { container } = renderChips({ status: "", "number~prefix": "" });
    expect(container.firstChild).toBeNull();
  });

  it("renders a chip for each non-empty filter", () => {
    renderChips({ status: "paid", "number~prefix": "INV-001" });
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
    const prop: SearchProperty = { name: "invoice_id", type: "text" };
    renderChips({ invoice_id: "42" }, [prop]);
    expect(screen.getByText("Invoice ID")).toBeInTheDocument();
  });

  it("shows the filter value in the chip", () => {
    renderChips({ status: "paid" });
    expect(screen.getByText(/paid/)).toBeInTheDocument();
  });
});

describe("FilterChips — operator display (IMPLICIT_OPS suppressed)", () => {
  it("does not show operator label for the prefix operator", () => {
    renderChips({ "number~prefix": "INV" });
    expect(screen.queryByText("prefix")).not.toBeInTheDocument();
  });

  it("does not show operator label for prefix on a different field", () => {
    const prop: SearchProperty = { name: "ref~prefix", prompt: "Ref", type: "text" };
    renderChips({ "ref~prefix": "ABC" }, [prop]);
    expect(screen.queryByText("prefix")).not.toBeInTheDocument();
  });

  it("does not show an operator label for exact-match (bare name, no suffix)", () => {
    renderChips({ ref: "X100" });
    expect(screen.queryByText("exact")).not.toBeInTheDocument();
  });

  it("shows 'after' operator label for the gt-equivalent date filter (~after)", () => {
    renderChips({ "issued_date~after": "2024-01-01T00:00:00Z" });
    expect(screen.getByText("after")).toBeInTheDocument();
  });

  it("shows 'from' operator label for the gte date filter", () => {
    renderChips({ "issued_date~gte": "2024-01-01T00:00:00Z" }, [issuedDateProp("gte")]);
    expect(screen.getByText("from")).toBeInTheDocument();
  });

  it("shows 'before' operator label for the lt-equivalent date filter (~before)", () => {
    renderChips({ "issued_date~before": "2024-12-31T00:00:00Z" });
    expect(screen.getByText("before")).toBeInTheDocument();
  });

  it("shows 'until' operator label for the lte date filter", () => {
    renderChips({ "issued_date~lte": "2024-12-31T00:00:00Z" }, [issuedDateProp("lte")]);
    expect(screen.getByText("until")).toBeInTheDocument();
  });

  it("shows 'contains' operator label for the full-text filter (~fts)", () => {
    renderChips({ "notes~fts": "invoice" }, [FULL_TEXT_PROP]);
    expect(screen.getByText("contains")).toBeInTheDocument();
  });

  it("shows 'from' operator label for the ~from filter", () => {
    renderChips({ "amount~from": "100" });
    expect(screen.getByText("from")).toBeInTheDocument();
  });

  it("shows 'until' operator label for the ~until filter", () => {
    renderChips({ "amount~until": "500" });
    expect(screen.getByText("until")).toBeInTheDocument();
  });
});

describe("FilterChips — date value display", () => {
  it("strips ISO timestamp suffix for date-type properties", () => {
    renderChips({ "issued_date~after": "2024-01-01T00:00:00Z" });
    expect(screen.getByText(/2024-01-01/)).toBeInTheDocument();
    expect(screen.queryByText(/T00:00:00/)).not.toBeInTheDocument();
  });

  it("strips ISO timestamp suffix for the gte date filter", () => {
    renderChips({ "issued_date~gte": "2024-03-15T00:00:00Z" }, [issuedDateProp("gte")]);
    expect(screen.getByText(/2024-03-15/)).toBeInTheDocument();
    expect(screen.queryByText(/T00:00:00/)).not.toBeInTheDocument();
  });

  it("strips ISO timestamp suffix for the lte date filter", () => {
    renderChips({ "issued_date~lte": "2024-06-30T00:00:00Z" }, [issuedDateProp("lte")]);
    expect(screen.getByText(/2024-06-30/)).toBeInTheDocument();
    expect(screen.queryByText(/T00:00:00/)).not.toBeInTheDocument();
  });

  it("leaves plain date string unchanged for date-type properties", () => {
    renderChips({ "issued_date~after": "2024-06-15" });
    expect(screen.getByText(/2024-06-15/)).toBeInTheDocument();
  });

  it("does not strip value for plain text properties", () => {
    renderChips({ status: "2024-01-01T00:00:00Z" });
    expect(screen.getByText(/2024-01-01T00:00:00Z/)).toBeInTheDocument();
  });
});

describe("FilterChips — dismiss button", () => {
  it("renders a dismiss button for each active chip", () => {
    renderChips({ status: "paid", "number~prefix": "INV" });
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
    renderChips({ "issued_date~after": "2024-01-01T00:00:00Z" }, ALL_PROPS, {
      onRemoveFilter,
    });
    const btn = screen.getByRole("button", { name: /remove issued date after filter/i });
    await user.click(btn);
    expect(onRemoveFilter).toHaveBeenCalledWith("issued_date~after");
  });

  it("aria-label on dismiss button includes the field label", () => {
    renderChips({ status: "paid" });
    expect(screen.getByRole("button", { name: /remove status filter/i })).toBeInTheDocument();
  });

  it("aria-labels are unique when two date chips share the same field", () => {
    renderChips({
      "issued_date~after": "2024-01-01T00:00:00Z",
      "issued_date~before": "2024-12-31T00:00:00Z",
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
    renderChips({ status: "paid", "number~prefix": "INV" }, ALL_PROPS, {
      onClearAll: vi.fn(),
    });
    expect(screen.getByRole("button", { name: /clear all/i })).toBeInTheDocument();
  });

  it("does not render Clear all even with multiple chips when onClearAll is not provided", () => {
    renderChips({ status: "paid", "number~prefix": "INV" });
    expect(screen.queryByRole("button", { name: /clear all/i })).not.toBeInTheDocument();
  });

  it("calls onClearAll when Clear all is clicked", async () => {
    const user = userEvent.setup();
    const onClearAll = vi.fn();
    renderChips({ status: "paid", "number~prefix": "INV" }, ALL_PROPS, { onClearAll });
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
    const prop: SearchProperty = { name: "notes~soundex", prompt: "Notes", type: "text" };
    renderChips({ "notes~soundex": "invoice" }, [prop]);
    // Falls back to SEARCH_TYPE_LABELS[op] ?? op, so raw "soundex" is shown
    expect(screen.getByText("soundex")).toBeInTheDocument();
  });

  it("does NOT crash or hide the chip value for an unknown operator", () => {
    const prop: SearchProperty = { name: "ref~future-op", prompt: "Ref", type: "text" };
    renderChips({ "ref~future-op": "X42" }, [prop]);
    expect(screen.getByText(/X42/)).toBeInTheDocument();
  });
});

describe("FilterChips — date stripping for a non-date-typed prop with a date-only suffix", () => {
  it("strips ISO timestamp suffix from a ~after prop even when the declared type is 'text'", () => {
    // ~after/~before suffixes trigger name-based date detection regardless of the declared type
    const prop: SearchProperty = { name: "budget~after", prompt: "Budget", type: "text" };
    renderChips({ "budget~after": "2024-01-01T00:00:00Z" }, [prop]);
    expect(screen.getByText(/2024-01-01/)).toBeInTheDocument();
    expect(screen.queryByText(/T00:00:00/)).not.toBeInTheDocument();
  });

  it("does NOT strip a plain ISO-like string from a true plain-text prop", () => {
    renderChips({ status: "2024-01-01T00:00:00Z" });
    expect(screen.getByText(/2024-01-01T00:00:00Z/)).toBeInTheDocument();
  });
});
