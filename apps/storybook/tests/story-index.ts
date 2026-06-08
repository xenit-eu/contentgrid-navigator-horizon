import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Shared loader for the pre-built Storybook index (`storybook-static/index.json`),
 * used by the visual, interaction, and accessibility specs. Each spec passes its
 * own filter predicate and a `runHint` so the "build Storybook first" error names
 * the right `pnpm test:*` command.
 */

const here = dirname(fileURLToPath(import.meta.url));
const indexPath = resolve(here, "../storybook-static/index.json");

export interface StoryEntry {
  id: string;
  type: string;
  name: string;
  title: string;
  tags?: string[];
}

interface StorybookIndex {
  entries: Record<string, StoryEntry>;
}

/**
 * Load and filter story entries from the built Storybook index.
 *
 * @param filter   Predicate applied on top of the `type === "story"` base filter.
 *                 Defaults to including every story.
 * @param runHint  The `pnpm` script to recommend in the not-found error (e.g.
 *                 "test:visual"), so each spec keeps its own guidance.
 */
export function loadStories(
  filter: (entry: StoryEntry) => boolean = () => true,
  runHint = "test:visual",
): StoryEntry[] {
  let raw: string;
  try {
    raw = readFileSync(indexPath, "utf8");
  } catch {
    throw new Error(
      `Storybook index not found at ${indexPath}. ` +
        `Run \`pnpm ${runHint}\` (which builds Storybook first) rather than invoking playwright directly.`,
    );
  }
  const index = JSON.parse(raw) as StorybookIndex;
  return Object.values(index.entries).filter((entry) => entry.type === "story" && filter(entry));
}
