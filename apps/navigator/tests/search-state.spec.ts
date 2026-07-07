/**
 * Verifies that the cursor param is validated by TanStack Router, that
 * clicking Next/Previous actually drives cursor-based pagination against the
 * stubbed HAL endpoint, and that browser back/forward correctly restores
 * prior search state.
 *
 * The entity list lives at /$entity (e.g. /invoice). `_app` is a *pathless*
 * layout route, so it never appears in the URL — navigating to `/_app/invoice`
 * would match the item-detail route ($entity/$itemId), not the list.
 *
 * This test does not rely on `getByRole("table")` alone: with
 * `placeholderData: keepPreviousData`, the page-1 table stays visible while a
 * broken cursor fetch fails or falls back silently, which would let a stale
 * table mask real breakage. Instead it asserts on row text that is unique to
 * each page (see `createDemoHandlers` / `PAGE_2_INVOICE_ID` in
 * `packages/navigator-data/test-fixtures/msw/demo-handlers.ts`), which can
 * only be visible if the cursor fetch actually reached page 2.
 */
import { expect, test } from "@playwright/test";

const PAGE_1_INVOICE_ID = "inv-001";
const PAGE_2_INVOICE_ID = "INVOICE-PAGE2";

test("Next/Previous drive real cursor pagination, preserved through browser back/forward", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));

  // Navigate to the entity list (no cursor — first page).
  await page.goto("/invoice");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByText(PAGE_1_INVOICE_ID)).toBeVisible();
  expect(page.url()).not.toContain("cursor=");

  // Click Next — this issues a real fetch to the HAL next link, extracts the
  // bare _cursor token from it, and stores just that token under `cursor` (no
  // origin, no _size, no s.* prefix — see EntityItemCollection.nextCursor and
  // the exception documented in packages/navigator-data/CLAUDE.md). If the
  // cursor fetch were broken, this would either fall back to page 1 (page-2
  // text never appears) or throw (caught below via pageerror).
  await page.getByRole("button", { name: /next/i }).click();
  await expect(page.getByText(PAGE_2_INVOICE_ID)).toBeVisible();
  expect(page.url()).toContain("cursor=");
  expect(page.url()).not.toContain("_size");
  expect(page.url()).not.toMatch(/cursor=https?%3A/);

  // Browser back → first page (no cursor, page-1 row visible again).
  await page.goBack();
  await expect(page.getByText(PAGE_1_INVOICE_ID)).toBeVisible();
  expect(page.url()).not.toContain("cursor=");

  // Browser forward → second page (cursor restored, page-2 row visible again).
  await page.goForward();
  await expect(page.getByText(PAGE_2_INVOICE_ID)).toBeVisible();
  expect(page.url()).toContain("cursor=");

  expect(errors).toEqual([]);
});
