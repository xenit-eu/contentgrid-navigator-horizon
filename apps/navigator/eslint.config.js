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
];
