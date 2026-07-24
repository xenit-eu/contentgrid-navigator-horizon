import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu";

describe("DropdownMenu", () => {
  it("renders trigger button", () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(screen.getByText("Open menu")).toBeInTheDocument();
  });

  it("opens and shows menu items on trigger click", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await user.click(screen.getByText("Open menu"));
    expect(screen.getByText("Item 1")).toBeInTheDocument();
  });

  it("renders Phosphor CaretRight icon (svg) in SubTrigger", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>More options</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Nested item</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByText("Open"));

    const subTrigger = screen
      .getByText("More options")
      .closest("[data-slot='dropdown-menu-sub-trigger']");
    expect(subTrigger).not.toBeNull();
    // CaretRight is the only icon rendered inside SubTrigger, appended after
    // its children with a fixed "ml-auto size-4" class.
    const icon = subTrigger?.querySelector("svg.ml-auto.size-4");
    expect(icon).toBeInTheDocument();
  });
});
