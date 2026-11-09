import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EnumRenderer, type EnumRendererProps } from "./enum-renderer";
import { enumField } from "./test-fixtures";

/** Round-trips `value` through real React state via `onChange`, the way the actual
 * `create-entity-item-container.tsx` form-state hook does, plus a "Reset" button that clears
 * the value the way that container's `formState.reset()` does after a successful continuous
 * create — directly, not via a "(none)" click. Needed to reproduce the controlled/uncontrolled
 * regression below, which only shows up once the underlying Radix `Select` has taken a real
 * "uncontrolled" selection through a click; a directly-passed `value` prop that never changes
 * via `onChange` never exercises Radix's internal fallback state, so it can't reproduce the bug. */
function ControlledEnumRenderer(props: Readonly<Omit<EnumRendererProps, "value" | "onChange">>) {
  const [value, setValue] = useState("");
  return (
    <>
      <EnumRenderer {...props} value={value} onChange={(next) => setValue(String(next))} />
      <button type="button" onClick={() => setValue("")}>
        Reset
      </button>
    </>
  );
}

describe("EnumRenderer", () => {
  it("shows the placeholder, not (none), for an untouched non-required field", () => {
    render(<EnumRenderer {...enumField()} value="" onChange={vi.fn()} />);
    expect(screen.getByText("Select…")).toBeInTheDocument();
    expect(screen.queryByText("(none)")).not.toBeInTheDocument();
  });

  it("still offers a (none) option in the list for a non-required field", async () => {
    const user = userEvent.setup();
    render(<EnumRenderer {...enumField()} value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));

    expect(screen.getByRole("option", { name: "(none)" })).toBeInTheDocument();
  });

  it("renders the trigger with a placeholder when an unset required field has no (none) option", () => {
    render(<EnumRenderer {...enumField({ required: true })} value="" onChange={vi.fn()} />);
    expect(screen.getByText("Select…")).toBeInTheDocument();
    expect(screen.queryByText("(none)")).not.toBeInTheDocument();
  });

  it("shows the selected option's label", () => {
    render(<EnumRenderer {...enumField()} value="published" onChange={vi.fn()} />);
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("shows the placeholder again when a selection is cleared by a reset, not a (none) click", async () => {
    // Mirrors continuous-create mode: after a successful submit the container resets its own
    // field state back to `""` directly, not via the "(none)" item. Regression coverage for a
    // bug where the trigger kept showing the previously selected option's label instead of
    // falling back to the placeholder — see `selected`'s doc comment in enum-renderer.tsx.
    const user = userEvent.setup();
    render(<ControlledEnumRenderer {...enumField()} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Published" }));
    expect(screen.getByText("Published")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByText("Select…")).toBeInTheDocument();
    expect(screen.queryByText("Published")).not.toBeInTheDocument();
  });

  it("clears a selected value back to empty via the (none) option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EnumRenderer {...enumField()} value="published" onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "(none)" }));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("offers no (none) option for a required field", async () => {
    const user = userEvent.setup();
    render(
      <EnumRenderer {...enumField({ required: true })} value="published" onChange={vi.fn()} />,
    );

    await user.click(screen.getByRole("combobox"));

    expect(screen.queryByRole("option", { name: "(none)" })).not.toBeInTheDocument();
  });

  it("disables the select and shows a not-yet-loaded placeholder for a remote options source", () => {
    render(
      <EnumRenderer {...enumField({ options: [], isRemote: true })} value="" onChange={vi.fn()} />,
    );
    expect(screen.getByText("Options not yet loaded")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveAttribute("data-disabled");
  });

  it("offers no (none) option for a remote options source", async () => {
    render(
      <EnumRenderer {...enumField({ options: [], isRemote: true })} value="" onChange={vi.fn()} />,
    );
    expect(screen.queryByText("(none)")).not.toBeInTheDocument();
  });

  it("disables the select when the field is read-only", () => {
    render(<EnumRenderer {...enumField({ readOnly: true })} value="" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveAttribute("data-disabled");
  });
});
