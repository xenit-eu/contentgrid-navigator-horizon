/**
 * Verifies that clicking Next/Previous actually drives real pagination
 * against the stubbed HAL endpoint. Pagination position is deliberately kept
 * out of the URL — an opaque cursor only ever resolves back to a real page
 * in the session that received it from the server, so there's nothing to
 * gain from sharing it. It's instead remembered per entity in the
 * `QueryClient` cache (`rememberCollectionPageHref` / `recallCollectionPageHref`
 * in `packages/navigator-data/src/search/pagination-links.ts`), read back via
 * a `useState` lazy initializer in `EntityItemCollectionRoute`
 * (`apps/navigator/src/routes/_app/$entity/index.tsx`) purely so it survives
 * an unmount/remount within this session — this test only covers the fetch
 * behavior, not any URL round-trip.
 *
 * The entity list lives at /$entity (e.g. /invoice). `_app` is a *pathless*
 * layout route, so it never appears in the URL — navigating to `/_app/invoice`
 * would match the item-detail route ($entity/$itemId), not the list.
 *
 * This test does not rely on `getByRole("table")` alone: with
 * `placeholderData: keepPreviousData`, the page-1 table stays visible while a
 * broken fetch fails or falls back silently, which would let a stale table
 * mask real breakage. Instead it asserts on row text that is unique to each
 * page (see `createDemoHandlers` / `PAGE_2_INVOICE_ID` in
 * `packages/navigator-data/test-fixtures/msw/demo-handlers.ts`), which can
 * only be visible if the fetch actually reached that page.
 */
import { expect, test } from "@playwright/test";

const PAGE_1_INVOICE_ID = "inv-001";
const PAGE_2_INVOICE_ID = "INVOICE-PAGE2";

test("Next/Previous drive real pagination against the stubbed endpoint", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));

  // Navigate to the entity list (first page).
  await page.goto("/invoice");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByText(PAGE_1_INVOICE_ID)).toBeVisible();
  // Click Next — issues a real fetch to the HAL next link. If it were broken,
  // this would either fall back to page 1 (page-2 text never appears) or
  // throw (caught below via pageerror).
  await page.getByRole("button", { name: /next/i }).click();
  await expect(page.getByText(PAGE_2_INVOICE_ID)).toBeVisible();
  // Pagination position never touches the URL.
  expect(page.url()).not.toContain("cursor");

  // Click Previous — issues a real fetch back to the HAL prev link.
  await page.getByRole("button", { name: /previous/i }).click();
  await expect(page.getByText(PAGE_1_INVOICE_ID)).toBeVisible();

  expect(errors).toEqual([]);
});
