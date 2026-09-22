import { expect, test } from "@playwright/test";
import { loadStories } from "./story-index";

const stories = loadStories((entry) => !entry.tags?.includes("no-visual-test"), "test:visual");

test.describe("Storybook visual regression", () => {
  if (stories.length === 0) {
    // No stories exist yet (they land in a separate ticket). Keep the suite green.
    test.skip("no stories found — nothing to snapshot", () => {});
  }

  for (const story of stories) {
    test(story.id, async ({ page }) => {
      // Freeze the clock so date-dependent stories (e.g. Calendar, which renders the
      // current month / today) are deterministic across CI runs. setFixedTime pins
      // Date without pausing timers, so document.fonts.ready still resolves.
      await page.clock.setFixedTime(new Date("2025-01-15T12:00:00Z"));
      await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);
      await page.waitForSelector("#storybook-root", { state: "attached" });
      // Wait for web fonts so text-rendering diffs don't flake (ADR-009).
      await page.evaluate(() => document.fonts.ready);
      // A story tagged `async-content` loads real async content (e.g.
      // PdfViewer opening a document through the PDFium/WASM engine) and
      // marks itself busy via `aria-busy="true"` for as long as any part of
      // it is still loading — this waits until nothing is busy before
      // screenshotting (ADR-009). Opt-in, not generic: a story with a
      // permanently-busy loading state (e.g. the app-info-pages loading
      // page) would otherwise time out here on every run.
      if (story.tags?.includes("async-content")) {
        // `#storybook-root` attaches before the story's own React tree
        // commits — without this, the "nothing is busy" check below can
        // pass vacuously on an empty root and race the story's own loading
        // states.
        await page.waitForSelector("#storybook-root > *", {
          state: "attached",
          timeout: 30_000,
        });
        await page.waitForFunction(
          () => document.querySelector('[aria-busy="true"]') === null,
          undefined,
          { timeout: 30_000 },
        );
      }
      // Defensively kill animations/transitions in case a story enables them.
      await page.addStyleTag({
        content:
          "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;}",
      });
      await expect(page).toHaveScreenshot(`${story.id}.png`, { fullPage: true });
    });
  }
});
