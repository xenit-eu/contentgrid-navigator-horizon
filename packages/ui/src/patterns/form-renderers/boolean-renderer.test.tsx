import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BooleanRenderer } from "./boolean-renderer";
import { booleanField } from "./test-fixtures";

describe("BooleanRenderer", () => {
  it("renders unchecked for a false value", () => {
    render(<BooleanRenderer {...booleanField()} value={false} onChange={vi.fn()} />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("renders checked for a true value", () => {
    render(<BooleanRenderer {...booleanField()} value={true} onChange={vi.fn()} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("renders an unset value as indeterminate, distinct from false", () => {
    render(<BooleanRenderer {...booleanField()} value={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "mixed");
  });

  it("calls onChange with true when checked", () => {
    const onChange = vi.fn();
    render(<BooleanRenderer {...booleanField()} value={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("disables the checkbox when the field is read-only", () => {
    render(
      <BooleanRenderer {...booleanField({ readOnly: true })} value={false} onChange={vi.fn()} />,
    );
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("shows the error message when set", () => {
    render(
      <BooleanRenderer {...booleanField()} value={false} onChange={vi.fn()} error="Must accept" />,
    );
    expect(screen.getByText("Must accept")).toBeInTheDocument();
  });

  it("hides the Clear affordance when the value is already unset", () => {
    render(<BooleanRenderer {...booleanField()} value={undefined} onChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
  });

  it("shows Clear once the value is false, and resets it to undefined", () => {
    const onChange = vi.fn();
    render(<BooleanRenderer {...booleanField()} value={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("hides the Clear affordance when the field is read-only", () => {
    render(
      <BooleanRenderer {...booleanField({ readOnly: true })} value={true} onChange={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
  });
});
