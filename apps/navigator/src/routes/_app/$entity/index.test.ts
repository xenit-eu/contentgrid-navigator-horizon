/**
 * See ../../_app.test.ts for the full regression-test rationale: a loader
 * must never let a prefetch failure (e.g. 401 before authentication) crash
 * the route via TanStack Router's default error boundary.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureEntityItemCollection, ensureProfileEntityByName } from "@contentgrid/navigator-data";
import {
  FAKE_PROFILE_ENTITY,
  castLoader,
  makeRouterContext,
} from "@contentgrid/navigator-data/test-fixtures/route-loader";
import { Route } from "./index";

vi.mock("@contentgrid/features/entity-list", () => ({
  EntityDetailPage: () => null,
  validateEntitySearchState: (search: Record<string, unknown>) =>
    typeof search.cursor === "string" ? { cursor: search.cursor } : {},
}));

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return {
    ...actual,
    ensureProfileEntityByName: vi.fn(),
    ensureEntityItemCollection: vi.fn(),
  };
});

interface LoaderArgs {
  context: ReturnType<typeof makeRouterContext>;
  params: { entity: string };
  deps: { cursor: string | undefined };
}

const loader = castLoader<LoaderArgs>(Route.options.loader);

function makeLoaderArgs(cursor: string | undefined = undefined): LoaderArgs {
  return {
    context: makeRouterContext(),
    params: { entity: "invoice" },
    deps: { cursor },
  };
}

describe("/_app/$entity/ route loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves the profile by the entity route param, then prefetches its collection with the cursor from loaderDeps", async () => {
    vi.mocked(ensureProfileEntityByName).mockResolvedValue(FAKE_PROFILE_ENTITY as never);
    vi.mocked(ensureEntityItemCollection).mockResolvedValue(undefined);
    const args = makeLoaderArgs("page2token");

    await loader(args);

    expect(ensureProfileEntityByName).toHaveBeenCalledWith(
      args.context.queryClient,
      args.context.apiFetch,
      args.context.profileUrl,
      "invoice",
    );
    expect(ensureEntityItemCollection).toHaveBeenCalledWith(
      args.context.queryClient,
      args.context.apiFetch,
      { profileEntity: FAKE_PROFILE_ENTITY, cursor: "page2token" },
    );
  });

  it("does not prefetch a collection when no profile matches the entity route param", async () => {
    vi.mocked(ensureProfileEntityByName).mockResolvedValue(undefined);

    await loader(makeLoaderArgs());

    expect(ensureEntityItemCollection).not.toHaveBeenCalled();
  });

  it("does not throw when ensureProfileEntityByName rejects (e.g. 401 before authentication)", async () => {
    vi.mocked(ensureProfileEntityByName).mockRejectedValue(new Error("401 Unauthorized"));

    await expect(loader(makeLoaderArgs())).resolves.toBeUndefined();
  });

  it("does not throw when ensureEntityItemCollection rejects", async () => {
    vi.mocked(ensureProfileEntityByName).mockResolvedValue(FAKE_PROFILE_ENTITY as never);
    vi.mocked(ensureEntityItemCollection).mockRejectedValue(new Error("500 Internal Server Error"));

    await expect(loader(makeLoaderArgs())).resolves.toBeUndefined();
  });
});
