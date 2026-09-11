import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IconBadge } from "./icon-badge";

describe("IconBadge", () => {
  it("renders the icon", () => {
    render(<IconBadge icon={<span data-testid="icon" />} />);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders as a span when no onClick is given", () => {
    const { container } = render(<IconBadge icon={<span />} />);
    const badge = container.querySelector('[data-slot="icon-badge"]');
    expect(badge?.tagName).toBe("SPAN");
  });

  it("renders as a button and calls onClick when given", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<IconBadge icon={<span />} onClick={onClick} aria-label="Change icon" />);

    const button = screen.getByRole("button", { name: "Change icon" });
    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("defaults to the default variant", () => {
    const { container } = render(<IconBadge icon={<span />} />);
    expect(container.querySelector('[data-slot="icon-badge"]')).toHaveAttribute(
      "data-variant",
      "default",
    );
  });

  it("reflects an explicit variant", () => {
    const { container } = render(<IconBadge icon={<span />} variant="lg" />);
    expect(container.querySelector('[data-slot="icon-badge"]')).toHaveAttribute(
      "data-variant",
      "lg",
    );
  });

  it("mixes the given color into the background", () => {
    const { container } = render(<IconBadge icon={<span />} color="oklch(0.55 0.17 155)" />);
    const badge = container.querySelector('[data-slot="icon-badge"]') as HTMLElement;
    expect(badge.style.backgroundColor).toBe(
      "color-mix(in oklch, oklch(0.55 0.17 155) 65%, transparent)",
    );
  });

  it("falls back to the theme's muted-foreground color when no color is given", () => {
    const { container } = render(<IconBadge icon={<span />} />);
    const badge = container.querySelector('[data-slot="icon-badge"]') as HTMLElement;
    expect(badge.style.backgroundColor).toBe(
      "color-mix(in oklch, var(--muted-foreground) 65%, transparent)",
    );
  });

  it("uses a lighter color-mix percentage when muted", () => {
    const { container } = render(<IconBadge icon={<span />} color="oklch(0.55 0.17 155)" muted />);
    const badge = container.querySelector('[data-slot="icon-badge"]') as HTMLElement;
    expect(badge.style.backgroundColor).toBe(
      "color-mix(in oklch, oklch(0.55 0.17 155) 30%, transparent)",
    );
  });

  it("switches the icon to white text when not muted", () => {
    const { container } = render(<IconBadge icon={<span />} />);
    expect(container.querySelector('[data-slot="icon-badge"]')).toHaveClass("text-white");
  });

  it("does not force white text when muted", () => {
    const { container } = render(<IconBadge icon={<span />} muted />);
    expect(container.querySelector('[data-slot="icon-badge"]')).not.toHaveClass("text-white");
  });

  it("only applies the hover/cursor-pointer affordance when clickable", () => {
    const { container: withoutClick } = render(<IconBadge icon={<span />} />);
    expect(withoutClick.querySelector('[data-slot="icon-badge"]')).not.toHaveClass(
      "cursor-pointer",
    );

    const { container: withClick } = render(<IconBadge icon={<span />} onClick={vi.fn()} />);
    expect(withClick.querySelector('[data-slot="icon-badge"]')).toHaveClass("cursor-pointer");
  });
});
