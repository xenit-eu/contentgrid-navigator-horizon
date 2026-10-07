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

  it("defaults to the default size's padding/text classes", () => {
    const { container } = render(<SelectionChip label="All" />);
    const btn = container.querySelector("[data-slot='selection-chip']");
    expect(btn?.className).toContain("px-[14px]");
    expect(btn?.className).toContain("text-[13px]");
  });

  it("applies the sm size's smaller padding/text classes", () => {
    const { container } = render(<SelectionChip label="All" size="sm" />);
    const btn = container.querySelector("[data-slot='selection-chip']");
    expect(btn?.className).toContain("px-[10px]");
    expect(btn?.className).toContain("text-[12px]");
  });
});

describe("SelectionChip slots", () => {
  it("renders an icon before and trailing content after the label", () => {
    render(
      <SelectionChip
        label="Title"
        icon={<span data-testid="icon" />}
        trailing={<span data-testid="count">12</span>}
      />,
    );
    const button = screen.getByRole("button");
    const children = Array.from(button.childNodes);
    expect(children[0]).toBe(screen.getByTestId("icon"));
    expect(children[2]).toBe(screen.getByTestId("count"));
    expect(button).toHaveTextContent("Title12");
  });

  it("forwards an id", () => {
    render(<SelectionChip label="Title" id="chip-1" />);
    expect(screen.getByRole("button")).toHaveAttribute("id", "chip-1");
  });
});
