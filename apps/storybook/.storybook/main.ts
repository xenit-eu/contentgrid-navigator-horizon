import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  framework: { name: "@storybook/react-vite", options: {} },
  stories: [
    "../../../packages/ui/**/*.stories.@(ts|tsx)",
    "../../../packages/features/**/*.stories.@(ts|tsx)",
  ],
  addons: ["@storybook/addon-themes"],
};

export default config;
