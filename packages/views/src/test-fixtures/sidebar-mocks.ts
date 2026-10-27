import { vi } from "vitest";

/**
 * Module-mock factories for the sidebar tests, which keep the sidebar off the data layer. A test
 * file calls `vi.mock` itself (it must be hoisted) and loads these lazily:
 *
 *   vi.mock("@contentgrid/features/preferences", async () => (await import(path)).preferencesModuleMock);
 *   vi.mock("@contentgrid/navigator-data", async (original) =>
 *     (await import(path)).sidebarNavigatorDataMock(original));
 */
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
