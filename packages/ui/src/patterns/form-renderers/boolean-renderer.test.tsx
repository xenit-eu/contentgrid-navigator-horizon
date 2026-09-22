import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BooleanRenderer } from "./boolean-renderer";
import { booleanField } from "./test-fixtures";

describe("BooleanRenderer", () => {
  it("renders a True and False chip", () => {
    render(<BooleanRenderer {...booleanField()} value={false} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "True" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "False" })).toBeInTheDocument();
  });

  it("marks only the False chip pressed for a false value", () => {
    render(<BooleanRenderer {...booleanField()} value={false} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "True" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "False" })).toHaveAttribute("aria-pressed", "true");
  });

  it("marks only the True chip pressed for a true value", () => {
    render(<BooleanRenderer {...booleanField()} value={true} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "True" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "False" })).toHaveAttribute("aria-pressed", "false");
  });

  it("marks neither chip pressed for an unset value", () => {
    render(<BooleanRenderer {...booleanField()} value={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "True" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "False" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with true when the True chip is clicked", () => {
    const onChange = vi.fn();
    render(<BooleanRenderer {...booleanField()} value={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange with false when the False chip is clicked", () => {
    const onChange = vi.fn();
    render(<BooleanRenderer {...booleanField()} value={true} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "False" }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("does not call onChange when a chip is clicked while read-only", () => {
    const onChange = vi.fn();
    render(
      <BooleanRenderer {...booleanField({ readOnly: true })} value={false} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "True" }));
    expect(onChange).not.toHaveBeenCalled();
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

  it("shows the error message when set", () => {
    render(
      <BooleanRenderer {...booleanField()} value={false} onChange={vi.fn()} error="Must accept" />,
    );
    expect(screen.getByText("Must accept")).toBeInTheDocument();
  });
});
