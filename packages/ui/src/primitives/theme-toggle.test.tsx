import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { ThemeProvider } from "./theme-provider";
import { ThemeToggle } from "./theme-toggle";

beforeAll(() => {
  // jsdom does not implement window.matchMedia; next-themes' ThemeProvider
  // listens for the system color-scheme preference unconditionally.
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

describe("ThemeToggle", () => {
  it("renders a switch", () => {
    render(
      <ThemeProvider defaultTheme="light" enableSystem={false}>
        <ThemeToggle />
      </ThemeProvider>,
    );
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("switches the document to dark mode when clicked from light", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider defaultTheme="light" enableSystem={false}>
        <ThemeToggle />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("switch", { name: /switch to dark mode/i }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("switches the document back to light mode when clicked from dark", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider defaultTheme="dark" enableSystem={false}>
        <ThemeToggle />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("switch", { name: /switch to light mode/i }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
