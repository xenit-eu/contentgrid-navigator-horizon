/**
 * E2E: the knowledge-graph view (spec `007-entity-knowledge-graph`, quickstart scenarios 1, 2, 4,
 * 6, 8, 9, 10, 11, 14).
 *
 * Like `content-focus.spec.ts`, this runs against a dev server in MSW mock mode (the relation demo
 * model from `@contentgrid/navigator-data/test-fixtures/msw/relation-demo-handlers`, registered
 * by `src/mocks/browser.ts`) rather than a real backend, so it needs no login or `.env.test`.
 * It is skipped unless `NAVIGATOR_MOCK_URL` points at such a server:
 *
 *   VITE_USE_MOCK_API=true VITE_DEV_TOKEN=dev-token VITE_API_BASE_URL=http://localhost:5199 \
 *     pnpm --filter navigator exec vite --port 5199
 *   NAVIGATOR_MOCK_URL=http://localhost:5199 pnpm --filter navigator exec playwright \
 *     test entity-graph.spec.ts --project=chromium-large
 *
 * The mock store is in-memory per page load, so every test starts from the seeded demo data.
 */
import { type Page, expect, test } from "@playwright/test";

const MOCK_URL = process.env.NAVIGATOR_MOCK_URL;

// Stable demo ids (RELATION_DEMO_IDS in relation-demo-handlers.ts).
const BIG_CORP = "c0000000-0000-4000-8000-000000000001";
const ORDER_1 = "o0000000-0000-4000-8000-000000000001";

const canvas = (page: Page) => page.getByRole("application", { name: /Relations graph/ });
const node = (page: Page, label: string) =>
  canvas(page).locator(".react-flow__node").filter({ hasText: label });

/** The details panel starts collapsed on mid-size viewports (next to the app sidebar). */
async function openDetailsPanel(page: Page) {
  await expect(canvas(page)).toBeVisible();
  const show = page.getByRole("button", { name: "Show Details" });
  if (await show.isVisible()) await show.click();
}

test.describe("Knowledge graph (mock mode)", () => {
  test.skip(
    !MOCK_URL,
    "Set NAVIGATOR_MOCK_URL to a navigator dev server running in mock mode — see file header.",
  );

  test.use({ baseURL: MOCK_URL });

  test("opens from an item page and draws its named relations with an overflow count", async ({
    page,
  }) => {
    await page.goto(`/customer/${BIG_CORP}`);
    await page.getByRole("button", { name: "View in the grid" }).click();
    await expect(page).toHaveURL(new RegExp(`/customer/${BIG_CORP}/~graph`));

    await expect(node(page, "Big Corp")).toBeVisible();
    await expect(canvas(page).getByRole("button", { name: /^Big Corp — Orders →/ })).toHaveCount(
      10,
    );
    await expect(node(page, "+ ~15 more")).toBeVisible();
  });

  test("selects a node, shows its details and navigates via View", async ({ page }) => {
    await page.goto(`/customer/${BIG_CORP}/~graph`);
    await openDetailsPanel(page);
    await node(page, "ORD-003").click();

    const menu = page.getByRole("menu", { name: "ORD-003" });
    await expect(menu).toBeVisible();
    await expect(page.getByRole("region", { name: "Item details" })).toContainText("ORD-003");

    await menu.getByRole("menuitem", { name: "View" }).click();
    await expect(page).toHaveURL(/\/order\/o0000000-0000-4000-8000-000000000003$/);
  });

  test("explores, keeps the trail, returns via the breadcrumb and survives a reload", async ({
    page,
  }) => {
    await page.goto(`/customer/${BIG_CORP}/~graph`);
    await node(page, "ORD-001").click();
    await page.getByRole("menuitem", { name: "Explore relations" }).click();

    await expect(node(page, "Widget")).toBeVisible();
    await expect(node(page, "Big Corp")).toBeVisible();
    const path = page.getByRole("navigation", { name: "Explored path" });
    await expect(path).toContainText("Big Corp");
    await expect(path).toContainText("ORD-001");

    await page.reload();
    await expect(node(page, "Widget")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Explored path" })).toContainText("ORD-001");

    await page
      .getByRole("navigation", { name: "Explored path" })
      .getByRole("button", { name: "Big Corp" })
      .click();
    await expect(node(page, "+ ~15 more")).toBeVisible();
  });

  test("lists the remaining targets of a large relation and pins one into the graph", async ({
    page,
  }) => {
    await page.goto(`/customer/${BIG_CORP}/~graph`);
    await node(page, "+ ~15 more").click();
    await openDetailsPanel(page);

    const list = page.getByRole("region", { name: "Orders of Big Corp" });
    await expect(list).toContainText("About 25 items (estimated)");
    await list.getByRole("button", { name: "Load more" }).click();
    const row = list.getByRole("listitem").filter({ hasText: "ORD-015" });
    await row.getByRole("button", { name: "Show in graph" }).click();

    await expect(node(page, "ORD-015")).toBeVisible();
    await expect(node(page, "+ ~14 more")).toBeVisible();
  });

  test("removes a to-many link after confirmation", async ({ page }) => {
    await page.goto(`/order/${ORDER_1}/~graph`);
    await canvas(page).getByRole("button", { name: "ORD-001 — Products → Gadget" }).click();
    await page
      .getByRole("menu", { name: "Products" })
      .getByRole("menuitem", { name: "Remove link" })
      .click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Both items are kept");
    await dialog.getByRole("button", { name: "Remove link" }).click();

    await expect(node(page, "Gadget")).toHaveCount(0);
    await expect(page.getByText("Link removed")).toBeVisible();
  });

  test("deletes an item after confirmation", async ({ page }) => {
    await page.goto(`/order/${ORDER_1}/~graph`);
    await node(page, "Sprocket").click();
    await page
      .getByRole("menu", { name: "Sprocket" })
      .getByRole("menuitem", { name: "Delete" })
      .click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("permanently deletes");
    await dialog.getByRole("button", { name: "Delete" }).click();

    await expect(node(page, "Sprocket")).toHaveCount(0);
  });
});
