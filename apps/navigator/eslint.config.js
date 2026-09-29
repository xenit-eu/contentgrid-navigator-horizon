import baseConfig from "@contentgrid/eslint-config";
import { rule as noUnstableFeatures } from "@contentgrid/eslint-config/rules/no-unstable-features";

export default [
  ...baseConfig,
  {
    plugins: { "@contentgrid": { rules: { "no-unstable-features": noUnstableFeatures } } },
    rules: {
      "@contentgrid/no-unstable-features": ["error", { allowedStability: ["stable"] }],
    },
  },
  {
    files: ["tests/**"],
    rules: {
      "no-empty-pattern": "off",
    },
  },
  {
    // local-mock-backend is dev-only tooling — only main.tsx's DEV-gated enableMocking() may
    // import it. Files inside local-mock-backend/ are exempt so they can import each other.
    ignores: ["src/main.tsx", "src/local-mock-backend/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/local-mock-backend/**", "./local-mock-backend/*"],
              message:
                "local-mock-backend is dev-only; only main.tsx's DEV-gated enableMocking() may import it.",
            },
          ],
        },
      ],
    },
  },
];
