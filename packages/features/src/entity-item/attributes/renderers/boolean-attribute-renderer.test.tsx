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

  describe("in a collection column (table variant)", () => {
    it.each([
      [true, "True", "text-[#266B49]"],
      [false, "False", "text-[#B3261E]"],
      [null, "Not set", "text-[#3C5667]"],
    ])("renders %s as a %s pill without an icon", (value, text, colour) => {
      render(<BooleanAttributeRenderer value={value} label="ignored" variant="table" />);
      const pill = screen.getByText(text).closest('[data-slot="status-pill"]');
      expect(pill).toHaveClass(colour);
      expect(pill?.querySelector("svg")).not.toBeInTheDocument();
    });
  });

  it("keeps plain text on the item page's attribute table", () => {
    const { container } = render(
      <BooleanAttributeRenderer value={true} label="Yes" variant="attribute-table" />,
    );
    expect(screen.getByText("True")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="status-pill"]')).not.toBeInTheDocument();
  });
});
