/**
 * Tests for useReloadEntityItem.
 *
 * Covers:
 * - resolves with the latest item and stores it in the item cache
 * - rejects when the reload fails
 */
import { act, renderHook } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import {
  ALL_ATTRIBUTE_ITEM_URL,
  allAttributeItemBodyWith,
  makeAllAttributeItem,
} from "../../../test-fixtures/hal/all-attribute-item";
import { server } from "../../../test-setup";
import type { EntityItem } from "../../accessors/entity-item";
import { queryKeys } from "../../query-keys";
import { makeQueryClient, makeWrapper } from "../test-utils";
import { useReloadEntityItem } from "./use-reload-entity-item";

describe("useReloadEntityItem", () => {
  it("resolves with the latest item and stores it in the item cache", async () => {
    const item = makeAllAttributeItem({}, '"v1"');
    server.use(
      http.get(ALL_ATTRIBUTE_ITEM_URL, () =>
        HttpResponse.json(allAttributeItemBodyWith(), {
          headers: { ETag: '"v2"' },
        }),
      ),
    );
    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useReloadEntityItem(item), {
      wrapper: makeWrapper(queryClient),
    });

    const reloaded = await act(() => result.current());

    expect(reloaded.etag).toBe('"v2"');
    expect(
      queryClient.getQueryData<EntityItem>(
        queryKeys.entityItem.byUrl(item.profileEntity, ALL_ATTRIBUTE_ITEM_URL),
      ),
    ).toBe(reloaded);
  });

  it("rejects when the reload fails", async () => {
    const item = makeAllAttributeItem({}, '"v1"');
    server.use(http.get(ALL_ATTRIBUTE_ITEM_URL, () => new HttpResponse(null, { status: 500 })));
    const { result } = renderHook(() => useReloadEntityItem(item), {
      wrapper: makeWrapper(makeQueryClient()),
    });

    await expect(act(() => result.current())).rejects.toThrow();
  });
});
