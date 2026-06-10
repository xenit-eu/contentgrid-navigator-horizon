/**
 * Boot smoke test — ACC-2878 / HZN-4.7
 *
 * Verifies the app boots importing its data layer from
 * `@contentgrid/navigator-data` (workspace package) and renders an entity
 * list against the stubbed HAL endpoint (MSW), with no console errors.
 */
import { expect, test } from "@playwright/test";

test("boots and renders an entity list from the stubbed HAL endpoint", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));

  await page.goto("/");

  // Entity discovered at runtime from the profile root's cg:entity links
  await expect(page.getByText("Invoice", { exact: true })).toBeVisible();

  // Collection items rendered from the stubbed /invoices HAL collection
  await expect(page.getByText("3 item(s)")).toBeVisible();
  await expect(page.getByText("inv-001")).toBeVisible();
  await expect(page.getByText("inv-003")).toBeVisible();

  expect(errors).toEqual([]);
});
