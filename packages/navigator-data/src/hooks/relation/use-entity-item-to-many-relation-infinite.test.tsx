/**
 * Contract tests for useEntityItemToManyRelationInfinite (spec 007, contracts/navigator-data-hooks.md §2).
 *
 * (a) first page from relation.link.href; fetchNextPage requests exactly the `next` href
 * (b) hasNextPage false after the last page
 * (c) useUnlinkRelation success invalidates (refetches) the infinite list
 * (d) undefined relation → disabled, no fetch
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import {
  RELATION_DEMO_IDS,
  RELATION_DEMO_PAGE_SIZE,
  createRelationDemoHandlers,
} from "../../../test-fixtures/msw/relation-demo-handlers";
import { server } from "../../../test-setup";
import { useEntityItem } from "../item/use-entity-item";
import { BASE, makeWrapper } from "../test-utils";
import { useEntityItemToManyRelationInfinite } from "./use-entity-item-to-many-relation-infinite";
import { useUnlinkRelation } from "./use-unlink-relation";

const ids = RELATION_DEMO_IDS;
const BIG_CORP_URL = `${BASE}/customers/${ids.bigCorp}`;

function useOrdersOfBigCorp() {
  const { data: customer } = useEntityItem({ url: BIG_CORP_URL });
  const relation = customer?.getToManyRelation("orders");
  const infinite = useEntityItemToManyRelationInfinite(relation);
  return { relation, infinite };
}

describe("useEntityItemToManyRelationInfinite", () => {
  it("loads the first page, then follows exactly the `next` link", async () => {
    const requested: string[] = [];
    server.use(
      http.get(`${BIG_CORP_URL}/orders`, ({ request }) => {
        requested.push(request.url);
        return undefined; // fall through to the demo handler
      }),
      ...createRelationDemoHandlers(BASE),
    );

    const { result } = renderHook(() => useOrdersOfBigCorp(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.infinite.isSuccess).toBe(true));
    const firstPage = result.current.infinite.data!.pages[0]!;
    expect(firstPage.items).toHaveLength(RELATION_DEMO_PAGE_SIZE);
    expect(result.current.infinite.hasNextPage).toBe(true);
    expect(requested).toEqual([`${BIG_CORP_URL}/orders`]);

    const nextHref = firstPage.nextHref;
    await act(async () => {
      await result.current.infinite.fetchNextPage();
    });

    await waitFor(() => expect(result.current.infinite.data?.pages).toHaveLength(2));
    expect(requested[1]).toBe(nextHref);
    expect(result.current.infinite.data!.pages.flatMap((p) => p.items)).toHaveLength(25);
    expect(result.current.infinite.hasNextPage).toBe(false);
  });

  it("is refreshed after useUnlinkRelation succeeds", async () => {
    server.use(...createRelationDemoHandlers(BASE));

    const { result } = renderHook(
      () => {
        const state = useOrdersOfBigCorp();
        const unlink = useUnlinkRelation(state.relation!, {});
        return { ...state, unlink };
      },
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.infinite.isSuccess).toBe(true));
    const firstItem = result.current.infinite.data!.pages[0]!.items[0]!;
    expect(firstItem.id).toBe(ids.order(1));

    await act(async () => {
      await result.current.unlink.mutateAsync(firstItem);
    });

    await waitFor(() =>
      expect(result.current.infinite.data!.pages[0]!.items[0]!.id).toBe(ids.order(2)),
    );
  });

  it("stays idle while the relation is undefined", () => {
    server.use(...createRelationDemoHandlers(BASE));
    const { result } = renderHook(() => useEntityItemToManyRelationInfinite(undefined), {
      wrapper: makeWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });
});
