import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DateTimeAttributeRenderer } from "./datetime-attribute-renderer";

describe("DateTimeAttributeRenderer", () => {
  it("renders an empty attribute value when value is null", () => {
    render(<DateTimeAttributeRenderer value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders the raw value when it cannot be parsed as a date", () => {
    render(<DateTimeAttributeRenderer value="not-a-date" />);
    expect(screen.getByText("not-a-date")).toBeInTheDocument();
  });

  it("formats a valid datetime using medium date and short time style", () => {
    const value = "2021-06-15T10:30:00.000Z";
    render(<DateTimeAttributeRenderer value={value} />);
    const expected = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
