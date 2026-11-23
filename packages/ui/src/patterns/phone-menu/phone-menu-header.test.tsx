import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "../../primitives/sheet";
import { Sidebar, SidebarContent, SidebarProvider } from "../../primitives/sidebar";
import { PhoneMenuHeader } from "./phone-menu-header";

function renderInSheet(onOpenChange = vi.fn()) {
  render(
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent showCloseButton={false}>
        <SheetTitle>Menu</SheetTitle>
        <SheetDescription>Navigation</SheetDescription>
        <PhoneMenuHeader />
      </SheetContent>
    </Sheet>,
  );
  return onOpenChange;
}

describe("PhoneMenuHeader", () => {
  it("shows the shared lockup in its on-light tone: dark logo, sky content, ocean grid and tagline", () => {
    renderInSheet();
    const logo = document.querySelector("img[src*='blue-dark']");
    expect(logo).toHaveClass("size-[30px]", "dark:hidden");
    const grid = screen.getByText("grid");
    expect(grid).toHaveClass("text-primary");
    expect(grid.parentElement).toHaveTextContent("contentgrid");
    expect(grid.parentElement).toHaveClass("text-[var(--sky)]", "text-[17px]", "font-bold");
    expect(screen.getByText("BY AMEXIO")).toHaveClass("text-primary");
    // White drawer: never the header's dark strip or white text.
    const strip = document.querySelector("[data-slot='phone-menu-header']");
    expect(strip?.className).not.toContain("gradient");
    expect(grid.parentElement?.className.split(" ")).not.toContain("text-white");
  });

  it("puts initial focus on Close menu, not the logo, when opened through Sidebar", async () => {
    vi.stubGlobal("innerWidth", 390);
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    render(
      <SidebarProvider defaultOpenMobile>
        <Sidebar mobileHeader={<PhoneMenuHeader onLogoClick={() => {}} />}>
          <SidebarContent />
        </Sidebar>
      </SidebarProvider>,
    );
    try {
      expect(await screen.findByRole("button", { name: "Close menu" })).toHaveFocus();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps the lockup non-interactive without onLogoClick", () => {
    renderInSheet();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("calls onLogoClick and closes the drawer when the logo is clicked", async () => {
    const onOpenChange = vi.fn();
    const onLogoClick = vi.fn();
    render(
      <Sheet open onOpenChange={onOpenChange}>
        <SheetContent showCloseButton={false}>
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>Navigation</SheetDescription>
          <PhoneMenuHeader onLogoClick={onLogoClick} />
        </SheetContent>
      </Sheet>,
    );
    await userEvent.click(screen.getByRole("button", { name: /content.*grid.*by amexio/i }));
    expect(onLogoClick).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("has a 44px Close menu button that closes the drawer", async () => {
    const onOpenChange = renderInSheet();
    const close = screen.getByRole("button", { name: "Close menu" });
    expect(close).toHaveClass("size-11");
    await userEvent.click(close);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
