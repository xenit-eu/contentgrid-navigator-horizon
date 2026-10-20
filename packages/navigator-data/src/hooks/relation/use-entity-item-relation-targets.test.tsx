/**
 * Contract tests for useEntityItemRelationTargets (spec 007, contracts/navigator-data-hooks.md §1).
 *
 * Runs against the stateful relation demo model (`createRelationDemoHandlers`):
 * (a) one entry per exposed relation, to-one first then to-many, with loaded targets
 * (b) empty to-one slot (404) → target null
 * (c) ABAC-hidden relation (no cg:relation link) → no entry
 * (d) to-many first page is not sliced; totals exact vs. estimated pass through
 * (e) undefined item → { relations: [], isPending: true }, no fetch
 * (f) shares query keys with the single-relation hooks
 */
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  RELATION_DEMO_IDS,
  RELATION_DEMO_PAGE_SIZE,
  createRelationDemoHandlers,
} from "../../../test-fixtures/msw/relation-demo-handlers";
import { server } from "../../../test-setup";
import { queryKeys } from "../../query-keys";
import { useEntityItem } from "../item/use-entity-item";
import { BASE, makeQueryClient, makeWrapper } from "../test-utils";
import { useEntityItemRelationTargets } from "./use-entity-item-relation-targets";

const ids = RELATION_DEMO_IDS;

function useTargetsFor(url: string) {
  const item = useEntityItem({ url });
  return useEntityItemRelationTargets(item.data);
}

describe("useEntityItemRelationTargets", () => {
  it("returns one entry per exposed relation, to-one first, with loaded targets", async () => {
    server.use(...createRelationDemoHandlers(BASE));
    const { result } = renderHook(() => useTargetsFor(`${BASE}/orders/${ids.order(1)}`), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    const { relations } = result.current;
    expect(relations.map((r) => [r.kind, r.relation.name])).toEqual([
      ["to-one", "customer"],
      ["to-many", "products"],
    ]);

    const customer = relations[0]!;
    expect(customer.status).toBe("success");
    expect(customer.kind === "to-one" && customer.target?.id).toBe(ids.bigCorp);
    expect(customer.targetProfile?.name).toBe("customer");

    const products = relations[1]!;
    expect(products.kind === "to-many" && products.collection?.items.map((i) => i.id)).toEqual([
      ids.product(1),
      ids.product(2),
      ids.product(3),
    ]);
    expect(products.kind === "to-many" && products.collection?.totalItems).toEqual({
      count: 3,
      isEstimated: false,
    });
  });

  it("maps an empty to-one slot (404) to target null", async () => {
    server.use(...createRelationDemoHandlers(BASE));
    const { result } = renderHook(() => useTargetsFor(`${BASE}/products/${ids.product(5)}`), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    const [supplier] = result.current.relations;
    expect(supplier?.kind).toBe("to-one");
    expect(supplier?.status).toBe("success");
    expect(supplier?.kind === "to-one" && supplier.target).toBeNull();
  });

  it("omits a relation whose cg:relation link is absent (ABAC-hidden)", async () => {
    server.use(...createRelationDemoHandlers(BASE));
    const { result } = renderHook(() => useTargetsFor(`${BASE}/employees/${ids.carol}`), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.relations.map((r) => r.relation.name)).toEqual(["boss"]);
  });

  it("returns the full first page (not sliced) and passes an estimated total through", async () => {
    server.use(...createRelationDemoHandlers(BASE));
    const { result } = renderHook(() => useTargetsFor(`${BASE}/customers/${ids.bigCorp}`), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    const [orders] = result.current.relations;
    if (orders?.kind !== "to-many") throw new Error("expected to-many");
    expect(orders.collection?.items).toHaveLength(RELATION_DEMO_PAGE_SIZE);
    expect(orders.collection?.totalItems).toEqual({ count: 25, isEstimated: true });
    expect(orders.collection?.hasNext).toBe(true);
  });

  it("is pending with no relations while the item is undefined", () => {
    server.use(...createRelationDemoHandlers(BASE));
    const { result } = renderHook(() => useEntityItemRelationTargets(undefined), {
      wrapper: makeWrapper(),
    });
    expect(result.current).toEqual({ relations: [], isPending: true });
  });

  it("caches under the same keys as the single-relation hooks", async () => {
    server.use(...createRelationDemoHandlers(BASE));
    const queryClient = makeQueryClient();
    const orderUrl = `${BASE}/orders/${ids.order(1)}`;
    const { result } = renderHook(() => useTargetsFor(orderUrl), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(
      queryClient.getQueryData(queryKeys.toOneRelation.byUrl("customer", `${orderUrl}/customer`)),
    ).toBeDefined();
    expect(
      queryClient.getQueryData(queryKeys.toManyRelation.byUrl("products", `${orderUrl}/products`)),
    ).toBeDefined();
  });

  it("reports a failing relation as error without affecting the others", async () => {
    const { http, HttpResponse } = await import("msw");
    const orderUrl = `${BASE}/orders/${ids.order(1)}`;
    server.use(
      http.get(`${orderUrl}/products`, () =>
        HttpResponse.json(
          { status: 500, title: "Boom" },
          { status: 500, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
      ...createRelationDemoHandlers(BASE),
    );
    const { result } = renderHook(() => useTargetsFor(orderUrl), { wrapper: makeWrapper() });

    // The factory hardcodes retry: 3; wait for the terminal error state.
    await waitFor(() => expect(result.current.relations[1]?.status).toBe("error"), {
      timeout: 15_000,
    });
    expect(result.current.relations[0]?.status).toBe("success");
    expect(result.current.relations[1]?.error).toBeInstanceOf(Error);
  }, 20_000);
});
