import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FilterButton } from "./filter-button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

describe("FilterButton", () => {
  it("renders the label as the trigger's accessible name", () => {
    render(<FilterButton label="Due date" />);
    expect(screen.getByRole("button", { name: "Due date" })).toBeInTheDocument();
  });

  it.each([
    ["idle", "border-border"],
    ["active", "border-ring"],
    ["positive", "border-success-foreground"],
    ["negative", "border-destructive"],
  ] as const)("applies the %s tone", (tone, className) => {
    const { container } = render(<FilterButton label="Urgent" tone={tone} />);
    const root = container.querySelector('[data-slot="filter-button"]');
    expect(root).toHaveAttribute("data-tone", tone);
    expect(root).toHaveClass(className);
  });

  it("does not render the clear button while idle", () => {
    render(<FilterButton label="Due date" onClear={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Clear Due date filter" })).not.toBeInTheDocument();
  });

  it("does not render the clear button without onClear", () => {
    render(<FilterButton label="Due date" tone="active" />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("clears without triggering the main button", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const onClick = vi.fn();
    render(<FilterButton label="Due date" tone="active" onClear={onClear} onClick={onClick} />);

    await user.click(screen.getByRole("button", { name: "Clear Due date filter" }));

    expect(onClear).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("uses a custom clear label", () => {
    render(<FilterButton label="Due date" tone="active" onClear={vi.fn()} clearLabel="Remove" />);
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("does not set aria-pressed", () => {
    render(<FilterButton label="Urgent" tone="positive" />);
    expect(screen.getByRole("button", { name: "Urgent" })).not.toHaveAttribute("aria-pressed");
  });

  it("works as a popover trigger", async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger asChild>
          <FilterButton label="Due date" tone="active" onClear={vi.fn()} />
        </PopoverTrigger>
        <PopoverContent>Range picker</PopoverContent>
      </Popover>,
    );

    const trigger = screen.getByRole("button", { name: "Due date" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(await screen.findByText("Range picker")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});
