import { vi } from "vitest";
import type { AppAuthResult } from "@contentgrid/navigator-data";
import { useAppAuth, useLoadedProfileEntities } from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";

/**
 * What `SideBarLayout` and `SidebarShell` tests share: the one entity the sidebar lists, the
 * and the mocked hook results. The module mocks live in `./sidebar-mocks` (no static import of
 * `@contentgrid/navigator-data`, so a `vi.mock` factory can load them without a cycle).
 */
export const invoiceProfile = makeProfileEntity(
  { name: "invoice", title: "Invoice", description: "" },
  "https://example.com/profile/invoices",
  "invoice",
);

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
