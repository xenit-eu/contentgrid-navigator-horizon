import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModifiedByAttributeRenderer } from "./modified-by-attribute-renderer";

describe("ModifiedByAttributeRenderer", () => {
  it("renders an em dash when value is null", () => {
    render(<ModifiedByAttributeRenderer value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders the string value as-is", () => {
    render(<ModifiedByAttributeRenderer value="jane@example.com" />);
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });

  it("stringifies non-string values", () => {
    render(<ModifiedByAttributeRenderer value={false} />);
    expect(screen.getByText("false")).toBeInTheDocument();
  });
});
