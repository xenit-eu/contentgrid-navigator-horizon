/**
 * Tests entityDetailRouteOptions/entityItemDetailRouteOptions directly (the
 * shared route wiring both navigator and navigator-experimental import into
 * their otherwise-identical /_app/$entity/ and /_app/$entity/$itemId routes).
 *
 * See prefetchBestEffort's docstring for the regression this guards: a loader
 * must never let a prefetch failure (e.g. 401 before authentication) crash
 * the route via TanStack Router's default error boundary.
 *
 * Separate file from index.test.tsx: that file needs the *real*
 * navigator-data hooks (driven by MSW) for its component tests, which a
 * file-scoped vi.mock("@contentgrid/navigator-data") here would break.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureEntityItem,
  ensureEntityItemCollection,
  ensureProfileEntityByName,
} from "@contentgrid/navigator-data";
import {
  FAKE_PROFILE_ENTITY,
  makeRouterContext,
} from "@contentgrid/navigator-data/test-fixtures/route-loader";
import { entityDetailRouteOptions, entityItemDetailRouteOptions } from "./index";

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return {
    ...actual,
    ensureProfileEntityByName: vi.fn(),
    ensureEntityItemCollection: vi.fn(),
    ensureEntityItem: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("entityDetailRouteOptions.loader", () => {
  function makeArgs(cursor: string | undefined = undefined) {
    return {
      context: makeRouterContext(),
      params: { entity: "invoice" },
      deps: { cursor },
    };
  }

  it("resolves the profile by the entity route param, then prefetches its collection with the cursor from loaderDeps", async () => {
    vi.mocked(ensureProfileEntityByName).mockResolvedValue(FAKE_PROFILE_ENTITY as never);
    vi.mocked(ensureEntityItemCollection).mockResolvedValue(undefined);
    const args = makeArgs("page2token");

    await entityDetailRouteOptions.loader(args);

    expect(ensureProfileEntityByName).toHaveBeenCalledWith(
      args.context.queryClient,
      args.context.apiFetch,
      args.context.profileUrl,
      "invoice",
    );
    expect(ensureEntityItemCollection).toHaveBeenCalledWith(
      args.context.queryClient,
      args.context.apiFetch,
      {
        profileEntity: FAKE_PROFILE_ENTITY,
        cursor: "page2token",
      },
    );
  });

  it("does not prefetch a collection when no profile matches the entity route param", async () => {
    vi.mocked(ensureProfileEntityByName).mockResolvedValue(undefined);

    await entityDetailRouteOptions.loader(makeArgs());

    expect(ensureEntityItemCollection).not.toHaveBeenCalled();
  });

  it("does not throw when ensureProfileEntityByName rejects (e.g. 401 before authentication)", async () => {
    vi.mocked(ensureProfileEntityByName).mockRejectedValue(new Error("401 Unauthorized"));

    await expect(entityDetailRouteOptions.loader(makeArgs())).resolves.toBeUndefined();
  });

  it("does not throw when ensureEntityItemCollection rejects", async () => {
    vi.mocked(ensureProfileEntityByName).mockResolvedValue(FAKE_PROFILE_ENTITY as never);
    vi.mocked(ensureEntityItemCollection).mockRejectedValue(new Error("500 Internal Server Error"));

    await expect(entityDetailRouteOptions.loader(makeArgs())).resolves.toBeUndefined();
  });
});

describe("entityItemDetailRouteOptions.loader", () => {
  function makeArgs() {
    return {
      context: makeRouterContext(),
      params: { entity: "invoice", itemId: "inv-001" },
    };
  }

  it("resolves the profile by the entity route param, then prefetches the item", async () => {
    vi.mocked(ensureProfileEntityByName).mockResolvedValue(FAKE_PROFILE_ENTITY as never);
    vi.mocked(ensureEntityItem).mockResolvedValue(undefined as never);
    const args = makeArgs();

    await entityItemDetailRouteOptions.loader(args);

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

  it("does not prefetch the item when no profile matches the entity route param", async () => {
    vi.mocked(ensureProfileEntityByName).mockResolvedValue(undefined);

    await entityItemDetailRouteOptions.loader(makeArgs());

    expect(ensureEntityItem).not.toHaveBeenCalled();
  });

  it("does not throw when ensureProfileEntityByName rejects (e.g. 401 before authentication)", async () => {
    vi.mocked(ensureProfileEntityByName).mockRejectedValue(new Error("401 Unauthorized"));

    await expect(entityItemDetailRouteOptions.loader(makeArgs())).resolves.toBeUndefined();
  });

  it("does not throw when ensureEntityItem rejects", async () => {
    vi.mocked(ensureProfileEntityByName).mockResolvedValue(FAKE_PROFILE_ENTITY as never);
    vi.mocked(ensureEntityItem).mockRejectedValue(new Error("500 Internal Server Error"));

    await expect(entityItemDetailRouteOptions.loader(makeArgs())).resolves.toBeUndefined();
  });
});
