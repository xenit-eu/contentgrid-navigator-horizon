import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// FR-028 / T056: every view `exports` entry resolves to a directory that carries a valid
// `x-stability` tag, so `@contentgrid/no-unstable-views` can resolve it per view.

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

describe("root barrel", () => {
  // The root barrel carries no tag (it is not a view), and `view-stability-order` treats untagged
  // code as stable. It must therefore export navigation infrastructure only, never a view.
  it("re-exports navigation infrastructure only, never a view", () => {
    const source = readFileSync(join(pkgDir, "src", "index.ts"), "utf-8");
    const specifiers = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(specifiers.length).toBeGreaterThan(0);

    const viewDirs = Object.entries(pkg.exports)
      .filter(([subpath]) => subpath !== ".")
      .map(([, target]) => dirname(join(pkgDir, target.import)))
      .filter((dir) => dir !== join(pkgDir, "src", "navigation"));

    for (const specifier of specifiers) {
      const resolved = join(pkgDir, "src", specifier);
      for (const viewDir of viewDirs) {
        expect(
          resolved === viewDir || resolved.startsWith(`${viewDir}/`),
          `src/index.ts re-exports the view at ${relative(pkgDir, viewDir)}`,
        ).toBe(false);
      }
    }
  });
});
