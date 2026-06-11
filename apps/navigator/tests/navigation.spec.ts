/**
 * Navigation integration test — ACC-2976 / HZN-5.0 Slice 4
 *
 * MSW-backed end-to-end navigation test.  The dev server at http://localhost:5173
 * serves the app in mock mode (MSW worker intercepts all API calls via
 * demo-handlers.ts), so this exercises the full stack:
 *   router → hooks → views → back navigation
 *
 * Flow:
 *   1. Root (/)         — app shell + Invoice nav item render
 *   2. Collection (/invoice) — collection table with known rows renders
 *   3. Item detail      — click INV-2026-04812 row → item detail renders
 *   4. Back             — browser back → collection list shows again
 *
 * All assertions are text/role-based; no pixel snapshots.
 * Zero console errors expected throughout (same policy as smoke.spec.ts).
 */
import { expect, test } from "@playwright/test";

test("navigates root → collection → item → back with zero console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));

  // ── Step 1: Root (/). App shell + entity nav items render.
  await page.goto("/");

  // Sidebar shows discovered entity nav items from the profile root.
  // Scope to the sidebar <nav> — the Home entity cards expose the same titles
  // as links in <main>, so an unscoped query would be ambiguous.
  const sidebar = page.getByRole("navigation");
  await expect(sidebar.getByRole("link", { name: "Invoice" })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Supplier" })).toBeVisible();

  // ── Step 2: Navigate to the Invoice collection (via the sidebar nav item).
  await sidebar.getByRole("link", { name: "Invoice" }).click();

  // Collection table renders with real data from the stubbed /invoices endpoint.
  // The CollectionListView renders an h1 with the entity title.
  await expect(page.getByRole("heading", { name: "Invoice", level: 1 })).toBeVisible();

  // Known column header from the invoice schema
  await expect(page.getByText("Reference")).toBeVisible();

  // Known row from the demo fixture
  await expect(page.getByText("INV-2026-04812")).toBeVisible();

  // All 3 items present
  await expect(page.getByText("INV-2026-04811")).toBeVisible();
  await expect(page.getByText("INV-2026-04790")).toBeVisible();

  // ── Step 3: Navigate into the first invoice item.
  // Click the row for INV-2026-04812 (first cell in the row)
  await page.getByRole("cell", { name: "INV-2026-04812" }).click();

  // Item detail view renders — breadcrumb shows the item's display name
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }).getByText("INV-2026-04812"),
  ).toBeVisible();

  // Relation section for the supplier is rendered (relation card title)
  await expect(page.getByText("Supplier", { exact: true }).first()).toBeVisible();

  // ── Step 4: Navigate back to the collection.
  await page.goBack();

  // Collection list is shown again — rows are visible again
  await expect(page.getByRole("cell", { name: "INV-2026-04812" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "INV-2026-04811" })).toBeVisible();

  // ── Zero errors throughout
  expect(errors).toEqual([]);
});
