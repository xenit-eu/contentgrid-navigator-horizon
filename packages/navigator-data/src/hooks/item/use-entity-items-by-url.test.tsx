import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { HalSlice } from "@contentgrid/hal";
import { server } from "../../../test-setup";
import { EntityItemCollection } from "../../accessors/entity-item-collection";
import { queryKeys } from "../../query-keys";
import type { EntityItemShape } from "../../shapes";
import {
  BASE,
  loadDumpProfile,
  makeProfileEntity,
  makeQueryClient,
  makeWrapper,
} from "../test-utils";
import { useEntityItemsByUrl } from "./use-entity-items-by-url";

const profileEntity = makeProfileEntity(loadDumpProfile("supplier"), "suppliers", "supplier");
const ITEM_1 = `${BASE}/suppliers/1`;
const MISSING = `${BASE}/suppliers/missing`;

describe("useEntityItemsByUrl", () => {
  it("returns the loaded items as a collection and reports the URLs that failed", async () => {
    server.use(
      http.get(ITEM_1, () => HttpResponse.json({ id: "1", _links: { self: { href: ITEM_1 } } })),
      http.get(MISSING, () => new HttpResponse(null, { status: 404 })),
    );

    const { result } = renderHook(
      () =>
        useEntityItemsByUrl({
          urls: [ITEM_1, MISSING],
          profileEntity,
          queryOptionsOverride: { retry: false },
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.failed).toHaveLength(1));
    expect(result.current.collection.items.map((item) => item.id)).toEqual(["1"]);
    expect(result.current.failed[0]?.url).toBe(MISSING);
  });

  it("shows an item from an already-cached collection page while its own fetch runs", () => {
    const queryClient = makeQueryClient();
    const page = new EntityItemCollection(
      new HalSlice<EntityItemShape>({
        _embedded: { item: [{ id: "1", _links: { self: { href: ITEM_1 } } }] },
      }),
      profileEntity,
    );
    queryClient.setQueryData(
      queryKeys.entityItemCollection.byUrl(profileEntity, `${BASE}/suppliers`),
      page,
    );

    server.use(
      http.get(ITEM_1, () => HttpResponse.json({ id: "1", _links: { self: { href: ITEM_1 } } })),
    );
    const { result } = renderHook(() => useEntityItemsByUrl({ urls: [ITEM_1], profileEntity }), {
      wrapper: makeWrapper(queryClient),
    });

    expect(result.current.collection.items.map((item) => item.id)).toEqual(["1"]);
  });
});
