import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useEntityItemCollection } from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { SidebarProvider } from "@contentgrid/ui";
import { invoiceProfile } from "../test-fixtures/sidebar-harness";
import { SidebarEntityNav } from "./sidebar-entity-nav";

vi.mock("@contentgrid/features/preferences", async () => {
  const { preferencesModuleMock } = await import("../test-fixtures/sidebar-mocks");
  return preferencesModuleMock;
});

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const { sidebarNavigatorDataMock } = await import("../test-fixtures/sidebar-mocks");
  return sidebarNavigatorDataMock(importOriginal);
});

function renderNav(
  collection: { data?: unknown; isLoading?: boolean },
  props: { isLoading?: boolean; open?: boolean; profile?: typeof invoiceProfile } = {},
) {
  vi.mocked(useEntityItemCollection).mockReturnValue({
    isLoading: false,
    ...collection,
  } as unknown as ReturnType<typeof useEntityItemCollection>);
  return render(
    <SidebarProvider defaultOpen={props.open ?? true}>
      <SidebarEntityNav
        profiles={[props.profile ?? invoiceProfile]}
        isLoading={props.isLoading ?? false}
        activeEntity={undefined}
        onOpenEntity={vi.fn()}
      />
    </SidebarProvider>,
  );
}

const badge = (container: HTMLElement) =>
  container.querySelector("[data-slot='sidebar-menu-badge']");

describe("SidebarEntityNav counts", () => {
  it("loads the count of every entity with the query Home's cards use", () => {
    renderNav({ data: { totalItems: { count: 412, isEstimated: false } } });

    expect(useEntityItemCollection).toHaveBeenCalledWith(
      { profileEntity: invoiceProfile },
      { queryOptionsOverride: { refetchOnWindowFocus: false, refetchOnMount: false } },
    );
  });

  it("shows an exact count", () => {
    const { container } = renderNav({ data: { totalItems: { count: 412, isEstimated: false } } });
    expect(badge(container)).toHaveTextContent("412");
  });

  it("separates thousands with a thin no-break space", () => {
    const { container } = renderNav({ data: { totalItems: { count: 1284, isEstimated: false } } });
    expect(badge(container)?.textContent).toBe("1 284");
  });

  it("prefixes an estimate with a tilde", () => {
    const { container } = renderNav({ data: { totalItems: { count: 1204, isEstimated: true } } });
    expect(badge(container)?.textContent).toBe("~1 204");
  });

  it("shows zero", () => {
    const { container } = renderNav({ data: { totalItems: { count: 0, isEstimated: false } } });
    expect(badge(container)).toHaveTextContent("0");
  });

  it("shows a skeleton pill while the count loads", () => {
    const { container } = renderNav({ isLoading: true });
    expect(badge(container)?.querySelector("[data-slot='skeleton']")).toBeInTheDocument();
  });

  it("shows nothing when the count is unknown or not allowed", () => {
    const { container } = renderNav({ data: undefined });
    expect(badge(container)).not.toBeInTheDocument();
    expect(container.querySelector("svg[class*='brackets' i]")).not.toBeInTheDocument();
  });

  it("shows three skeleton bars of fixed widths while the entity list loads", () => {
    const { container } = renderNav({}, { isLoading: true });
    const bars = container.querySelectorAll<HTMLElement>("[data-sidebar='menu-skeleton-text']");
    expect(Array.from(bars).map((bar) => bar.style.getPropertyValue("--skeleton-width"))).toEqual([
      "70%",
      "55%",
      "64%",
    ]);
  });
});

describe("SidebarEntityNav tooltips", () => {
  const contracts = makeProfileEntity(
    {
      name: "contract",
      title: "Contracts",
      description: "agreements with a supplier or customer.",
    },
    "https://example.com/profile/contracts",
    "Contracts",
  );
  const count = { data: { totalItems: { count: 1284, isEstimated: false } } };

  it("shows the description of the entity on hover while expanded", async () => {
    renderNav(count, { profile: contracts });

    await userEvent.hover(screen.getByRole("button", { name: /contracts/i }));

    expect(await screen.findByRole("tooltip", {}, { timeout: 2000 })).toHaveTextContent(
      "Contracts: agreements with a supplier or customer.",
    );
  });

  it("shows nothing on hover while expanded when the entity has no description", async () => {
    renderNav(count);

    await userEvent.hover(screen.getByRole("button", { name: /invoice/i }));
    await new Promise((resolve) => setTimeout(resolve, 700));

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows name and count while collapsed", async () => {
    renderNav(count, { open: false, profile: contracts });

    await userEvent.hover(screen.getByRole("button", { name: /contracts/i }));

    expect((await screen.findByRole("tooltip")).textContent).toBe("Contracts · 1\u202f284");
  });

  it("leaves the count out of the collapsed tooltip when it is unknown", async () => {
    renderNav({ data: undefined }, { open: false, profile: contracts });

    await userEvent.hover(screen.getByRole("button", { name: /contracts/i }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(/^Contracts$/);
  });
});
