import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import type { EntitySchema } from "../types/entity";
import { BASE, makeQueryClient, makeWrapper, seedProfile } from "./test-utils";
import { useEntityStatusBreakdown } from "./use-entity-status-breakdown";

const COLLECTION_URL = `${BASE}/invoices`;

const schema: EntitySchema = {
  attributes: [
    {
      name: "status",
      title: "Status",
      type: "string",
      readOnly: false,
      required: false,
      unique: false,
      searchable: true,
      prefixSearchable: false,
      allowedValues: ["draft", "sent"],
    },
  ],
  relations: [],
  searchProperties: [],
  sortableFields: [],
  sortOptions: [],
  canCreate: true,
  createFormRelations: [],
};

describe("useEntityStatusBreakdown", () => {
  it("returns breakdown counts for each allowed value", async () => {
    // MSW2 matches query params transparently — just use the base collection URL.
    server.use(
      http.get(COLLECTION_URL, ({ request }) => {
        const url = new URL(request.url);
        const status = url.searchParams.get("status");
        const count = status === "draft" ? 5 : 3;
        return HttpResponse.json({
          _links: { self: { href: request.url } },
          _embedded: { item: [] },
          page: { total_items_exact: count },
        });
      }),
    );

    // Seed profile so collectionHref is available immediately — avoids the
    // timing gap where queries are disabled while the profile is loading.
    const qc = makeQueryClient();
    seedProfile(qc);

    const { result } = renderHook(() => useEntityStatusBreakdown("invoice", schema), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(
      () => expect(result.current.breakdown.find((b) => b.value === "draft")?.count).toBe(5),
      { timeout: 3000 },
    );

    expect(result.current.attribute).toBe("Status");
    expect(result.current.breakdown.find((b) => b.value === "sent")?.count).toBe(3);
  });

  it("returns empty breakdown when schema has no enum attribute", () => {
    const schemaNoEnum: EntitySchema = { ...schema, attributes: [] };
    const { result } = renderHook(() => useEntityStatusBreakdown("invoice", schemaNoEnum), {
      wrapper: makeWrapper(),
    });
    expect(result.current.breakdown).toEqual([]);
  });

  it("returns empty breakdown when schema is null", () => {
    const { result } = renderHook(() => useEntityStatusBreakdown("invoice", null), {
      wrapper: makeWrapper(),
    });
    expect(result.current.breakdown).toEqual([]);
  });
});
