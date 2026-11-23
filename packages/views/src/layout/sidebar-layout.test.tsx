import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSidebarData } from "../test-fixtures/sidebar-harness";
import { SideBarLayout, type SideBarLayoutProps } from "./sidebar-layout";

vi.mock("@contentgrid/features/preferences", async () => {
  const { preferencesModuleMock } = await import("../test-fixtures/sidebar-mocks");
  return preferencesModuleMock;
});

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const { sidebarNavigatorDataMock } = await import("../test-fixtures/sidebar-mocks");
  return sidebarNavigatorDataMock(importOriginal);
});

function renderLayout(user: unknown, props: Partial<SideBarLayoutProps> = {}) {
  mockSidebarData(user);

  const handlers = {
    onOpenHome: vi.fn(),
    onOpenEntity: vi.fn(),
    onOpenCreate: vi.fn(),
    onOpenSettings: vi.fn(),
  };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SideBarLayout topChildren={<div data-testid="banner" />} {...handlers} {...props}>
        <div data-testid="page" />
      </SideBarLayout>
    </QueryClientProvider>,
  );
  return handlers;
}

describe("SideBarLayout", () => {
  // The sidebar remembers its state in a cookie; do not let one test's toggle leak into the next.
  beforeEach(() => {
    document.cookie = "sidebar_state=; path=/; max-age=0";
  });

  it("hides the user menu when there is no authenticated user", () => {
    renderLayout(null);
    expect(screen.getByTestId("banner")).toBeInTheDocument();
    expect(screen.queryByText("Log out")).not.toBeInTheDocument();
  });

  it("names the user menu after the signed-in user", () => {
    renderLayout({ profile: { name: "Jane Doe", email: "jane@example.com" }, expired: false });
    expect(screen.getByRole("button", { name: /jane doe/i })).toBeInTheDocument();
  });

  it("renders topChildren above the routed page", () => {
    renderLayout(null);
    expect(screen.getByTestId("banner")).toBeInTheDocument();
    expect(screen.getByTestId("page")).toBeInTheDocument();
  });

  it("opens the entity, create and home actions through its callbacks", async () => {
    const handlers = renderLayout(null);

    await userEvent.click(screen.getByRole("button", { name: /invoice/i }));
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    await userEvent.click(screen.getByRole("button", { name: "Home" }));

    expect(handlers.onOpenEntity).toHaveBeenCalledWith("invoice");
    expect(handlers.onOpenCreate).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenHome).toHaveBeenCalledTimes(1);
  });

  it("shows Home as a labelled row under Create, current on the home page", async () => {
    renderLayout(null, { homeCurrent: true });

    const rows = screen.getAllByRole("button", { name: /^(Create|Home)$/ });
    expect(rows.map((row) => row.textContent)).toEqual(["Create", "Home"]);
    expect(screen.getByRole("button", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Home" })).toHaveAttribute("data-active", "true");
    expect(screen.getByRole("button", { name: "Create" })).not.toHaveAttribute("aria-current");
  });

  it("does not mark Home as current elsewhere", () => {
    renderLayout(null);
    expect(screen.getByRole("button", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("has a Settings row at the bottom of the sidebar, outside the scrolling list", async () => {
    const handlers = renderLayout(null, { settingsCurrent: true });

    const row = screen.getByRole("button", { name: "Settings" });
    const footer = row.closest("[data-slot='sidebar-footer']");
    expect(footer).toBeInTheDocument();
    expect(footer?.closest("[data-slot='sidebar-inner']")?.lastElementChild).toBe(footer);
    expect(row.closest("[data-slot='sidebar-content']")).toBeNull();
    expect(row).toHaveAttribute("aria-current", "page");
    expect(row).toHaveAttribute("data-active", "true");

    await userEvent.click(row);
    expect(handlers.onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("renders the Settings row as a link when the host has an address", () => {
    renderLayout(null, { settingsHref: "/~configuration" });
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/~configuration",
    );
  });

  it("opens settings from the user menu", async () => {
    const handlers = renderLayout({ profile: { name: "Jane Doe", email: "j@example.com" } });

    await userEvent.click(screen.getByRole("button", { name: /jane doe/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Settings" }));

    expect(handlers.onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("shows Settings as current in the user menu when told a settings page is open", async () => {
    renderLayout(
      { profile: { name: "Jane Doe", email: "j@example.com" } },
      { settingsCurrent: true },
    );

    await userEvent.click(screen.getByRole("button", { name: /jane doe/i }));

    expect(await screen.findByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("has no theme switch in the header; the choice is in the user menu", async () => {
    renderLayout({ profile: { name: "Jane Doe", email: "j@example.com" } });
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /jane doe/i }));

    expect(await screen.findByText("Appearance")).toBeInTheDocument();
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(3);
  });

  it("renders real links when hrefs are given, and still opens through the callbacks on a plain click", async () => {
    const handlers = renderLayout(null, {
      homeHref: "/",
      entityHref: (entityName) => `/${entityName}`,
    });

    expect(screen.getByRole("link", { name: /invoice/i })).toHaveAttribute("href", "/invoice");
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");

    await userEvent.click(screen.getByRole("link", { name: /invoice/i }));
    await userEvent.click(screen.getByRole("link", { name: "Home" }));

    expect(handlers.onOpenEntity).toHaveBeenCalledWith("invoice");
    expect(handlers.onOpenHome).toHaveBeenCalledTimes(1);
  });

  it("leaves a modified click to the browser", async () => {
    const handlers = renderLayout(null, { entityHref: (entityName) => `/${entityName}` });

    fireEvent.click(screen.getByRole("link", { name: /invoice/i }), { ctrlKey: true });

    expect(handlers.onOpenEntity).not.toHaveBeenCalled();
  });

  it("has one sidebar toggle, in the header next to the logo, that collapses and expands", async () => {
    renderLayout(null);

    const toggles = screen.getAllByRole("button", { name: /(collapse|expand) sidebar/i });
    expect(toggles).toHaveLength(1);
    expect(screen.getByRole("banner")).toContainElement(toggles[0]);

    await userEvent.click(toggles[0]);
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  });

  it("opens collapsed after a reload when it was collapsed, and keeps toggling", async () => {
    document.cookie = "sidebar_state=false; path=/";
    renderLayout(null);

    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
    expect(document.cookie).toContain("sidebar_state=true");
  });

  it("toggles with the [ key", async () => {
    renderLayout(null);

    fireEvent.keyDown(window, { key: "[" });

    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  });
});

describe("SideBarLayout on a phone", () => {
  const desktopWidth = window.innerWidth;
  beforeEach(() => {
    document.cookie = "sidebar_state=; path=/; max-age=0";
    window.innerWidth = 390;
  });
  afterEach(() => {
    window.innerWidth = desktopWidth;
  });

  it("has a header toggle named Open menu that opens a drawer with brand, close button and 46px rows", async () => {
    renderLayout(null);

    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));

    const drawer = screen.getByRole("dialog");
    expect(drawer).toHaveAttribute("data-mobile", "true");
    expect(within(drawer).getByRole("img", { name: "ContentGrid logo" })).toBeInTheDocument();
    expect(within(drawer).getByText("grid")).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Close menu" })).toBeInTheDocument();
    for (const name of ["Create", "Home", /invoice/i]) {
      expect(within(drawer).getByRole("button", { name })).toHaveClass(
        "in-data-[mobile=true]:h-[46px]",
      );
    }
  });

  it("navigates home and closes the drawer when the drawer logo is clicked", async () => {
    const handlers = renderLayout(null);

    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: /content.*grid.*by amexio/i }),
    );

    expect(handlers.onOpenHome).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("has one Settings entry on a phone, in the drawer's account block", async () => {
    const handlers = renderLayout(
      { profile: { name: "Jane Doe", email: "jane@example.com" } },
      { settingsCurrent: true },
    );
    // Closed drawer: nothing from the desktop footer leaks into the page.
    expect(screen.queryByRole("button", { name: "Settings" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));

    const settings = screen.getAllByRole("button", { name: "Settings" });
    expect(settings).toHaveLength(1);
    const block = settings[0].closest("[data-slot='phone-menu-account']");
    expect(block).toBeInTheDocument();
    expect(settings[0]).toHaveAttribute("aria-current", "page");
    expect(settings[0]).toHaveClass("in-data-[mobile=true]:h-[46px]");
    await userEvent.click(settings[0]);
    expect(handlers.onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("shows the account, appearance and Log out in the drawer and keeps the header avatar menu", async () => {
    renderLayout({ profile: { name: "Jane Doe", email: "jane@example.com" } });

    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));

    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText("Jane Doe")).toBeInTheDocument();
    expect(within(drawer).getByText("jane@example.com")).toBeInTheDocument();
    expect(within(drawer).getByRole("radiogroup", { name: "Appearance" })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Log out" })).toBeInTheDocument();
    // Still rendered behind the drawer's overlay (hidden from the accessibility tree while open).
    expect(
      screen.getByRole("button", { name: /account menu, jane doe/i, hidden: true }),
    ).toBeInTheDocument();
  });

  it("keeps Settings in the drawer when nobody is signed in (no account block)", async () => {
    renderLayout(null);
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getAllByRole("button", { name: "Settings" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Log out" })).not.toBeInTheDocument();
  });

  it("closes the drawer from its Close menu button", async () => {
    renderLayout(null);
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));

    await userEvent.click(screen.getByRole("button", { name: "Close menu" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
