import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchInput, type SearchInputProps } from "./search-input";

function props(overrides: Partial<SearchInputProps> = {}): SearchInputProps {
  return {
    value: "",
    onValueChange: vi.fn(),
    popoverOpen: false,
    onPopoverOpenChange: vi.fn(),
    paramChips: [],
    groups: [],
    onSelectParam: vi.fn(),
    onApplySuggestion: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
}

describe("SearchInput", () => {
  it("uses the given label as the input's accessible name", () => {
    render(<SearchInput {...props({ label: "Search Invoice" })} />);
    expect(screen.getByRole("combobox", { name: "Search Invoice" })).toBeInTheDocument();
  });

  it("describes each input by its own error when two inputs share a page", () => {
    render(
      <>
        <SearchInput {...props({ label: "Search A", error: "Error A" })} />
        <SearchInput {...props({ label: "Search B", error: "Error B" })} />
      </>,
    );
    expect(screen.getByRole("combobox", { name: "Search A" })).toHaveAccessibleDescription(
      "Error A",
    );
    expect(screen.getByRole("combobox", { name: "Search B" })).toHaveAccessibleDescription(
      "Error B",
    );
  });
});
