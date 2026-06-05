import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";
import "../src/storybook.css";

const preview: Preview = {
  initialGlobals: {
    // Disable the addon's automatic in-browser scan via the Storybook 9 globals API.
    // The accessibility.spec.ts runs axe externally via @axe-core/playwright which is
    // the authoritative CI gate. Having both auto-scan simultaneously throws
    // "Axe is already running". The panel remains available for manual on-demand
    // inspection in the browser (click the Accessibility tab and press Run).
    a11y: { manual: true },
  },
  parameters: {
    layout: "centered",
    a11y: {
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
