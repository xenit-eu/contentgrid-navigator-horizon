import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EnumRenderer } from "./enum-renderer";
import { REMOTE_OPTIONS, enumField } from "./test-fixtures";

describe("EnumRenderer", () => {
  it("renders the trigger with a placeholder when nothing is selected", () => {
    render(<EnumRenderer field={enumField()} value="" onChange={vi.fn()} />);
    expect(screen.getByText("Select…")).toBeInTheDocument();
  });

  it("shows the selected option's label", () => {
    render(<EnumRenderer field={enumField()} value="published" onChange={vi.fn()} />);
    expect(screen.getByText("Published")).toBeInTheDocument();
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

  it("disables the select when the field is read-only", () => {
    render(<EnumRenderer field={enumField({ readOnly: true })} value="" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveAttribute("data-disabled");
  });
});
