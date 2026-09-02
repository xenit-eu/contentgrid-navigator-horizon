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
});
