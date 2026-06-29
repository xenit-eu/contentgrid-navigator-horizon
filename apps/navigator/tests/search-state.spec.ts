/**
 * Verifies that the s.cursor param is validated by TanStack Router and that
 * browser back/forward navigation correctly restores prior search state.
 */
import { expect, test } from "@playwright/test";

test("s.cursor param is preserved and validated through browser back/forward", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));

  // Navigate to the entity list (no cursor — first page)
  await page.goto("/_app/invoices");
  await expect(page.getByText("Invoice")).toBeVisible();
  expect(page.url()).not.toContain("s.cursor");

  // Simulate arriving at a second page by navigating with a cursor value.
  // The cursor value is the opaque HAL next-page URL stored under s.cursor.
  const fakeCursorUrl = encodeURIComponent(`${page.url()}?cursor=page2`);
  await page.goto(`/_app/invoices?s.cursor=${fakeCursorUrl}`);
  await expect(page.getByText("Invoice")).toBeVisible();
  expect(page.url()).toContain("s.cursor");

  // Browser back → first page (no cursor)
  await page.goBack();
  await expect(page.getByText("Invoice")).toBeVisible();
  expect(page.url()).not.toContain("s.cursor");

  // Browser forward → second page (cursor restored)
  await page.goForward();
  await expect(page.getByText("Invoice")).toBeVisible();
  expect(page.url()).toContain("s.cursor");

  expect(errors).toEqual([]);
});
