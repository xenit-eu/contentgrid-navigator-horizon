import { describe, expect, it } from "vitest";
import { TO_MANY_TABLE_MIN_WIDTH, relationLayoutForPane } from "./relation-layout";

describe("relationLayoutForPane", () => {
  it("uses the widest layout outside a resizable pane", () => {
    expect(relationLayoutForPane(undefined)).toEqual({
      toManyTable: true,
      toOneSummaryColumns: 4,
      toOneSummaryCount: 8,
    });
  });

  it("uses the most compact layout in a pane that hasn't been measured yet", () => {
    expect(relationLayoutForPane({ side: "right", width: undefined })).toEqual({
      toManyTable: false,
      toOneSummaryColumns: 0,
      toOneSummaryCount: 0,
    });
  });

  it("switches to-many relations to the table from the table breakpoint up", () => {
    const pane = (width: number) => ({ side: "right" as const, width });
    expect(relationLayoutForPane(pane(TO_MANY_TABLE_MIN_WIDTH - 1)).toManyTable).toBe(false);
    expect(relationLayoutForPane(pane(TO_MANY_TABLE_MIN_WIDTH)).toManyTable).toBe(true);
  });

  it.each([
    [360, 0, 0],
    [400, 2, 4],
    [639, 2, 4],
    [640, 3, 6],
    [880, 4, 8],
    [1400, 4, 8],
  ])("gives a %ipx pane %i to-one summary columns (%i attributes)", (width, columns, count) => {
    const layout = relationLayoutForPane({ side: "right", width });
    expect(layout.toOneSummaryColumns).toBe(columns);
    expect(layout.toOneSummaryCount).toBe(count);
  });
});
