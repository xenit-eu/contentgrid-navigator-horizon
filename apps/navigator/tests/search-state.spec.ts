/**
 * Verifies that the cursor param is validated by TanStack Router, that
 * clicking Next/Previous actually drives cursor-based pagination against the
 * stubbed HAL endpoint, and that browser back/forward correctly restores
 * prior search state.
 *
 * The URL's `cursor` value is always an opaque token (e.g. "page2"), never a
 * URL — the literal next/prev href it came from is remembered in an
 * in-memory registry (`packages/navigator-data/src/search/cursor-registry.ts`)
 * at the moment it's extracted, and resolved back through that registry when
 * the token reappears. Nothing in the data layer ever constructs a URL from
 * the token.
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
  expect(page.url()).not.toContain("cursor");

  // Click Next — this issues a real fetch to the HAL next link, extracts the
  // opaque `_cursor` token ("page2") from it, remembers the literal href in
  // the in-memory cursor registry under that token, and writes only the
  // token to `cursor` — never a URL. If the cursor fetch were broken, this
  // would either fall back to page 1 (page-2 text never appears) or throw
  // (caught below via pageerror).
  await page.getByRole("button", { name: /next/i }).click();
  await expect(page.getByText(PAGE_2_INVOICE_ID)).toBeVisible();
  expect(new URL(page.url()).searchParams.get("cursor")).toBe("page2");

  // Browser back → first page (no cursor, page-1 row visible again).
  await page.goBack();
  await expect(page.getByText(PAGE_1_INVOICE_ID)).toBeVisible();
  expect(new URL(page.url()).searchParams.has("cursor")).toBe(false);

  // Browser forward → second page. The cursor registry survives this
  // same-session history navigation (it lives in the QueryClient, not the
  // URL), so the token resolves back to the same href and page 2 reappears.
  await page.goForward();
  await expect(page.getByText(PAGE_2_INVOICE_ID)).toBeVisible();
  expect(new URL(page.url()).searchParams.get("cursor")).toBe("page2");

  expect(errors).toEqual([]);
});
