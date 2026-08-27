import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ItemReference } from "./item-reference";

describe("ItemReference", () => {
  it("renders the title", () => {
    render(<ItemReference title="Acme Corporation" />);
    expect(screen.getByText("Acme Corporation")).toBeInTheDocument();
  });

  it("renders the subtitle when provided", () => {
    render(<ItemReference title="Acme Corporation" subtitle="Supplier" />);
    expect(screen.getByText("Supplier")).toBeInTheDocument();
  });

  it("does not render a subtitle element when omitted", () => {
    const { container } = render(<ItemReference title="Acme Corporation" />);
    expect(container.querySelectorAll(".truncate")).toHaveLength(1);
  });

  it("renders the icon badge when icon is provided", () => {
    const { container } = render(<ItemReference title="Acme Corporation" icon={<svg />} />);
    expect(container.querySelector('[data-slot="icon-badge"]')).toBeInTheDocument();
  });

  it("does not render an icon badge when icon is omitted", () => {
    const { container } = render(<ItemReference title="Acme Corporation" />);
    expect(container.querySelector('[data-slot="icon-badge"]')).not.toBeInTheDocument();
  });

  it("is not interactive (no role, no tabIndex) when onClick is absent", () => {
    render(<ItemReference title="Acme Corporation" />);
    const el = screen.getByText("Acme Corporation").closest('[data-slot="item-reference"]');
    expect(el).not.toHaveAttribute("role");
    expect(el).not.toHaveAttribute("tabindex");
  });

  it("renders as an interactive button role with tabIndex when onClick is provided", () => {
    render(<ItemReference title="Acme Corporation" onClick={vi.fn()} />);
    const el = screen.getByRole("button");
    expect(el).toHaveAttribute("tabindex", "0");
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ItemReference title="Acme Corporation" onClick={onClick} />);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("calls onClick on Enter key", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ItemReference title="Acme Corporation" onClick={onClick} />);
    screen.getByRole("button").focus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("calls onClick on Space key", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ItemReference title="Acme Corporation" onClick={onClick} />);
    screen.getByRole("button").focus();
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("marks data-selected when selected is true", () => {
    render(<ItemReference title="Acme Corporation" selected />);
    const el = screen.getByText("Acme Corporation").closest('[data-slot="item-reference"]');
    expect(el).toHaveAttribute("data-selected", "true");
  });

  it("does not mark data-selected when selected is false", () => {
    render(<ItemReference title="Acme Corporation" selected={false} />);
    const el = screen.getByText("Acme Corporation").closest('[data-slot="item-reference"]');
    expect(el).not.toHaveAttribute("data-selected");
  });

  it("sets aria-pressed only when interactive", () => {
    const { rerender } = render(
      <ItemReference title="Acme Corporation" selected onClick={vi.fn()} />,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");

    rerender(<ItemReference title="Acme Corporation" selected />);
    const el = screen.getByText("Acme Corporation").closest('[data-slot="item-reference"]');
    expect(el).not.toHaveAttribute("aria-pressed");
  });
});
