import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CreatedDateAttributeRenderer } from "./created-date-attribute-renderer";

describe("CreatedDateAttributeRenderer", () => {
  it("renders an empty attribute value when value is null", () => {
    render(<CreatedDateAttributeRenderer value={null} label="Created" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders the raw value when it cannot be parsed as a date", () => {
    render(<CreatedDateAttributeRenderer value="not-a-date" label="Created" />);
    expect(screen.getByText("not-a-date")).toBeInTheDocument();
  });

  it("prefixes the formatted date with the attribute label", () => {
    const value = "2016-06-21T00:00:00.000Z";
    render(<CreatedDateAttributeRenderer value={value} label="Created" />);
    const expected = new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
    expect(screen.getByText(`Created: ${expected}`)).toBeInTheDocument();
  });
});
