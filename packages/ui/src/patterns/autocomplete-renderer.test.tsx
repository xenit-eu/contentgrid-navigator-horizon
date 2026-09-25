import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AutocompleteRenderer } from "./autocomplete-renderer";

describe("AutocompleteRenderer", () => {
  it("calls onQueryChange with the typed text", () => {
    const onQueryChange = vi.fn();
    render(
      <AutocompleteRenderer
        name="city"
        label="City"
        required={false}
        readOnly={false}
        value=""
        onChange={vi.fn()}
        suggestions={[]}
        onQueryChange={onQueryChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("City"), { target: { value: "par" } });

    expect(onQueryChange).toHaveBeenLastCalledWith("par");
  });

  it("renders suggestions as selectable options and calls onChange when one is selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AutocompleteRenderer
        name="city"
        label="City"
        required={false}
        readOnly={false}
        value="par"
        onChange={onChange}
        suggestions={["Paris", "Paramaribo"]}
        onQueryChange={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("City"));
    const option = await screen.findByText("Paris");
    await user.click(option);

    expect(onChange).toHaveBeenCalledWith("Paris");
  });

  it("shows an already-set value as the current selection", () => {
    render(
      <AutocompleteRenderer
        name="city"
        label="City"
        required={false}
        readOnly={false}
        value="Paris"
        onChange={vi.fn()}
        suggestions={[]}
        onQueryChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("City")).toHaveValue("Paris");
  });

  it("calls onQueryChange but does not commit onChange while typing", () => {
    const onChange = vi.fn();
    const onQueryChange = vi.fn();
    renderCity({ onChange, onQueryChange });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "par" } });

    expect(onQueryChange).toHaveBeenLastCalledWith("par");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("commits the typed value on blur and resets the query", () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    const onQueryChange = vi.fn();
    renderCity({ onChange, onBlur, onQueryChange });

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "par" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith("par");
    expect(onQueryChange).toHaveBeenLastCalledWith("");
    expect(onBlur).toHaveBeenCalled();
  });

  it("does not commit on blur when the draft equals the committed value", () => {
    const onChange = vi.fn();
    renderCity({ value: "Paris", onChange });

    fireEvent.blur(screen.getByRole("combobox"));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("commits the typed value on Enter when no suggestion is highlighted", () => {
    const onChange = vi.fn();
    renderCity({ onChange, suggestions: ["Paris"] });

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "par" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("par");
  });

  it("reverts the draft to the committed value on Escape without committing", () => {
    const onChange = vi.fn();
    const onQueryChange = vi.fn();
    renderCity({ value: "Paris", onChange, onQueryChange });

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Pa" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(input).toHaveValue("Paris");
    expect(onChange).not.toHaveBeenCalled();
    expect(onQueryChange).toHaveBeenLastCalledWith("");
  });

  it("commits an emptied input only on blur", () => {
    const onChange = vi.fn();
    renderCity({ value: "Paris", onChange });

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("resets the draft when the committed value changes from outside", () => {
    const { rerender } = renderCity({ value: "Paris" });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Pa" } });
    expect(screen.getByRole("combobox")).toHaveValue("Pa");

    rerender(<AutocompleteRenderer {...cityProps({ value: "" })} />);

    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("navigates suggestions with arrow keys and selects the highlighted one on Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderCity({ onChange, suggestions: ["Paris", "Paramaribo"] });

    const input = screen.getByRole("combobox");
    await user.click(input);
    fireEvent.change(input, { target: { value: "par" } });
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("Paramaribo");
    expect(input).toHaveValue("Paramaribo");
  });

  it("shows a loading indicator instead of stale suggestions while a new search is in flight", () => {
    renderCity({ suggestions: ["Paris", "Paramaribo"], isLoading: true });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "pari" } });

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("Paris")).not.toBeInTheDocument();
  });

  it("ignores stale suggestions for keyboard navigation while a new search is loading", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderCity({ onChange, suggestions: ["Paris", "Paramaribo"], isLoading: true });

    const input = screen.getByRole("combobox");
    await user.click(input);
    fireEvent.change(input, { target: { value: "pari" } });
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("pari");
  });
});

type CityProps = Partial<Parameters<typeof AutocompleteRenderer>[0]>;

function cityProps(overrides: CityProps = {}) {
  return {
    name: "city",
    label: "City",
    required: false,
    readOnly: false,
    value: "",
    onChange: vi.fn(),
    suggestions: [],
    onQueryChange: vi.fn(),
    ...overrides,
  };
}

function renderCity(overrides: CityProps = {}) {
  return render(<AutocompleteRenderer {...cityProps(overrides)} />);
}
