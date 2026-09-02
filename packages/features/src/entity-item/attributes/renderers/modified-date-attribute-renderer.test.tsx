import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModifiedDateAttributeRenderer } from "./modified-date-attribute-renderer";

describe("ModifiedDateAttributeRenderer", () => {
  it("renders an empty attribute value when value is null", () => {
    render(<ModifiedDateAttributeRenderer value={null} label="Modified" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders the raw value when it cannot be parsed as a date", () => {
    render(<ModifiedDateAttributeRenderer value="not-a-date" label="Modified" />);
    expect(screen.getByText("not-a-date")).toBeInTheDocument();
  });

  it("prefixes the formatted date with the attribute label", () => {
    const value = "2016-06-21T00:00:00.000Z";
    render(<ModifiedDateAttributeRenderer value={value} label="Modified" />);
    const expected = new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
    expect(screen.getByText(`Modified: ${expected}`)).toBeInTheDocument();
  });
});
