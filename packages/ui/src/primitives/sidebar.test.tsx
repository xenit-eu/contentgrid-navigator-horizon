import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  Sidebar,
  SidebarLinkButton,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
  SidebarTrigger,
} from "./sidebar";

beforeEach(() => {
  document.cookie = "sidebar_state=; path=/; max-age=0";
});

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

describe("SidebarMenuSkeleton", () => {
  it("uses the width it is given", () => {
    const { container } = render(<SidebarMenuSkeleton width="55%" />);
    const bar = container.querySelector<HTMLElement>("[data-sidebar='menu-skeleton-text']");
    expect(bar?.style.getPropertyValue("--skeleton-width")).toBe("55%");
  });
});

describe("sidebar state cookie", () => {
  it("starts expanded without a cookie", () => {
    render(
      <SidebarProvider>
        <SidebarTrigger />
      </SidebarProvider>,
    );
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });

  it("starts collapsed when the cookie says so", () => {
    document.cookie = "sidebar_state=false; path=/";
    render(
      <SidebarProvider>
        <SidebarTrigger />
      </SidebarProvider>,
    );
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  });

  it("remembers a toggle for the next mount", async () => {
    const first = render(
      <SidebarProvider>
        <SidebarTrigger />
      </SidebarProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    first.unmount();

    render(
      <SidebarProvider>
        <SidebarTrigger />
      </SidebarProvider>,
    );
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  });

  it("lets an explicit defaultOpen win over the cookie", () => {
    document.cookie = "sidebar_state=false; path=/";
    render(
      <SidebarProvider defaultOpen>
        <SidebarTrigger />
      </SidebarProvider>,
    );
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });

  it("keeps the [ shortcut working", async () => {
    render(
      <SidebarProvider>
        <SidebarTrigger />
      </SidebarProvider>,
    );
    fireEvent.keyDown(window, { key: "[" });
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  });
});

describe("SidebarMenuButton tooltips", () => {
  it("shows the expanded tooltip while expanded", async () => {
    render(
      <SidebarProvider defaultOpen>
        <SidebarMenuButton tooltip="Invoices · 12" expandedTooltip="Invoices: what we bill.">
          Invoices
        </SidebarMenuButton>
      </SidebarProvider>,
    );
    await userEvent.hover(screen.getByRole("button", { name: "Invoices" }));
    expect(await screen.findByRole("tooltip", {}, { timeout: 2000 })).toHaveTextContent(
      "Invoices: what we bill.",
    );
  });

  it("shows the collapsed tooltip while collapsed", async () => {
    render(
      <SidebarProvider defaultOpen={false}>
        <SidebarMenuButton tooltip="Invoices · 12" expandedTooltip="Invoices: what we bill.">
          Invoices
        </SidebarMenuButton>
      </SidebarProvider>,
    );
    await userEvent.hover(screen.getByRole("button", { name: "Invoices" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Invoices · 12");
  });

  it("keeps the label in the accessible name but visually hides it while collapsed", () => {
    render(
      <SidebarProvider defaultOpen={false}>
        <SidebarMenuButton>
          <svg aria-hidden />
          <span>Invoices</span>
        </SidebarMenuButton>
      </SidebarProvider>,
    );
    const button = screen.getByRole("button", { name: "Invoices" });
    expect(button).toHaveClass("group-data-[collapsible=icon]:[&>span:last-child]:sr-only");
    expect(button).toHaveClass("group-data-[collapsible=icon]:size-10!");
    expect(button.querySelector("span:last-child")).toHaveTextContent("Invoices");
  });

  it.each([
    ["Create", "primary" as const],
    ["Home", "default" as const],
    ["Settings", "default" as const],
  ])("shows the %s link-button label as a tooltip while collapsed", async (label, variant) => {
    render(
      <SidebarProvider defaultOpen={false}>
        <SidebarLinkButton icon={<svg aria-hidden />} label={label} variant={variant} />
      </SidebarProvider>,
    );
    const button = screen.getByRole("button", { name: label });
    await userEvent.hover(button);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(label);
  });
});

describe("phone drawer", () => {
  const desktopWidth = window.innerWidth;
  beforeEach(() => {
    window.innerWidth = 390;
  });
  afterEach(() => {
    window.innerWidth = desktopWidth;
  });

  it("is 300px wide, marked data-mobile, and shows the mobile header", () => {
    render(
      <SidebarProvider defaultOpenMobile>
        <Sidebar mobileHeader={<p>Drawer header</p>}>
          <SidebarMenuButton>Invoices</SidebarMenuButton>
        </Sidebar>
      </SidebarProvider>,
    );
    const drawer = screen.getByRole("dialog");
    expect(drawer).toHaveAttribute("data-mobile", "true");
    expect(drawer.style.getPropertyValue("--sidebar-width")).toBe("18.75rem");
    expect(screen.getByText("Drawer header")).toBeInTheDocument();
    // The sheet's own close button stays hidden; the header brings its own.
    expect(drawer).toHaveClass("[&>button]:hidden");
  });

  it("makes rows 46px on the drawer only (a desktop row keeps its 36px)", () => {
    render(
      <SidebarProvider defaultOpenMobile>
        <Sidebar>
          <SidebarMenuButton>Invoices</SidebarMenuButton>
        </Sidebar>
      </SidebarProvider>,
    );
    const row = screen.getByRole("button", { name: "Invoices" });
    expect(row).toHaveClass("h-9", "in-data-[mobile=true]:h-[46px]");
  });

  it("keeps a row's count centred in the taller drawer row", () => {
    render(
      <SidebarProvider defaultOpenMobile>
        <Sidebar>
          <SidebarMenuItem>
            <SidebarMenuButton>Invoices</SidebarMenuButton>
            <SidebarMenuBadge>12</SidebarMenuBadge>
          </SidebarMenuItem>
        </Sidebar>
      </SidebarProvider>,
    );
    expect(screen.getByText("12")).toHaveClass(
      "in-data-[mobile=true]:peer-data-[size=default]/menu-button:top-[13px]",
    );
  });

  it("names the toggle Open menu / Close menu", async () => {
    render(
      <SidebarProvider>
        <SidebarTrigger />
        <Sidebar>
          <SidebarMenuButton>Invoices</SidebarMenuButton>
        </Sidebar>
      </SidebarProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /(collapse|expand) sidebar/i })).toBeNull();
  });
});
