import { ESLintUtils, type TSESTree } from "@typescript-eslint/utils";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

/**
 * L5 (specs/005-views-layer/contracts/layer-lint-rules.md): a stable view never imports an
 * experimental view. Generalised to the full ladder — a view may only import views that are
 * at least as stable as itself (experimental < candidate < stable).
 *
 * The importing file's view and the imported view are each identified by the nearest
 * `package.json` with an `x-stability` field, walking up from the file (or the resolved
 * relative import) and stopping at the package root (the first `package.json` with a `name`).
 *
 * An imported directory with no tag (support folders such as `breadcrumbs/`) is not a view and
 * is ignored. An importing file with no tag is treated as `stable`, the strictest level: the root
 * barrel `src/index.ts` and untagged support folders must not re-export or import a less stable
 * view unchecked. This rule is only enabled inside `packages/views`, so "untagged importer"
 * always means "untagged code in the views package".
 */

type StabilityLevel = "experimental" | "candidate" | "stable";

const RANK: Record<StabilityLevel, number> = { experimental: 0, candidate: 1, stable: 2 };

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://contentgrid.com/eslint-rules/${name}`,
);

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Not cached: a lint run reads a handful of tiny package.json files per file, and a cache keyed on
// the directory would serve stale tags in editors after a tag is edited.
function stabilityOfDir(startDir: string): StabilityLevel | null {
  let result: StabilityLevel | null = null;
  let dir = startDir;
  for (let i = 0; i < 20; i++) {
    const pkg = readJson(join(dir, "package.json"));
    if (pkg) {
      const tag = pkg["x-stability"];
      if (typeof tag === "string" && tag in RANK) {
        result = tag as StabilityLevel;
        break;
      }
      if (typeof pkg["name"] === "string") break; // package root reached
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return result;
}

function directoryOf(target: string): string {
  try {
    if (statSync(target).isDirectory()) return target;
  } catch {
    // not an existing path as written (extension-less file import) — fall through
  }
  return existsSync(dirname(target)) ? dirname(target) : target;
}

export const rule = createRule<[], "lessStableView">({
  name: "view-stability-order",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow a view from importing a view that is less stable than itself",
    },
    schema: [],
    messages: {
      lessStableView:
        "A '{{importer}}' view must not import the '{{imported}}' view '{{source}}'. Make the import at least as stable, or move this code into an experimental copy of the view.",
    },
  },
  defaultOptions: [],
  create(context) {
    const importerDir = dirname(context.filename);
    const importer: StabilityLevel = stabilityOfDir(importerDir) ?? "stable";

    const check = (
      node:
        | TSESTree.ImportDeclaration
        | TSESTree.ExportNamedDeclaration
        | TSESTree.ExportAllDeclaration
        | TSESTree.ImportExpression,
      source: unknown,
    ) => {
      if (typeof source !== "string") return;
      if (!source.startsWith(".") && !isAbsolute(source)) return;
      const imported = stabilityOfDir(directoryOf(resolve(importerDir, source)));
      if (!imported || RANK[imported] >= RANK[importer]) return;
      context.report({
        node,
        messageId: "lessStableView",
        data: { importer, imported, source },
      });
    };

    return {
      ImportDeclaration(node) {
        check(node, node.source.value);
      },
      ExportNamedDeclaration(node) {
        check(node, node.source?.value);
      },
      ExportAllDeclaration(node) {
        check(node, node.source.value);
      },
      ImportExpression(node) {
        check(node, node.source.type === "Literal" ? node.source.value : undefined);
      },
    };
  },
});
