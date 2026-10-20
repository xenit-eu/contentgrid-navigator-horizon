import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CountIndicatorChip } from "./count-indicator-chip";

describe("CountIndicatorChip", () => {
  it("shows an exact count", () => {
    render(<CountIndicatorChip count={42} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("42 results")).toHaveClass("sr-only");
  });

  it("marks an estimated count with ~ and describes it as approximate", () => {
    render(<CountIndicatorChip count={1200} isEstimated />);
    expect(screen.getByText(`${(1200).toLocaleString()}~`)).toBeInTheDocument();
    expect(screen.getByText(`about ${(1200).toLocaleString()} results`)).toBeInTheDocument();
  });

  it("shows ? for an unknown count", () => {
    render(<CountIndicatorChip count={null} />);
    expect(screen.getByText("?")).toBeInTheDocument();
    expect(screen.getByText("unknown number of results")).toBeInTheDocument();
  });

  it("shows a busy placeholder while loading, never a number", () => {
    const { container } = render(<CountIndicatorChip count={7} isLoading />);
    const chip = container.querySelector('[data-slot="count-indicator-chip"]');
    expect(chip).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("7")).not.toBeInTheDocument();
    expect(screen.getByText("Loading count")).toBeInTheDocument();
  });
});
