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
 * count fetched from the collection endpoint. Individual item rows are only shown in the entity detail view, not the overview.
 */
import { expect, test } from "@playwright/test";

test("boots and renders an entity overview from the stubbed HAL endpoint", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));

  await page.goto("/");

  // Entities discovered at runtime from the profile root's cg:entity links (the recorded model).
  await expect(page.getByRole("heading", { name: "Customers", level: 2 })).toBeVisible();

  // Overview header shows the count of entity types discovered from the profile.
  await expect(page.getByText("11 entity types available")).toBeVisible();

  // EntityCard shows the collection's total item count from the recorded customers page.
  await expect(page.getByRole("button", { name: /^Customers .*97 items$/ })).toBeVisible();

  expect(errors).toEqual([]);
});
