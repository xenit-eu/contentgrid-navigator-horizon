import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const indexPath = resolve(here, "../storybook-static/index.json");

interface StoryEntry {
  id: string;
  type: string;
  name: string;
  title: string;
}

interface StorybookIndex {
  entries: Record<string, StoryEntry>;
}

function loadStories(): StoryEntry[] {
  let raw: string;
  try {
    raw = readFileSync(indexPath, "utf8");
  } catch {
    throw new Error(
      `Storybook index not found at ${indexPath}. ` +
        "Run `pnpm test:visual` (which builds Storybook first) rather than `playwright test` directly.",
    );
  }
  const index = JSON.parse(raw) as StorybookIndex;
  return Object.values(index.entries).filter((entry) => entry.type === "story");
}

const stories = loadStories();

test.describe("Storybook visual regression", () => {
  if (stories.length === 0) {
    // No stories exist yet (they land in a separate ticket). Keep the suite green.
    test.skip("no stories found — nothing to snapshot", () => {});
  }

  for (const story of stories) {
    test(story.id, async ({ page }) => {
      await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);
      await page.waitForSelector("#storybook-root", { state: "attached" });
      // Wait for web fonts so text-rendering diffs don't flake (ADR-009).
      await page.evaluate(() => document.fonts.ready);
      // Defensively kill animations/transitions in case a story enables them.
      await page.addStyleTag({
        content:
          "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;}",
      });
      await expect(page).toHaveScreenshot(`${story.id}.png`, { fullPage: true });
    });
  }
});
