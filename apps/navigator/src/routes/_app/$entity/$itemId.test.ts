/**
 * See ../../_app.test.ts for the full regression-test rationale: a loader
 * must never let a prefetch failure (e.g. 401 before authentication) crash
 * the route via TanStack Router's default error boundary.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureEntityItem, ensureProfileEntityByName } from "@contentgrid/navigator-data";
import {
  FAKE_PROFILE_ENTITY,
  castLoader,
  makeRouterContext,
} from "@contentgrid/navigator-data/test-fixtures/route-loader";
import { Route } from "./$itemId";

vi.mock("@contentgrid/features/entity-list", () => ({
  EntityItemDetailPage: () => null,
  validateEntitySearchState: (search: Record<string, unknown>) =>
    typeof search.cursor === "string" ? { cursor: search.cursor } : {},
}));

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return {
    ...actual,
    ensureProfileEntityByName: vi.fn(),
    ensureEntityItem: vi.fn(),
  };
});

interface LoaderArgs {
  context: ReturnType<typeof makeRouterContext>;
  params: { entity: string; itemId: string };
}

const loader = castLoader<LoaderArgs>(Route.options.loader);

function makeLoaderArgs(): LoaderArgs {
  return {
    context: makeRouterContext(),
    params: { entity: "invoice", itemId: "inv-001" },
  };
}

describe("/_app/$entity/$itemId route loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves the profile by the entity route param, then prefetches the item by the itemId route param", async () => {
    vi.mocked(ensureProfileEntityByName).mockResolvedValue(FAKE_PROFILE_ENTITY as never);
    vi.mocked(ensureEntityItem).mockResolvedValue(undefined as never);
    const args = makeLoaderArgs();

    await loader(args);

    expect(ensureProfileEntityByName).toHaveBeenCalledWith(
      args.context.queryClient,
      args.context.apiFetch,
      args.context.profileUrl,
      "invoice",
    );
    expect(ensureEntityItem).toHaveBeenCalledWith(
      args.context.queryClient,
      args.context.apiFetch,
      FAKE_PROFILE_ENTITY,
      "inv-001",
    );
  });

  it("does not prefetch an item when no profile matches the entity route param", async () => {
    vi.mocked(ensureProfileEntityByName).mockResolvedValue(undefined);

    await loader(makeLoaderArgs());

    expect(ensureEntityItem).not.toHaveBeenCalled();
  });

  it("does not throw when ensureProfileEntityByName rejects (e.g. 401 before authentication)", async () => {
    vi.mocked(ensureProfileEntityByName).mockRejectedValue(new Error("401 Unauthorized"));

    await expect(loader(makeLoaderArgs())).resolves.toBeUndefined();
  });

  it("does not throw when ensureEntityItem rejects", async () => {
    vi.mocked(ensureProfileEntityByName).mockResolvedValue(FAKE_PROFILE_ENTITY as never);
    vi.mocked(ensureEntityItem).mockRejectedValue(new Error("500 Internal Server Error"));

    await expect(loader(makeLoaderArgs())).resolves.toBeUndefined();
  });
});
