/**
 * Boot smoke test — ACC-2976 / HZN-5.0
 *
 * Verifies the app boots, authenticates via dev-token mode (HZN-4.3),
 * discovers entities from the stubbed HAL endpoint (MSW), and renders the
 * HomeView entity-grid with correct entity cards and item counts.
 * Zero console errors expected.
 *
 * Navigation to a collection (item rendering) is covered by navigation.spec.ts.
 */
import { expect, test } from "@playwright/test";

test("boots and renders the home entity-grid from the stubbed HAL endpoint", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));

  await page.goto("/");

  // Entity discovered at runtime from the profile root's cg:entity links.
  // Scope to the AppShell sidebar (a <nav>) so the assertion is specific.
  await expect(page.getByRole("navigation").getByRole("link", { name: "Invoice" })).toBeVisible();

  // HomeView entity-grid: each entity type renders a compact card whose title
  // is a Link to the collection. Scope to <main> so these don't collide with
  // the identically-named sidebar nav links.
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: "Invoice", exact: true })).toBeVisible();
  await expect(main.getByRole("link", { name: "Supplier", exact: true })).toBeVisible();

  // Item counts fetched from the stubbed collections (size=1 query):
  // Invoice fixture has 3 items (total_items_exact=3) → "3 items".
  await expect(main.getByText("3 items")).toBeVisible();

  expect(errors).toEqual([]);
});
