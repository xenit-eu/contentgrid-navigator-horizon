import baseConfig from "@contentgrid/eslint-config";
import { appsLayerConfig } from "@contentgrid/eslint-config/layers";
import { rule as noUnstableFeatures } from "@contentgrid/eslint-config/rules/no-unstable-features";

export default [
  ...baseConfig,
  {
    plugins: { "@contentgrid": { rules: { "no-unstable-features": noUnstableFeatures } } },
    rules: {
      "@contentgrid/no-unstable-features": [
        "error",
        { allowedStability: ["experimental", "candidate", "stable"] },
      ],
    },
  },
  // L1 (apps import features only through views) plus this app's own local-mock-backend rule.
  // local-mock-backend is dev-only tooling — only main.tsx's DEV-gated enableMocking() may
  // import it. Files inside local-mock-backend/ are exempt so they can import each other.
  ...appsLayerConfig(
    [
      {
        group: ["**/local-mock-backend/**", "./local-mock-backend/*"],
        message:
          "local-mock-backend is dev-only; only main.tsx's DEV-gated enableMocking() may import it.",
      },
    ],
    ["src/main.tsx", "src/local-mock-backend/**"],
  ),
];
