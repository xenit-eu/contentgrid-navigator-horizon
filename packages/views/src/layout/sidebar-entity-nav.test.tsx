import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEntityItemCollection } from "@contentgrid/navigator-data";
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
  props: { isLoading?: boolean } = {},
) {
  vi.mocked(useEntityItemCollection).mockReturnValue({
    isLoading: false,
    ...collection,
  } as unknown as ReturnType<typeof useEntityItemCollection>);
  return render(
    <SidebarProvider>
      <SidebarEntityNav
        profiles={[invoiceProfile]}
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
