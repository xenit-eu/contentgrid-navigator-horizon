import { vi } from "vitest";
import type { AppAuthResult } from "@contentgrid/navigator-data";
import { useAppAuth, useLoadedProfileEntities } from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";

/**
 * What `SideBarLayout` and `SidebarShell` tests share: the one entity the sidebar lists, the
 * module mocks that keep the sidebar off the data layer, and the mocked hook results. A test file
 * still calls `vi.mock` itself (it must be hoisted) and hands it these factories:
 *
 *   vi.mock("@contentgrid/features/preferences", () => preferencesModuleMock);
 *   vi.mock("@contentgrid/navigator-data", sidebarNavigatorDataMock);
 */
export const invoiceProfile = makeProfileEntity(
  { name: "invoice", title: "Invoice", description: "" },
  "https://example.com/profile/invoices",
  "invoice",
);

export const preferencesModuleMock = {
  useEntityDisplayPreferences: () => ({ preferences: {} }),
  resolveEntityCardIcon: () => () => null,
};

export async function sidebarNavigatorDataMock(
  importOriginal: () => Promise<typeof import("@contentgrid/navigator-data")>,
) {
  const actual = await importOriginal();
  return {
    ...actual,
    useAppAuth: vi.fn(),
    useLoadedProfileEntities: vi.fn(),
    useCachedEntityItemCollection: () => ({ data: undefined }),
  };
}

/** Sets the signed-in user (`null` for none) and the entities the sidebar lists. */
export function mockSidebarData(user: unknown, profiles = [invoiceProfile]) {
  vi.mocked(useAppAuth).mockReturnValue({
    auth: { isLoading: false, isAuthenticated: true, user, signoutRedirect: vi.fn() },
  } as unknown as AppAuthResult);
  vi.mocked(useLoadedProfileEntities).mockReturnValue({
    profiles,
    isLoading: false,
  } as unknown as ReturnType<typeof useLoadedProfileEntities>);
}
