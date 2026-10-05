/**
 * Tests for useUpdateEntityItem.
 *
 * Covers:
 * - PUT with If-Match → 204 → the shown item is re-fetched with its new ETag before success
 */
import { useQuery } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { createValues } from "@contentgrid/hal-forms/values";
import {
  ALL_ATTRIBUTE_ITEM_URL,
  allAttributeItemBodyWith,
  makeAllAttributeItem,
} from "../../../test-fixtures/hal/all-attribute-item";
import { server } from "../../../test-setup";
import { EntityItem } from "../../accessors/entity-item";
import { queryKeys } from "../../query-keys";
import { useNavigatorData } from "../context";
import { makeQueryClient, makeWrapper } from "../test-utils";
import { useUpdateEntityItem } from "./use-update-entity";

function textUpdate(item: EntityItem, text: string) {
  return createValues(item.defaultTemplate!).withValue("text", text);
}

describe("useUpdateEntityItem", () => {
  it("sends the PUT with If-Match and re-fetches the shown item before succeeding", async () => {
    const item = makeAllAttributeItem({}, '"v1"');
    let ifMatch: string | null = null;
    let saved = false;
    server.use(
      http.put(ALL_ATTRIBUTE_ITEM_URL, ({ request }) => {
        ifMatch = request.headers.get("If-Match");
        saved = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get(ALL_ATTRIBUTE_ITEM_URL, () =>
        HttpResponse.json(allAttributeItemBodyWith({ text: saved ? "Updated" : "Test string" }), {
          headers: { ETag: saved ? '"v2"' : '"v1"' },
        }),
      ),
    );
    const queryClient = makeQueryClient();
    // The item page shows the item query while the update runs.
    const { result } = renderHook(
      () => {
        const { apiFetch } = useNavigatorData();
        const shownItem = useQuery(
          EntityItem.fetchByUrlQuery(apiFetch, ALL_ATTRIBUTE_ITEM_URL, item.profileEntity),
        );
        return { shownItem, update: useUpdateEntityItem(item) };
      },
      { wrapper: makeWrapper(queryClient) },
    );
    await waitFor(() => expect(result.current.shownItem.data?.etag).toBe('"v1"'));

    await act(() => result.current.update.mutateAsync(textUpdate(item, "Updated")));

    expect(ifMatch).toBe('"v1"');
    const cached = queryClient.getQueryData<EntityItem>(
      queryKeys.entityItem.byUrl(item.profileEntity, ALL_ATTRIBUTE_ITEM_URL),
    );
    expect(cached?.etag).toBe('"v2"');
  });
});
