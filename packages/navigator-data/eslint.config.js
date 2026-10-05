import baseConfig from "@contentgrid/eslint-config";

export default [
  ...baseConfig,
  {
    // Standalone Node CLIs (recorder/sanitiser): Node globals and console output are intended.
    files: ["test-fixtures/recorded/scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        setTimeout: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        console: "readonly",
        fetch: "readonly",
        process: "readonly",
      },
    },
    rules: { "no-console": "off" },
  },
];
