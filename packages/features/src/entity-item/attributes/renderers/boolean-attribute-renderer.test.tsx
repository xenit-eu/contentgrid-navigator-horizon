import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BooleanAttributeRenderer } from "./boolean-attribute-renderer";

describe("BooleanAttributeRenderer", () => {
  it("renders a success pill for true", () => {
    render(<BooleanAttributeRenderer value={true} label="Yes" />);
    const pill = screen.getByText("Yes").closest('[data-slot="status-pill"]');
    expect(pill).toHaveClass("text-[#266B49]");
  });

  it("renders a neutral pill for false", () => {
    render(<BooleanAttributeRenderer value={false} label="No" />);
    const pill = screen.getByText("No").closest('[data-slot="status-pill"]');
    expect(pill).toHaveClass("text-[#3C5667]");
  });

  it("renders a neutral pill for null (not set)", () => {
    render(<BooleanAttributeRenderer value={null} label="Not set" />);
    const pill = screen.getByText("Not set").closest('[data-slot="status-pill"]');
    expect(pill).toHaveClass("text-[#3C5667]");
  });

  it("uses the provided label regardless of value", () => {
    render(<BooleanAttributeRenderer value={true} label="Custom label" />);
    expect(screen.getByText("Custom label")).toBeInTheDocument();
  });
});
