import { afterEach, describe, expect, it, vi } from "vitest";
import { revealRow } from "./reveal-row";

function buildTable(headerPosition: string, headerHeight: number) {
  document.body.innerHTML = `<div role="table"><div id="header"></div><div role="rowgroup"><div role="row" id="row"></div></div></div>`;
  const header = document.getElementById("header")!;
  header.style.position = headerPosition;
  Object.defineProperty(header, "offsetHeight", { value: headerHeight });
  return document.getElementById("row")!;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("revealRow", () => {
  it("scrolls the row into view by the least distance, clear of a sticky header", () => {
    const row = buildTable("sticky", 40);
    let marginDuringScroll = "";
    row.scrollIntoView = vi.fn(() => {
      marginDuringScroll = row.style.scrollMarginTop;
    });

    revealRow(row);

    expect(row.scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    expect(marginDuringScroll).toBe("40px");
    expect(row.style.scrollMarginTop).toBe("");
  });

  it("keeps no margin when the header does not stick (the table scrolls on its own)", () => {
    const row = buildTable("static", 40);
    let marginDuringScroll = "";
    row.scrollIntoView = vi.fn(() => {
      marginDuringScroll = row.style.scrollMarginTop;
    });

    revealRow(row);

    expect(marginDuringScroll).toBe("0px");
  });

  it("does nothing where scrolling is unavailable", () => {
    const row = buildTable("sticky", 40);
    expect(() => revealRow(row)).not.toThrow();
  });
});
