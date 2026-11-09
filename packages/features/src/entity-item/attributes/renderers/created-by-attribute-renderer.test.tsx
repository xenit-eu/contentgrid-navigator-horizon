import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CreatedByAttributeRenderer } from "./created-by-attribute-renderer";

describe("CreatedByAttributeRenderer", () => {
  it("renders an em dash when value is null", () => {
    render(<CreatedByAttributeRenderer value={null} label="Created by" />);
    expect(screen.getByText("Created by: —")).toBeInTheDocument();
  });

  it("renders the string value prefixed with the attribute label", () => {
    render(<CreatedByAttributeRenderer value="jane@example.com" label="Created by" />);
    expect(screen.getByText("Created by: jane@example.com")).toBeInTheDocument();
  });

  it("stringifies non-string values", () => {
    render(<CreatedByAttributeRenderer value={42} label="Created by" />);
    expect(screen.getByText("Created by: 42")).toBeInTheDocument();
  });

  it("applies the wrap className when wrap is true", () => {
    render(<CreatedByAttributeRenderer value="jane@example.com" label="Created by" wrap />);
    expect(screen.getByText("Created by: jane@example.com")).toHaveClass(
      "whitespace-normal",
      "break-words",
    );
  });

  it("renders the bare value with no label prefix in the item-reference variant", () => {
    render(
      <CreatedByAttributeRenderer
        value="jane@example.com"
        label="Created by"
        variant="item-reference"
      />,
    );
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.queryByText("Created by: jane@example.com")).not.toBeInTheDocument();
  });

  it("renders an em dash with no label prefix in the item-reference variant when value is null", () => {
    render(<CreatedByAttributeRenderer value={null} label="Created by" variant="item-reference" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders an icon and the raw value with no pill in the table variant", () => {
    render(
      <CreatedByAttributeRenderer value="jane@example.com" label="Created by" variant="table" />,
    );
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.queryByText("Created by: jane@example.com")).not.toBeInTheDocument();
  });

  it("renders an em dash in the table variant when value is null", () => {
    render(<CreatedByAttributeRenderer value={null} label="Created by" variant="table" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
