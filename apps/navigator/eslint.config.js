import baseConfig from "@contentgrid/eslint-config";
import { rule as noUnstableFeatures } from "@contentgrid/eslint-config/rules/no-unstable-features";

export default [
  ...baseConfig,
  {
    plugins: { "@contentgrid": { rules: { "no-unstable-features": noUnstableFeatures } } },
    rules: {
      // Pre-GA the stability gate is suspended — all tiers are importable here.
      // Restore to ["stable"] at go-live (see ADR-006 amendment).
      "@contentgrid/no-unstable-features": [
        "error",
        { allowedStability: ["experimental", "candidate", "stable"] },
      ],
    },
  },
  {
    files: ["tests/**"],
    rules: {
      "no-empty-pattern": "off",
    },
  },
];
