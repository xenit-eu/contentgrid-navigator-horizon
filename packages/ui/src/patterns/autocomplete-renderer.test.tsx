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
});
