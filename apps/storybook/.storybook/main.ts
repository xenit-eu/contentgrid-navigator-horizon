import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  framework: { name: "@storybook/react-vite", options: {} },
  staticDirs: ["../public"],
  stories: [
    // Object form (directory + files) so Storybook derives stable auto-titles /
    // story IDs for packages/ui — these IDs are the visual-regression snapshot
    // filenames (see apps/storybook/tests/visual.spec.ts).
    { directory: "../../../packages/ui/src", files: "**/*.stories.@(ts|tsx)" },
    {
      directory: "../../../packages/features/src",
      files: "**/*.stories.@(ts|tsx)",
    },
  ],
  addons: ["@storybook/addon-themes"],
};

export default config;
