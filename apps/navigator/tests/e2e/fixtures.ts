import { test as baseTest } from "@playwright/test";
import type { TestInfo } from "@playwright/test";
import { LoginPage } from "./LoginPage";

export const test = baseTest.extend<{
  loginPage: LoginPage;
  login: () => Promise<void>;
  selectSidebarEntity: (entityName: string) => Promise<void>;
  goToClassifyCreateInstancePage: () => Promise<void>;
  goToOverviewPage: () => Promise<void>;
  isSmallViewport: boolean;
}>({
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  isSmallViewport: async (_, use, testInfo: TestInfo) => {
    const viewport = testInfo.project.use.viewport;
    const isSmall = viewport?.width !== undefined && viewport.width <= 800;
    await use(isSmall);
  },

  login: async ({ page, loginPage }, use) => {
    await use(async () => {
      const requiredEnvVars = ["NAVIGATOR_URL", "NAVIGATOR_USERNAME", "NAVIGATOR_PASSWORD"];
      const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
      if (missingVars.length > 0) {
        throw new Error(
          `Missing required environment variables (set in .env.test): ${missingVars.join(", ")}`,
        );
      }
      await page.goto(process.env.NAVIGATOR_URL!);
      await loginPage.login(process.env.NAVIGATOR_USERNAME!, process.env.NAVIGATOR_PASSWORD!);
    });
  },

  selectSidebarEntity: async ({ page }, use) => {
    await use(async (entityName: string) => {
      // The shadcn Sidebar trigger has sr-only text "Toggle Sidebar"
      const toggleBtn = page.getByRole("button", { name: "Toggle Sidebar" });
      const link = page.getByRole("link", { name: entityName });
      await toggleBtn.or(link).first().waitFor();
      // Expand if the sidebar is currently collapsed
      const collapsedSidebar = page.locator('[data-slot="sidebar"][data-state="collapsed"]');
      if (await collapsedSidebar.isVisible()) {
        await toggleBtn.click();
      }
      await link.click();
    });
  },

  goToClassifyCreateInstancePage: async ({ page }, use) => {
    await use(async () => {
      const toggleBtn = page.getByRole("button", { name: "Toggle Sidebar" });
      const createLink = page.getByRole("link", { name: "Create", exact: true });
      await toggleBtn.or(createLink).first().waitFor();
      const collapsedSidebar = page.locator('[data-slot="sidebar"][data-state="collapsed"]');
      if (await collapsedSidebar.isVisible()) {
        await toggleBtn.click();
      }
      await createLink.click();
    });
  },

  goToOverviewPage: async ({ page }, use) => {
    await use(async () => {
      const toggleBtn = page.getByRole("button", { name: "Toggle Sidebar" });
      const overviewLink = page.getByRole("link", { name: "Overview" });
      await toggleBtn.or(overviewLink).first().waitFor();
      const collapsedSidebar = page.locator('[data-slot="sidebar"][data-state="collapsed"]');
      if (await collapsedSidebar.isVisible()) {
        await toggleBtn.click();
      }
      await overviewLink.click();
    });
  },
});

export { expect } from "@playwright/test";
