import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileAttributeType } from "@contentgrid/navigator-data";
import { NumberAttributeRenderer } from "./number-attribute-renderer";

describe("NumberAttributeRenderer", () => {
  it("renders an empty numeric attribute value when value is null", () => {
    render(<NumberAttributeRenderer value={null} type={ProfileAttributeType.long} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("formats a long value with no fraction digits", () => {
    render(<NumberAttributeRenderer value={1234.7} type={ProfileAttributeType.long} />);
    const expected = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(1234.7);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("formats a double value with up to 6 fraction digits", () => {
    render(<NumberAttributeRenderer value={1234.123456789} type={ProfileAttributeType.double} />);
    const expected = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(
      1234.123456789,
    );
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
