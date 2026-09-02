import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DateAttributeRenderer } from "./date-attribute-renderer";

describe("DateAttributeRenderer", () => {
  it("renders an empty attribute value when value is null", () => {
    render(<DateAttributeRenderer value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders the raw value when it cannot be parsed as a date", () => {
    render(<DateAttributeRenderer value="not-a-date" />);
    expect(screen.getByText("not-a-date")).toBeInTheDocument();
  });

  it("formats a valid date using medium date style", () => {
    render(<DateAttributeRenderer value="2021-06-15" />);
    const expected = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
      new Date("2021-06-15"),
    );
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
