import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EnumRenderer } from "./enum-renderer";
import { REMOTE_OPTIONS, enumField } from "./test-fixtures";

describe("EnumRenderer", () => {
  it("shows the placeholder, not (none), for an untouched non-required field", () => {
    render(<EnumRenderer field={enumField()} value="" onChange={vi.fn()} />);
    expect(screen.getByText("Select…")).toBeInTheDocument();
    expect(screen.queryByText("(none)")).not.toBeInTheDocument();
  });

  it("still offers a (none) option in the list for a non-required field", async () => {
    const user = userEvent.setup();
    render(<EnumRenderer field={enumField()} value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));

    expect(screen.getByRole("option", { name: "(none)" })).toBeInTheDocument();
  });

  it("renders the trigger with a placeholder when an unset required field has no (none) option", () => {
    render(<EnumRenderer field={enumField({ required: true })} value="" onChange={vi.fn()} />);
    expect(screen.getByText("Select…")).toBeInTheDocument();
    expect(screen.queryByText("(none)")).not.toBeInTheDocument();
  });

  it("shows the selected option's label", () => {
    render(<EnumRenderer field={enumField()} value="published" onChange={vi.fn()} />);
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("clears a selected value back to empty via the (none) option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EnumRenderer field={enumField()} value="published" onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "(none)" }));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("offers no (none) option for a required field", async () => {
    const user = userEvent.setup();
    render(
      <EnumRenderer field={enumField({ required: true })} value="published" onChange={vi.fn()} />,
    );

    await user.click(screen.getByRole("combobox"));

    expect(screen.queryByRole("option", { name: "(none)" })).not.toBeInTheDocument();
  });

  it("disables the select and shows a not-yet-loaded placeholder for a remote options source", () => {
    render(
      <EnumRenderer
        field={enumField({ optionsSource: REMOTE_OPTIONS })}
        value=""
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Options not yet loaded")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveAttribute("data-disabled");
  });

  it("offers no (none) option for a remote options source", async () => {
    render(
      <EnumRenderer
        field={enumField({ optionsSource: REMOTE_OPTIONS })}
        value=""
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByText("(none)")).not.toBeInTheDocument();
  });

  it("disables the select when the field is read-only", () => {
    render(<EnumRenderer field={enumField({ readOnly: true })} value="" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveAttribute("data-disabled");
  });
});
