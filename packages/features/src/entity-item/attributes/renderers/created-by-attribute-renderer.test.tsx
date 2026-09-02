import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CreatedByAttributeRenderer } from "./created-by-attribute-renderer";

describe("CreatedByAttributeRenderer", () => {
  it("renders an em dash when value is null", () => {
    render(<CreatedByAttributeRenderer value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders the string value as-is", () => {
    render(<CreatedByAttributeRenderer value="jane@example.com" />);
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });

  it("stringifies non-string values", () => {
    render(<CreatedByAttributeRenderer value={42} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});
