import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  framework: { name: "@storybook/react-vite", options: {} },
  staticDirs: ["../public"],
  stories: [
    "../../../packages/ui/src/**/*.stories.@(ts|tsx)",
    {
      directory: "../../../packages/features/src",
      files: "**/*.stories.@(ts|tsx)",
    },
  ],
  addons: ["@storybook/addon-themes"],
};

export default config;
