import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "../../primitives/sheet";
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
  it("shows the brand with content in the primary colour and grid in sky, 16px bold", () => {
    renderInSheet();
    const grid = screen.getByText("grid");
    expect(grid).toHaveClass("text-[var(--sky)]");
    const brand = grid.parentElement?.parentElement;
    expect(brand).toHaveTextContent("contentgrid");
    expect(brand).toHaveClass("text-primary", "text-base", "font-bold");
    // On a white drawer: never the header's white / light-sky colours.
    expect(brand?.className).not.toContain("white");
  });

  it("has a 44px Close menu button that closes the drawer", async () => {
    const onOpenChange = renderInSheet();
    const close = screen.getByRole("button", { name: "Close menu" });
    expect(close).toHaveClass("size-11");
    await userEvent.click(close);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
