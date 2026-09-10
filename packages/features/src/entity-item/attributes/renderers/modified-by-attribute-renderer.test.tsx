import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModifiedByAttributeRenderer } from "./modified-by-attribute-renderer";

describe("ModifiedByAttributeRenderer", () => {
  it("renders an em dash when value is null", () => {
    render(<ModifiedByAttributeRenderer value={null} label="Modified by" />);
    expect(screen.getByText("Modified by: —")).toBeInTheDocument();
  });

  it("renders the string value prefixed with the attribute label", () => {
    render(<ModifiedByAttributeRenderer value="jane@example.com" label="Modified by" />);
    expect(screen.getByText("Modified by: jane@example.com")).toBeInTheDocument();
  });

  it("stringifies non-string values", () => {
    render(<ModifiedByAttributeRenderer value={false} label="Modified by" />);
    expect(screen.getByText("Modified by: false")).toBeInTheDocument();
  });

  it("applies the wrap className when wrap is true", () => {
    render(<ModifiedByAttributeRenderer value="jane@example.com" label="Modified by" wrap />);
    expect(screen.getByText("Modified by: jane@example.com")).toHaveClass(
      "text-xs",
      "whitespace-normal",
      "break-words",
    );
  });

  it("applies only the text-xs className when wrap is false", () => {
    render(<ModifiedByAttributeRenderer value="jane@example.com" label="Modified by" />);
    const pill = screen.getByText("Modified by: jane@example.com");
    expect(pill).toHaveClass("text-xs");
    expect(pill).not.toHaveClass("whitespace-normal");
  });

  it("renders the bare value with no label prefix in the item-reference variant", () => {
    render(
      <ModifiedByAttributeRenderer
        value="jane@example.com"
        label="Modified by"
        variant="item-reference"
      />,
    );
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.queryByText("Modified by: jane@example.com")).not.toBeInTheDocument();
  });

  it("renders an em dash with no label prefix in the item-reference variant when value is null", () => {
    render(
      <ModifiedByAttributeRenderer value={null} label="Modified by" variant="item-reference" />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders an icon and the raw value with no pill in the table variant", () => {
    render(
      <ModifiedByAttributeRenderer value="jane@example.com" label="Modified by" variant="table" />,
    );
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.queryByText("Modified by: jane@example.com")).not.toBeInTheDocument();
  });

  it("renders an em dash in the table variant when value is null", () => {
    render(<ModifiedByAttributeRenderer value={null} label="Modified by" variant="table" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
