import { describe, expect, it } from "vitest";
import { graphSearchValidator, searchToTrail, trailToSearch } from "./graph-search";

describe("graphSearchValidator", () => {
  it("keeps well-formed entries", () => {
    expect(
      graphSearchValidator({
        trail: [
          { e: "order", id: "o-1", via: "orders" },
          { e: "product", id: "p-1" },
        ],
      }),
    ).toEqual({
      trail: [
        { e: "order", id: "o-1", via: "orders" },
        { e: "product", id: "p-1" },
      ],
    });
  });

  it("drops malformed entries and never throws", () => {
    expect(
      graphSearchValidator({
        trail: [
          null,
          "x",
          { e: "", id: "o-1" },
          { e: "order" },
          { e: "order", id: 5 },
          { e: "order", id: "o-2", via: 3 },
        ],
      }),
    ).toEqual({ trail: [{ e: "order", id: "o-2" }] });
    expect(graphSearchValidator({ trail: "nope" })).toEqual({});
    expect(graphSearchValidator({})).toEqual({});
  });

  it("omits an empty trail", () => {
    expect(graphSearchValidator({ trail: [] })).toEqual({});
  });
});

describe("trail <-> search", () => {
  it("round-trips", () => {
    const trail = [
      { entityName: "order", id: "o-1", via: "orders" },
      { entityName: "product", id: "p-1" },
    ];
    expect(searchToTrail(trailToSearch(trail))).toEqual(trail);
  });

  it("maps an empty trail to undefined and back to []", () => {
    expect(trailToSearch([])).toBeUndefined();
    expect(searchToTrail(undefined)).toEqual([]);
  });
});
