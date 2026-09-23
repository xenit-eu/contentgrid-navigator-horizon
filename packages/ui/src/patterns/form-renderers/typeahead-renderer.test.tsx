import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { typeaheadField } from "./test-fixtures";
import { TypeaheadRenderer } from "./typeahead-renderer";

describe("TypeaheadRenderer", () => {
  it("calls onChange with the typed text on every keystroke", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TypeaheadRenderer {...typeaheadField()} value="" onChange={onChange} />);
    await user.type(screen.getByRole("combobox"), "Ac");
    // Uncontrolled in this test (value stays "" across renders), so each keystroke reports just
    // that character rather than the cumulative string — matches a real controlled parent
    // re-rendering with the updated value between keystrokes.
    expect(onChange).toHaveBeenCalledWith("A");
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("does not show the suggestions list before the input is focused", () => {
    render(
      <TypeaheadRenderer
        {...typeaheadField({ suggestions: ["Acme", "Acme Corp"] })}
        value="Ac"
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows the suggestions list once the input is focused", async () => {
    const user = userEvent.setup();
    render(
      <TypeaheadRenderer
        {...typeaheadField({ suggestions: ["Acme", "Acme Corp"] })}
        value="Ac"
        onChange={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("combobox"));
    expect(screen.getByRole("option", { name: "Acme" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Acme Corp" })).toBeInTheDocument();
  });

  it("calls onChange with the clicked suggestion's text", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TypeaheadRenderer
        {...typeaheadField({ suggestions: ["Acme Corp"] })}
        value="Ac"
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Acme Corp" }));
    expect(onChange).toHaveBeenCalledWith("Acme Corp");
  });

  it("shows a loading row while isLoading and no suggestions have arrived yet", async () => {
    const user = userEvent.setup();
    render(
      <TypeaheadRenderer {...typeaheadField({ isLoading: true })} value="Ac" onChange={vi.fn()} />,
    );
    await user.click(screen.getByRole("combobox"));
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("does not open the suggestions list when disabled", async () => {
    const user = userEvent.setup();
    render(
      <TypeaheadRenderer
        {...typeaheadField({ suggestions: ["Acme"], disabled: true })}
        value=""
        onChange={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("combobox"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
