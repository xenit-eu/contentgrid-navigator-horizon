/**
 * Scrolls a table row into view after the table switched between page scroll and its own scroll
 * (a preview pane opening or closing), which resets both scroll positions and can leave the row
 * the user just used out of sight. `nearest` moves as little as possible; a sticky header would
 * cover a row scrolled to the very top, so the row keeps the header's height as scroll margin.
 */
export function revealRow(row: HTMLElement): void {
  const header = row.closest("[role='table']")?.firstElementChild;
  const stickyHeight =
    header instanceof HTMLElement && getComputedStyle(header).position === "sticky"
      ? header.offsetHeight
      : 0;

  row.style.scrollMarginTop = `${stickyHeight}px`;
  row.scrollIntoView?.({ block: "nearest" });
  row.style.scrollMarginTop = "";
}
