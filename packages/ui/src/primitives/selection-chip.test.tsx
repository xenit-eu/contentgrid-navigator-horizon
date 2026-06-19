import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SelectionChip } from "./selection-chip";

describe("SelectionChip", () => {
  it("renders label", () => {
    render(<SelectionChip label="All" />);
    expect(screen.getByText("All")).toBeInTheDocument();
  });

  it("is a button element", () => {
    render(<SelectionChip label="All" />);
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
  });

  it("has aria-pressed=false when not selected", () => {
    render(<SelectionChip label="All" selected={false} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });

  it("has aria-pressed=true when selected", () => {
    render(<SelectionChip label="All" selected />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<SelectionChip label="All" onClick={onClick} />);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not throw when clicked without onClick handler", async () => {
    const user = userEvent.setup();
    render(<SelectionChip label="All" />);
    await user.click(screen.getByRole("button"));
  });

  it("selected styling is applied when selected is true", () => {
    const { container } = render(<SelectionChip label="All" selected />);
    const btn = container.querySelector("[data-slot='selection-chip']");
    expect(btn?.className).toContain("font-semibold");
  });

  it("unselected styling applied when selected is false", () => {
    const { container } = render(<SelectionChip label="All" selected={false} />);
    const btn = container.querySelector("[data-slot='selection-chip']");
    expect(btn?.className).toContain("font-normal");
  });
});
