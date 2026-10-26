import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AppAuthResult } from "@contentgrid/navigator-data";
import { useAppAuth, useLoadedProfileEntities } from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { SideBarLayout, type SideBarLayoutProps } from "./sidebar-layout";

vi.mock("@contentgrid/features/preferences", () => ({
  useEntityDisplayPreferences: () => ({ preferences: {} }),
  resolveEntityCardIcon: () => () => null,
}));

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return {
    ...actual,
    useAppAuth: vi.fn(),
    useLoadedProfileEntities: vi.fn(),
    useCachedEntityItemCollection: () => ({ data: undefined }),
  };
});

const invoice = makeProfileEntity(
  { name: "invoice", title: "Invoice", description: "" },
  "https://example.com/profile/invoices",
  "invoice",
);

function renderLayout(user: unknown, props: Partial<SideBarLayoutProps> = {}) {
  vi.mocked(useAppAuth).mockReturnValue({
    auth: { isLoading: false, isAuthenticated: true, user, signoutRedirect: vi.fn() },
    apiFetch: vi.fn(),
    contentFetch: vi.fn(),
    profileUrl: "https://api.example.com/profile",
  } as unknown as AppAuthResult);
  vi.mocked(useLoadedProfileEntities).mockReturnValue({
    profiles: [invoice],
    isLoading: false,
  } as unknown as ReturnType<typeof useLoadedProfileEntities>);

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
  it("hides the user menu when there is no authenticated user", () => {
    renderLayout(null);
    expect(screen.getByTestId("banner")).toBeInTheDocument();
    expect(screen.queryByText("Log out")).not.toBeInTheDocument();
  });

  it("shows the signed-in user's name in the user menu", () => {
    renderLayout({ profile: { name: "Jane Doe", email: "jane@example.com" }, expired: false });
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("renders topChildren above the routed page", () => {
    renderLayout(null);
    expect(screen.getByTestId("banner")).toBeInTheDocument();
    expect(screen.getByTestId("page")).toBeInTheDocument();
  });

  it("renders the footer only when given one", () => {
    renderLayout(null, { footer: <span>dev link</span> });
    expect(screen.getByText("dev link")).toBeInTheDocument();
  });

  it("opens the entity, create and home actions through its callbacks", async () => {
    const handlers = renderLayout(null);

    await userEvent.click(screen.getByRole("button", { name: /invoice/i }));
    await userEvent.click(screen.getByRole("button", { name: "Create Item" }));
    await userEvent.click(screen.getByRole("button", { name: "Home" }));

    expect(handlers.onOpenEntity).toHaveBeenCalledWith("invoice");
    expect(handlers.onOpenCreate).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenHome).toHaveBeenCalledTimes(1);
  });

  it("opens settings from the user menu", async () => {
    const handlers = renderLayout({ profile: { name: "Jane Doe", email: "j@example.com" } });

    await userEvent.click(screen.getByText("Jane Doe"));
    await userEvent.click(await screen.findByText("Settings"));

    expect(handlers.onOpenSettings).toHaveBeenCalledTimes(1);
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
});
