import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SearchableOptionList } from "./searchable-option-list";

const options = [
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

describe("SearchableOptionList", () => {
  it("narrows the list as the user types", async () => {
    const user = userEvent.setup();
    render(<SearchableOptionList options={options} value={undefined} onValueChange={vi.fn()} />);
    await user.type(screen.getByRole("combobox"), "app");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Approved"]);
  });

  it("marks the current value as selected", () => {
    render(<SearchableOptionList options={options} value="rejected" onValueChange={vi.fn()} />);
    expect(screen.getByRole("option", { name: "Rejected" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("option", { name: "Draft" })).toHaveAttribute("aria-selected", "false");
  });

  it("picks an option on click", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <SearchableOptionList options={options} value={undefined} onValueChange={onValueChange} />,
    );
    await user.click(screen.getByRole("option", { name: "Approved" }));
    expect(onValueChange).toHaveBeenCalledWith("approved");
  });

  it("picks the highlighted option with the arrow keys and Enter", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <SearchableOptionList options={options} value={undefined} onValueChange={onValueChange} />,
    );
    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("approved");
  });

  it("picks the only remaining option with Enter", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <SearchableOptionList options={options} value={undefined} onValueChange={onValueChange} />,
    );
    await user.type(screen.getByRole("combobox"), "rej{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("rejected");
  });

  it("says so when nothing matches", async () => {
    const user = userEvent.setup();
    render(
      <SearchableOptionList
        options={options}
        value={undefined}
        onValueChange={vi.fn()}
        emptyLabel="Nothing"
      />,
    );
    await user.type(screen.getByRole("combobox"), "zz");
    expect(screen.getByText("Nothing")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("focuses the search field when asked", () => {
    render(
      <SearchableOptionList
        options={options}
        value={undefined}
        onValueChange={vi.fn()}
        autoFocus
      />,
    );
    expect(screen.getByRole("combobox")).toHaveFocus();
  });
});
