/**
 * Verifies that the s.cursor param is validated by TanStack Router and that
 * browser back/forward navigation correctly restores prior search state.
 *
 * The entity list lives at /$entity (e.g. /invoices). `_app` is a *pathless*
 * layout route, so it never appears in the URL — navigating to `/_app/invoices`
 * would match the item-detail route ($entity/$itemId), not the list. The list
 * view is the only screen that renders a data table (role="table"); the
 * item-detail view renders a description list, so asserting on the table pins
 * this test to the entity list rather than passing on the wrong screen.
 */
import { expect, test } from "@playwright/test";

test("s.cursor param is preserved and validated through browser back/forward", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));

  // Navigate to the entity list (no cursor — first page)
  await page.goto("/invoices");
  await expect(page.getByRole("table")).toBeVisible();
  expect(page.url()).not.toContain("s.cursor");

  // Simulate arriving at a second page by navigating with a cursor value.
  // The cursor value is the opaque HAL next-page URL stored under s.cursor.
  // It is built from the app's own origin so it survives the data layer's
  // same-origin cursor guard.
  const fakeCursorUrl = encodeURIComponent(`${page.url()}?cursor=page2`);
  await page.goto(`/invoices?s.cursor=${fakeCursorUrl}`);
  await expect(page.getByRole("table")).toBeVisible();
  expect(page.url()).toContain("s.cursor");

  // Browser back → first page (no cursor)
  await page.goBack();
  await expect(page.getByRole("table")).toBeVisible();
  expect(page.url()).not.toContain("s.cursor");

  // Browser forward → second page (cursor restored)
  await page.goForward();
  await expect(page.getByRole("table")).toBeVisible();
  expect(page.url()).toContain("s.cursor");

  expect(errors).toEqual([]);
});
