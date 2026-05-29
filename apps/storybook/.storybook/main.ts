import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  framework: { name: "@storybook/react-vite", options: {} },
  staticDirs: ["../public"],
  stories: [
    { directory: "../../../packages/ui/src", files: "**/*.stories.@(ts|tsx)" },
    {
      directory: "../../../packages/features/src",
      files: "**/*.stories.@(ts|tsx)",
    },
  ],
  addons: ["@storybook/addon-themes"],
};

export default config;
