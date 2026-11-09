import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NavigationLink } from "./navigation-link";

describe("NavigationLink", () => {
  it("renders a real anchor with the given href", () => {
    render(
      <NavigationLink href="/invoice" onNavigate={() => {}}>
        Invoices
      </NavigationLink>,
    );
    expect(screen.getByRole("link", { name: "Invoices" })).toHaveAttribute("href", "/invoice");
  });

  it("calls onNavigate and prevents the browser navigation on a plain click", async () => {
    const onNavigate = vi.fn();
    render(
      <NavigationLink href="/invoice" onNavigate={onNavigate}>
        Invoices
      </NavigationLink>,
    );

    await userEvent.click(screen.getByRole("link", { name: "Invoices" }));

    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it.each([
    ["ctrl", { ctrlKey: true }],
    ["meta", { metaKey: true }],
    ["shift", { shiftKey: true }],
    ["alt", { altKey: true }],
  ])("does not call onNavigate on a %s-click, leaving it for the browser", (_name, mods) => {
    const onNavigate = vi.fn();
    render(
      <NavigationLink href="/invoice" onNavigate={onNavigate}>
        Invoices
      </NavigationLink>,
    );

    // A real modifier-click's native MouseEvent is reproduced with `fireEvent` (`userEvent.click`
    // only simulates an unmodified left click); `href` is left for the browser to follow.
    fireEvent.click(screen.getByRole("link", { name: "Invoices" }), { button: 0, ...mods });

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("does not call onNavigate on a middle click, leaving it for the browser", () => {
    const onNavigate = vi.fn();
    render(
      <NavigationLink href="/invoice" onNavigate={onNavigate}>
        Invoices
      </NavigationLink>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Invoices" }), { button: 1 });

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("falls back to a button that always calls onNavigate when there is no href", async () => {
    const onNavigate = vi.fn();
    render(
      <NavigationLink onNavigate={onNavigate} href={undefined}>
        Invoices
      </NavigationLink>,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Invoices" }));

    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it("forwards extra DOM props (e.g. className merged in by an asChild wrapper)", () => {
    render(
      <NavigationLink href="/invoice" onNavigate={() => {}} className="styled">
        Invoices
      </NavigationLink>,
    );
    expect(screen.getByRole("link", { name: "Invoices" })).toHaveClass("styled");
  });
});
