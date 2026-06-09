import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";
import "../src/storybook.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    a11y: {
      // Do not auto-run axe when a story loads: the dedicated accessibility.spec.ts
      // runs AxeBuilder.analyze() as the sole axe runner. Auto-run races with
      // AxeBuilder on the same iframe frame and causes "Axe is already running" errors.
      manual: true,
      // Mirror the CI axe ruleset: WCAG 2.x A/AA + 2.1 A/AA.
      config: {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
        },
      },
    },
  },
  decorators: [
    withThemeByClassName({
      themes: { light: "", dark: "dark" },
      defaultTheme: "light",
      parentSelector: "html",
    }),
  ],
};

export default preview;
