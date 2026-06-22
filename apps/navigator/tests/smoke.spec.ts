/**
 * Boot smoke test — ACC-2878 / HZN-4.7
 *
 * Verifies the app boots importing its data layer from
 * `@contentgrid/navigator-data` (workspace package), authenticates via
 * dev-token mode (HZN-4.3), and renders an entity overview against the stubbed
 * HAL endpoint (MSW), with no console errors. The stub rejects requests
 * without a Bearer token, so a passing run proves the auth-wired apiFetch
 * path end to end.
 *
 * The root route renders EntityOverviewPage — a grid of EntityCards, one per
 * entity type. Each card shows the entity's plural name and the total item
 * count fetched from the collection endpoint. Individual item rows (inv-001
 * etc.) are only shown in the entity detail view, not the overview.
 */
import { expect, test } from "@playwright/test";

test("boots and renders an entity overview from the stubbed HAL endpoint", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));

  await page.goto("/");

  // Entity discovered at runtime from the profile root's cg:entity links.
  // "Invoice" is the plural name of the entity (falls back to the cg:entity
  // link title when the profile's describes.collection link has no title).
  await expect(page.getByText("Invoice").first()).toBeVisible();

  // Overview header shows the count of entity types discovered from the profile.
  await expect(page.getByText("1 entity type available")).toBeVisible();

  // EntityCard shows the collection item count fetched from the stub /invoices
  // endpoint. The number and label are separate DOM elements.
  await expect(page.getByText("3")).toBeVisible();
  await expect(page.getByText("items")).toBeVisible();

  expect(errors).toEqual([]);
});
