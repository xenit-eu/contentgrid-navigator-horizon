import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CountIndicatorChip } from "./count-indicator-chip";

describe("CountIndicatorChip", () => {
  it("shows a busy placeholder while loading, never a number", () => {
    const { container } = render(<CountIndicatorChip count={7} isLoading />);
    const chip = container.querySelector('[data-slot="count-indicator-chip"]');
    expect(chip).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("7")).not.toBeInTheDocument();
    expect(screen.getByText("Loading count")).toBeInTheDocument();
  });
});
