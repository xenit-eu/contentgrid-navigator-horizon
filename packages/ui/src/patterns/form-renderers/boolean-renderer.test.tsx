import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BooleanRenderer } from "./boolean-renderer";
import { booleanField } from "./test-fixtures";

describe("BooleanRenderer", () => {
  it("renders a True and False chip", () => {
    render(<BooleanRenderer {...booleanField()} value={false} onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "True" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "False" })).toBeInTheDocument();
  });

  it("marks only the False chip checked for a false value", () => {
    render(<BooleanRenderer {...booleanField()} value={false} onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "True" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: "False" })).toHaveAttribute("aria-checked", "true");
  });

  it("marks only the True chip checked for a true value", () => {
    render(<BooleanRenderer {...booleanField()} value={true} onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "True" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "False" })).toHaveAttribute("aria-checked", "false");
  });

  it("marks neither chip checked for an unset value", () => {
    render(<BooleanRenderer {...booleanField()} value={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "True" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: "False" })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange with true when the True chip is clicked", () => {
    const onChange = vi.fn();
    render(<BooleanRenderer {...booleanField()} value={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "True" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange with false when the False chip is clicked", () => {
    const onChange = vi.fn();
    render(<BooleanRenderer {...booleanField()} value={true} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "False" }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("does not call onChange when a chip is clicked while read-only", () => {
    const onChange = vi.fn();
    render(
      <BooleanRenderer {...booleanField({ readOnly: true })} value={false} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "True" }));
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

  it("exposes the chips as a radio group named by the visible label", () => {
    render(<BooleanRenderer {...booleanField()} required value={undefined} onChange={vi.fn()} />);
    const group = screen.getByRole("radiogroup", { name: /Active/ });
    expect(group).toHaveAttribute("aria-required", "true");
    expect(within(group).getAllByRole("radio")).toHaveLength(2);
  });

  it("marks the radio group invalid and describes it with the error", () => {
    render(
      <BooleanRenderer {...booleanField()} value={undefined} onChange={vi.fn()} error="Required" />,
    );
    const group = screen.getByRole("radiogroup");
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAccessibleDescription("Required");
  });

  it("keeps only one chip in the tab order: the checked one, else True", () => {
    const { rerender } = render(
      <BooleanRenderer {...booleanField()} value={undefined} onChange={vi.fn()} />,
    );
    expect(screen.getByRole("radio", { name: "True" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "False" })).toHaveAttribute("tabindex", "-1");

    rerender(<BooleanRenderer {...booleanField()} value={false} onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "True" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("radio", { name: "False" })).toHaveAttribute("tabindex", "0");
  });

  it("moves focus to and checks the other chip with the arrow keys", () => {
    const onChange = vi.fn();
    render(<BooleanRenderer {...booleanField()} value={true} onChange={onChange} />);
    const trueChip = screen.getByRole("radio", { name: "True" });
    trueChip.focus();

    fireEvent.keyDown(trueChip, { key: "ArrowRight" });

    expect(screen.getByRole("radio", { name: "False" })).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("hands focus back to the True chip after Clear", () => {
    render(<BooleanRenderer {...booleanField()} value={false} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByRole("radio", { name: "True" })).toHaveFocus();
  });
});
