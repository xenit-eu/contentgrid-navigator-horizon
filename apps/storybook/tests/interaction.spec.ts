/**
 * Storybook play() function integration tests.
 *
 * Approach: Playwright navigates to each `WithInteraction` story's iframe URL
 * and listens for Storybook's internal `STORY_RENDER_PHASE_CHANGED` channel
 * event to confirm the play() function completed without errors.
 *
 * Deterministic result detection (no optimistic passes):
 *   - The channel listener is installed via `page.addInitScript` BEFORE
 *     navigation, so no "played"/"errored" phase event can be missed even for
 *     fast stories whose play() finishes before the test code runs.
 *   - A render/play error in Storybook 9 adds the `sb-show-errordisplay` class
 *     to the iframe <body> and shows an error overlay (`.sb-errordisplay`).
 *     We treat that as an authoritative "errored" signal too.
 *   - On timeout we FAIL the test (never optimistically pass).
 *
 * Why not @storybook/test-runner (deviation note):
 *   @storybook/test-runner 0.23.0 (the only stable release supporting Storybook 9)
 *   bundles @swc/core which requires a postinstall lifecycle script. The project's
 *   supply-chain policy (onlyBuiltDependencies: [], approve-builds=false in .npmrc)
 *   blocks all lifecycle scripts, making @swc/core uninstallable without policy
 *   changes. To stay within policy we use @playwright/test (already installed for
 *   visual regression) to drive the same iframe approach — play() functions are
 *   bundled into the built Storybook and executed by the browser automatically.
 */
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
  tags?: string[];
}

interface StorybookIndex {
  entries: Record<string, StoryEntry>;
}

function loadInteractionStories(): StoryEntry[] {
  let raw: string;
  try {
    raw = readFileSync(indexPath, "utf8");
  } catch {
    throw new Error(
      `Storybook index not found at ${indexPath}. ` +
        "Run `pnpm test:storybook` (which builds Storybook first) rather than invoking playwright directly.",
    );
  }
  const index = JSON.parse(raw) as StorybookIndex;
  return Object.values(index.entries).filter(
    (entry) => entry.type === "story" && entry.name === "With Interaction",
  );
}

const stories = loadInteractionStories();

const PLAY_TIMEOUT_MS = 15_000;

type Phase = "played" | "errored";

/**
 * Install — before any page navigation — a hook that captures the FIRST
 * terminal play() phase ("played" or "errored") Storybook emits for any story.
 *
 * Storybook exposes its addons channel on `window.__STORYBOOK_ADDONS_CHANNEL__`
 * once the preview boots. Because `addInitScript` runs on every new document
 * before its scripts execute, we poll briefly for the channel to appear and
 * attach our listener the moment it does — guaranteeing we never miss the
 * phase event, even for stories whose play() resolves immediately.
 *
 * The captured phase is stashed on `window.__PLAY_PHASE__` for the test to read.
 */
async function installPhaseCapture(page: import("@playwright/test").Page): Promise<void> {
  await page.addInitScript(() => {
    const PHASE_CHANGED = "storyRenderPhaseChanged";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    w.__PLAY_PHASE__ = undefined;

    const attach = () => {
      const channel = w.__STORYBOOK_ADDONS_CHANNEL__;
      if (!channel) return false;
      channel.on(PHASE_CHANGED, (data: { storyId: string; newPhase: string }) => {
        if (
          w.__PLAY_PHASE__ === undefined &&
          (data.newPhase === "played" || data.newPhase === "errored")
        ) {
          w.__PLAY_PHASE__ = data.newPhase;
        }
      });
      return true;
    };

    if (!attach()) {
      const poll = setInterval(() => {
        if (attach()) clearInterval(poll);
      }, 20);
      // Stop polling well before the test-side timeout so we don't leak intervals.
      setTimeout(() => clearInterval(poll), 14_000);
    }
  });
}

/**
 * Resolve the play() result deterministically. Returns as soon as EITHER:
 *   - the channel reported a terminal phase ("played" | "errored"), OR
 *   - the iframe body shows Storybook's error overlay (`sb-show-errordisplay`).
 * Throws (fails the test) on timeout — never optimistically passes.
 */
async function waitForPlayResult(page: import("@playwright/test").Page): Promise<Phase> {
  const handle = await page.waitForFunction(
    () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const phase = (window as any).__PLAY_PHASE__ as "played" | "errored" | undefined;
      if (phase) return phase;
      if (document.body.classList.contains("sb-show-errordisplay")) return "errored";
      return null;
    },
    undefined,
    { timeout: PLAY_TIMEOUT_MS, polling: 100 },
  );
  return (await handle.jsonValue()) as Phase;
}

test.describe("Storybook play() interaction tests", () => {
  if (stories.length === 0) {
    test.skip("no WithInteraction stories found", () => {});
  }

  for (const story of stories) {
    test(`${story.title} / ${story.name} (${story.id})`, async ({ page }) => {
      // Collect console errors BEFORE navigation so they're available for the
      // failure message (attaching after the await would always miss them).
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(String(err)));

      // Install the phase-capture hook before navigating so no event is missed.
      await installPhaseCapture(page);

      await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);
      await page.waitForSelector("#storybook-root", { state: "attached", timeout: 15_000 });

      let phase: Phase;
      try {
        phase = await waitForPlayResult(page);
      } catch {
        // Timed out waiting for a terminal phase — fail loudly, never pass.
        throw new Error(
          `play() function for "${story.title} / ${story.name}" did not reach a ` +
            `terminal phase within ${PLAY_TIMEOUT_MS} ms (no "played"/"errored" event ` +
            `and no error overlay).\nConsole errors:\n${errors.join("\n") || "(none)"}`,
        );
      }

      expect(
        phase,
        `play() function for "${story.title} / ${story.name}" errored.\n` +
          `Console errors:\n${errors.join("\n") || "(none)"}`,
      ).toBe("played");

      // Belt-and-braces: the error overlay must not be showing.
      const hasErrorDisplay = await page.evaluate(() =>
        document.body.classList.contains("sb-show-errordisplay"),
      );
      expect(
        hasErrorDisplay,
        `Storybook error overlay (sb-show-errordisplay) is visible for ` +
          `"${story.title} / ${story.name}".\nConsole errors:\n${errors.join("\n") || "(none)"}`,
      ).toBe(false);
    });
  }
});
