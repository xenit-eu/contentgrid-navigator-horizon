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
});
