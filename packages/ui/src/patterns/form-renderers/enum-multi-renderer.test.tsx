import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EnumMultiRenderer } from "./enum-multi-renderer";
import { enumMultiField } from "./test-fixtures";

describe("EnumMultiRenderer", () => {
  it("renders one checkbox per inline option", () => {
    render(<EnumMultiRenderer {...enumMultiField()} value={[]} onChange={vi.fn()} />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("checks the boxes matching the current value", () => {
    render(
      <EnumMultiRenderer {...enumMultiField()} value={["draft", "archived"]} onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText("draft")).toBeChecked();
    expect(screen.getByLabelText("published")).not.toBeChecked();
    expect(screen.getByLabelText("archived")).toBeChecked();
  });

  it("adds the option value when checked", () => {
    const onChange = vi.fn();
    render(<EnumMultiRenderer {...enumMultiField()} value={["draft"]} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("published"));
    expect(onChange).toHaveBeenCalledWith(["draft", "published"]);
  });

  it("removes the option value when unchecked", () => {
    const onChange = vi.fn();
    render(
      <EnumMultiRenderer
        {...enumMultiField()}
        value={["draft", "published"]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("draft"));
    expect(onChange).toHaveBeenCalledWith(["published"]);
  });

  it("treats a non-array value as no selection", () => {
    render(<EnumMultiRenderer {...enumMultiField()} value={undefined} onChange={vi.fn()} />);
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).not.toBeChecked();
    }
  });

  it("shows a not-yet-loaded message and no checkboxes for a remote options source", () => {
    render(
      <EnumMultiRenderer
        {...enumMultiField({ options: [], isRemote: true })}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Options not yet loaded")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
