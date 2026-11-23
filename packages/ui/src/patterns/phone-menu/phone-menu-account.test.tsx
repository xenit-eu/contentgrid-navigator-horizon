import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "../../primitives/sidebar";
import { ThemeProvider } from "../../primitives/theme-provider";
import { PhoneMenuAccount } from "./phone-menu-account";

beforeAll(() => {
  // jsdom does not implement window.matchMedia; next-themes and SidebarProvider use it.
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
});

function renderAccount(onLogOut = vi.fn()) {
  render(
    <ThemeProvider defaultTheme="light">
      <SidebarProvider>
        <PhoneMenuAccount name="Sam Peeters" email="sam.peeters@example.com" onLogOut={onLogOut}>
          <li>
            <button type="button">Settings</button>
          </li>
        </PhoneMenuAccount>
      </SidebarProvider>
    </ThemeProvider>,
  );
  return onLogOut;
}

describe("PhoneMenuAccount", () => {
  it("has a top border and shows a 36px avatar with name and e-mail", () => {
    renderAccount();
    const block = document.querySelector("[data-slot='phone-menu-account']");
    expect(block).toHaveClass("border-t", "border-sidebar-border");
    expect(screen.getByText("SP")).toHaveClass("font-bold");
    expect(screen.getByText("SP").closest("[data-slot='avatar']")).toHaveClass("size-9");
    expect(screen.getByText("Sam Peeters")).toBeInTheDocument();
    expect(screen.getByText("sam.peeters@example.com")).toHaveClass("truncate");
  });

  it("has a Light / Dark / System control that switches the theme", async () => {
    renderAccount();
    const group = screen.getByRole("radiogroup", { name: "Appearance" });
    expect(
      within(group)
        .getAllByRole("radio")
        .map((r) => r.textContent),
    ).toEqual(["Light", "Dark", "System"]);
    expect(within(group).getByRole("radio", { name: "Light" })).toBeChecked();

    await userEvent.click(within(group).getByRole("radio", { name: "Dark" }));

    expect(within(group).getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(document.documentElement).toHaveClass("dark");
  });

  it("moves the choice with the arrow keys", async () => {
    renderAccount();
    await userEvent.click(screen.getByRole("radio", { name: "Light" }));
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
  });

  it("renders its children above a red Log out row that calls onLogOut", async () => {
    const onLogOut = renderAccount();
    const logOut = screen.getByRole("button", { name: "Log out" });
    expect(logOut).toHaveClass("text-destructive");
    expect(
      screen.getByRole("button", { name: "Settings" }).compareDocumentPosition(logOut) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await userEvent.click(logOut);
    expect(onLogOut).toHaveBeenCalledTimes(1);
  });
});
