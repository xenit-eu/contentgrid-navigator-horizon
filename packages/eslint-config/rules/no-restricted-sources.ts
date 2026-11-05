import { ESLintUtils, type TSESTree } from "@typescript-eslint/utils";
import { dirname, isAbsolute, resolve } from "node:path";

/**
 * Layer import restrictions L1-L4 (specs/005-views-layer/contracts/layer-lint-rules.md).
 *
 * Core `no-restricted-imports` ignores `import("x")` and `typeof import("x")`, and its glob
 * patterns cannot see a relative path that reaches into another package
 * (`../../../views/src/layout`). This rule checks every place a module specifier can appear:
 * `import`, `export ... from`, `import()`, `import x = require()` and `import("x")` types.
 *
 * Each restriction has a `specifier` regex (tested against the specifier as written) and/or a
 * `resolved` regex (tested against the absolute, `/`-separated path a relative or absolute
 * specifier points to). Matching the resolved path means a file never matches a restriction on
 * its own package: only specifiers that really leave the package are caught.
 */

export interface Restriction {
  /** Regex source, tested against the specifier as written. */
  specifier?: string;
  /** Regex source, tested against the resolved path of a relative/absolute specifier. */
  resolved?: string;
  message: string;
}

interface RuleOptions {
  restrictions: Restriction[];
}

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://contentgrid.com/eslint-rules/${name}`,
);

const toPosix = (p: string) => p.replaceAll("\\", "/");

function literalValue(node: TSESTree.Node | null | undefined): unknown {
  if (!node) return undefined;
  if (node.type === "Literal") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked;
  }
  return undefined;
}

export const rule = createRule<[RuleOptions], "restricted">({
  name: "no-restricted-sources",
  meta: {
    type: "problem",
    docs: { description: "Disallow module specifiers that break a layer boundary" },
    schema: [
      {
        type: "object",
        properties: {
          restrictions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                specifier: { type: "string" },
                resolved: { type: "string" },
                message: { type: "string" },
              },
              required: ["message"],
              additionalProperties: false,
            },
          },
        },
        required: ["restrictions"],
        additionalProperties: false,
      },
    ],
    messages: { restricted: "'{{source}}' is not allowed here. {{message}}" },
  },
  defaultOptions: [{ restrictions: [] }],
  create(context, [options]) {
    const compiled = options.restrictions.map((r) => ({
      message: r.message,
      specifier: r.specifier ? new RegExp(r.specifier) : null,
      resolved: r.resolved ? new RegExp(r.resolved) : null,
    }));
    const importerDir = dirname(context.filename);

    const check = (node: TSESTree.Node, source: unknown) => {
      if (typeof source !== "string") return;
      const isPath = source.startsWith(".") || isAbsolute(source);
      const resolvedPath = isPath ? toPosix(resolve(importerDir, source)) : null;
      const hit = compiled.find(
        (r) =>
          (r.specifier?.test(source) ?? false) ||
          (resolvedPath !== null && (r.resolved?.test(resolvedPath) ?? false)),
      );
      if (hit) {
        context.report({ node, messageId: "restricted", data: { source, message: hit.message } });
      }
    };

    return {
      ImportDeclaration: (node) => check(node.source, node.source.value),
      ExportNamedDeclaration: (node) => {
        if (node.source) check(node.source, node.source.value);
      },
      ExportAllDeclaration: (node) => check(node.source, node.source.value),
      ImportExpression: (node) => check(node.source, literalValue(node.source)),
      TSImportType: (node) => {
        // `source` replaced the deprecated `argument` (a TSLiteralType) in typescript-eslint 8.5x.
        check(node, literalValue(node.source));
      },
      TSExternalModuleReference: (node) => check(node, literalValue(node.expression)),
    };
  },
});
