import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AttributeRow } from "./attribute-row";

describe("AttributeRow", () => {
  it("renders label and value", () => {
    render(<AttributeRow label="Invoice number" value="INV-001" />);
    expect(screen.getByText("Invoice number")).toBeInTheDocument();
    expect(screen.getByText("INV-001")).toBeInTheDocument();
  });

  it("shows em-dash placeholder when value is not provided", () => {
    render(<AttributeRow label="Notes" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows em-dash placeholder when empty prop is true", () => {
    render(<AttributeRow label="Notes" value="something" empty />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows value when empty prop is false and value exists", () => {
    render(<AttributeRow label="Ref" value="ABC" empty={false} />);
    expect(screen.getByText("ABC")).toBeInTheDocument();
  });

  it("treats missing value as empty (shows placeholder)", () => {
    render(<AttributeRow label="Amount" value="" />);
    // empty string is falsy → isEmpty=true
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders data-slot=attribute-row attribute", () => {
    const { container } = render(<AttributeRow label="Field" value="val" />);
    expect(container.querySelector("[data-slot='attribute-row']")).toBeInTheDocument();
  });
});
