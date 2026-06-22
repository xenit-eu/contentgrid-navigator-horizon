import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Calendar } from "./calendar";

describe("Calendar", () => {
  it("renders without throwing", () => {
    const { container } = render(<Calendar />);
    expect(container.querySelector("[data-slot='calendar']")).toBeInTheDocument();
  });

  it("renders Phosphor navigation icons (svg) for prev/next chevrons", () => {
    const { container } = render(<Calendar />);
    // Calendar nav renders SVGs for CaretLeft, CaretRight (navigation arrows)
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
  });

  it("renders with captionLayout=dropdown-years without throwing", () => {
    const { container } = render(<Calendar captionLayout="dropdown-years" />);
    expect(container.querySelector("[data-slot='calendar']")).toBeInTheDocument();
  });
});
