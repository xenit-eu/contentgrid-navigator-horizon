import { ESLintUtils } from "@typescript-eslint/utils";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

type StabilityLevel = "experimental" | "candidate" | "stable";

type StabilityResult =
  | { kind: "valid"; stability: StabilityLevel }
  | { kind: "invalid"; rawValue: string }
  | null;

interface RuleOptions {
  allowedStability: StabilityLevel[];
}

const VALID_STABILITY_LEVELS = new Set<string>(["experimental", "candidate", "stable"]);

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://contentgrid.com/eslint-rules/${name}`,
);

// Module-level caches — survive across files in a single lint run
const pkgDirCache = new Map<string, string | null>();
const stabilityCache = new Map<string, StabilityResult>();

function findPackageDir(startDir: string, scopedName: string): string | null {
  if (pkgDirCache.has(startDir)) return pkgDirCache.get(startDir)!;

  let dir = startDir;
  for (let i = 0; i < 20; i++) {
    const candidate = join(dir, "node_modules", scopedName);
    if (existsSync(candidate)) {
      pkgDirCache.set(startDir, candidate);
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  pkgDirCache.set(startDir, null);
  return null;
}

function resolveStability(pkgDir: string, subpath: string): StabilityResult {
  const cacheKey = `${pkgDir}:${subpath}`;
  if (stabilityCache.has(cacheKey)) return stabilityCache.get(cacheKey)!;

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf-8")) as Record<
      string,
      unknown
    >;
  } catch {
    stabilityCache.set(cacheKey, null);
    return null;
  }

  const exports = pkg["exports"] as Record<string, unknown> | undefined;
  const exportEntry = exports?.[`./${subpath}`];

  let resolvedRelative: string | undefined;
  if (typeof exportEntry === "string") {
    resolvedRelative = exportEntry;
  } else if (exportEntry && typeof exportEntry === "object") {
    const entry = exportEntry as Record<string, unknown>;
    resolvedRelative =
      (entry["import"] as string | undefined) ?? (entry["default"] as string | undefined);
  }

  if (!resolvedRelative) {
    stabilityCache.set(cacheKey, null);
    return null;
  }

  let dir = dirname(join(pkgDir, resolvedRelative));
  for (let i = 0; i < 10; i++) {
    if (!dir.startsWith(pkgDir)) break;
    try {
      const nested = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8")) as Record<
        string,
        unknown
      >;
      if ("x-stability" in nested) {
        const rawValue = String(nested["x-stability"]);
        const result: StabilityResult = VALID_STABILITY_LEVELS.has(rawValue)
          ? { kind: "valid", stability: rawValue as StabilityLevel }
          : { kind: "invalid", rawValue };
        stabilityCache.set(cacheKey, result);
        return result;
      }
    } catch {
      // No package.json here, keep walking up
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  stabilityCache.set(cacheKey, null);
  return null;
}

export const rule = createRule<[RuleOptions], "unstableFeature" | "invalidStability">({
  name: "no-unstable-features",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow importing features below the allowed stability level",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowedStability: {
            type: "array",
            items: { type: "string", enum: ["experimental", "candidate", "stable"] },
            minItems: 1,
          },
        },
        required: ["allowedStability"],
        additionalProperties: false,
      },
    ],
    messages: {
      unstableFeature:
        "Feature '{{feature}}' has x-stability '{{stability}}' which is not allowed here. Allowed: {{allowed}}.",
      invalidStability:
        "Feature '{{feature}}' has an invalid x-stability value '{{rawValue}}'. Expected one of: experimental, candidate, stable.",
    },
  },
  defaultOptions: [{ allowedStability: ["stable"] }],
  create(context, [options]) {
    const allowedStability = options.allowedStability;

    return {
      ImportDeclaration(node) {
        const source = node.source.value;

        if (!source.startsWith("@contentgrid/features/")) return;

        const subpath = source.slice("@contentgrid/features/".length);
        if (!subpath) return;

        const currentFile = context.filename;
        const pkgDir = findPackageDir(dirname(currentFile), "@contentgrid/features");
        if (!pkgDir) return;

        const result = resolveStability(pkgDir, subpath);
        if (!result) return;

        if (result.kind === "invalid") {
          context.report({
            node,
            messageId: "invalidStability",
            data: { feature: source, rawValue: result.rawValue },
          });
          return;
        }

        if (!allowedStability.includes(result.stability)) {
          context.report({
            node,
            messageId: "unstableFeature",
            data: {
              feature: source,
              stability: result.stability,
              allowed: allowedStability.join(", "),
            },
          });
        }
      },
    };
  },
});
