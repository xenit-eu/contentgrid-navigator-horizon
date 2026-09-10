import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StringAttributeRenderer } from "./string-attribute-renderer";

describe("StringAttributeRenderer", () => {
  it("renders an em dash when value is null", () => {
    render(<StringAttributeRenderer value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders string values as-is", () => {
    render(<StringAttributeRenderer value="Acme Corp" />);
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("stringifies numeric and boolean values", () => {
    const { rerender } = render(<StringAttributeRenderer value={42} />);
    expect(screen.getByText("42")).toBeInTheDocument();

    rerender(<StringAttributeRenderer value={true} />);
    expect(screen.getByText("true")).toBeInTheDocument();
  });
});
