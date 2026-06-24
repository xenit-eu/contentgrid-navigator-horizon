import { test as baseTest } from "@playwright/test";
import type { Locator, Page, TestInfo } from "@playwright/test";
import { LoginPage } from "./LoginPage";

async function expandSidebarAndClick(page: Page, link: Locator): Promise<void> {
  const toggleBtn = page.getByRole("button", { name: "Toggle Sidebar" });
  await toggleBtn.or(link).first().waitFor();
  if (await page.locator('[data-slot="sidebar"][data-state="collapsed"]').isVisible()) {
    await toggleBtn.click();
  }
  await link.click();
}

export const test = baseTest.extend<{
  loginPage: LoginPage;
  login: () => Promise<void>;
  selectSidebarEntity: (entityName: string) => Promise<void>;
  goToClassifyCreateInstancePage: () => Promise<void>;
  goToOverviewPage: () => Promise<void>;
  isSmallViewport: boolean;
}>({
  loginPage: ({ page }, provide) => provide(new LoginPage(page)),

  isSmallViewport: async ({}, provide, testInfo: TestInfo) => {
    const viewport = testInfo.project.use.viewport;
    const isSmall = viewport?.width !== undefined && viewport.width <= 800;
    await provide(isSmall);
  },

  login: ({ page, loginPage }, provide) =>
    provide(async () => {
      const requiredEnvVars = ["NAVIGATOR_URL", "NAVIGATOR_USERNAME", "NAVIGATOR_PASSWORD"];
      const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
      if (missingVars.length > 0) {
        throw new Error(
          `Missing required environment variables (set in .env.test): ${missingVars.join(", ")}`,
        );
      }
      await page.goto(process.env.NAVIGATOR_URL!);
      await loginPage.login(process.env.NAVIGATOR_USERNAME!, process.env.NAVIGATOR_PASSWORD!);
    }),

  selectSidebarEntity: ({ page }, provide) =>
    provide(async (entityName: string) => {
      await expandSidebarAndClick(page, page.getByRole("link", { name: entityName }));
    }),

  goToClassifyCreateInstancePage: ({ page }, provide) =>
    provide(async () => {
      await expandSidebarAndClick(page, page.getByRole("link", { name: "Create", exact: true }));
    }),

  goToOverviewPage: ({ page }, provide) =>
    provide(async () => {
      await expandSidebarAndClick(page, page.getByRole("link", { name: "Overview" }));
    }),
});

export { expect } from "@playwright/test";
