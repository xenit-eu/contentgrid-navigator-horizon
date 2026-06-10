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

  // HomeView entity-grid: each entity type renders as an EntityCard.
  // Use exact title match to distinguish the card title button from the
  // "Create Invoice" / "Create Supplier" ghost icon button.
  await expect(page.getByRole("button", { name: "Invoice", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Supplier", exact: true })).toBeVisible();

  // Item counts fetched from the stubbed collections (size=1 query):
  // Invoice fixture has 3 items (total_items_exact=3).
  await expect(page.getByText("3")).toBeVisible();

  expect(errors).toEqual([]);
});
