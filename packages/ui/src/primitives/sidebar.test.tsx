import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { SidebarMenuButton, SidebarProvider, SidebarTrigger } from "./sidebar";

beforeAll(() => {
  // jsdom does not implement window.matchMedia; SidebarProvider uses useIsMobile
  // which calls window.matchMedia to detect mobile breakpoint.
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

describe("SidebarTrigger", () => {
  it("renders toggle button with Phosphor SidebarSimple icon (svg)", () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarTrigger />
      </SidebarProvider>,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("is named Collapse sidebar while the sidebar is open", () => {
    render(
      <SidebarProvider>
        <SidebarTrigger />
      </SidebarProvider>,
    );
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });

  it("is named Expand sidebar after toggling, and is 32px", async () => {
    render(
      <SidebarProvider>
        <SidebarTrigger />
      </SidebarProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    const trigger = screen.getByRole("button", { name: "Expand sidebar" });
    expect(trigger).toHaveClass("size-8");
  });

  it("shows the label with the [ shortcut hint in a tooltip", async () => {
    render(
      <SidebarProvider>
        <SidebarTrigger />
      </SidebarProvider>,
    );
    await userEvent.hover(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect((await screen.findAllByText("[")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Collapse sidebar/)).length).toBeGreaterThan(1);
  });
});

describe("sidebar rows", () => {
  it("marks the active row and keeps rows 36px with 14px text", () => {
    render(
      <SidebarProvider>
        <SidebarMenuButton isActive>Invoices</SidebarMenuButton>
        <SidebarMenuButton>Contracts</SidebarMenuButton>
      </SidebarProvider>,
    );
    const active = screen.getByRole("button", { name: "Invoices" });
    expect(active).toHaveAttribute("data-active", "true");
    expect(active).toHaveClass("h-9", "text-sm", "data-[active=true]:font-semibold");
    expect(active.className).not.toContain("text-xs");
    expect(screen.getByRole("button", { name: "Contracts" })).toHaveAttribute(
      "data-active",
      "false",
    );
  });
});
