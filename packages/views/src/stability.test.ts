import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// FR-028 / T056: every view `exports` entry resolves to a directory that carries a valid
// `x-stability` tag, so `@contentgrid/no-unstable-features` can resolve it per view.

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf-8")) as {
  exports: Record<string, { import: string }>;
};
const LEVELS = ["experimental", "candidate", "stable"];

function tagFor(entryFile: string): unknown {
  let dir = dirname(join(pkgDir, entryFile));
  while (dir.startsWith(join(pkgDir, "src")) && dir !== join(pkgDir, "src")) {
    try {
      const nested = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8")) as Record<
        string,
        unknown
      >;
      if ("x-stability" in nested) return nested["x-stability"];
    } catch {
      // no package.json here — keep walking up (but never up to src/ itself)
    }
    dir = dirname(dir);
  }
  return undefined;
}

describe("view stability tags", () => {
  const entries = Object.entries(pkg.exports).filter(([subpath]) => subpath !== ".");

  it("has view entries to check", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries)("%s declares a valid x-stability", (subpath, target) => {
    const tag = tagFor(relative(pkgDir, join(pkgDir, target.import)));
    expect(LEVELS, `${subpath} has x-stability ${String(tag)}`).toContain(tag);
  });
});
