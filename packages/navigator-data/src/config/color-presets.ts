export interface ColorPreset {
  label: string;
  swatch: string; // CSS color for the preview swatch
  light: Record<string, string>;
  dark: Record<string, string>;
}

/**
 * Builds a ColorPreset from the minimal per-preset values.
 *
 * The six "shared" CSS variables (--primary, --primary-foreground, --ring,
 * --sidebar-primary, --sidebar-ring, --chart-1) are identical in both light
 * and dark modes for most presets. Where light and dark accents differ (e.g.
 * slate), pass a separate darkAccent value.
 *
 * Key order in the produced light/dark maps intentionally matches the original
 * hand-authored order: shared keys first, then the six distinct keys.
 */
function makePreset(
  label: string,
  accent: string,
  light: {
    secondary: string;
    secondaryForeground: string;
    accent: string;
    accentForeground: string;
    sidebar: string;
    sidebarAccent: string;
  },
  dark: {
    secondary: string;
    secondaryForeground: string;
    accent: string;
    accentForeground: string;
    sidebar: string;
    sidebarAccent: string;
  },
  darkAccent = accent,
): ColorPreset {
  const lightShared = {
    "--primary": accent,
    "--primary-foreground": "oklch(1 0 0)",
    "--ring": accent,
    "--sidebar-primary": accent,
    "--sidebar-ring": accent,
    "--chart-1": accent,
  };
  const darkShared = {
    "--primary": darkAccent,
    "--primary-foreground": "oklch(1 0 0)",
    "--ring": darkAccent,
    "--sidebar-primary": darkAccent,
    "--sidebar-ring": darkAccent,
    "--chart-1": darkAccent,
  };
  return {
    label,
    swatch: accent,
    light: {
      ...lightShared,
      "--secondary": light.secondary,
      "--secondary-foreground": light.secondaryForeground,
      "--accent": light.accent,
      "--accent-foreground": light.accentForeground,
      "--sidebar": light.sidebar,
      "--sidebar-accent": light.sidebarAccent,
    },
    dark: {
      ...darkShared,
      "--secondary": dark.secondary,
      "--secondary-foreground": dark.secondaryForeground,
      "--accent": dark.accent,
      "--accent-foreground": dark.accentForeground,
      "--sidebar": dark.sidebar,
      "--sidebar-accent": dark.sidebarAccent,
    },
  };
}

/**
 * Curated color presets with hand-tuned oklch values for both light and dark modes.
 * Each preset overrides the primary accent color and derived variables.
 */
export const COLOR_PRESETS: Record<string, ColorPreset> = {
  green: makePreset(
    "Green",
    "oklch(0.55 0.17 155)",
    {
      secondary: "oklch(0.93 0.01 155)",
      secondaryForeground: "oklch(0.35 0.12 155)",
      accent: "oklch(0.93 0.02 155)",
      accentForeground: "oklch(0.35 0.12 155)",
      sidebar: "oklch(0.25 0.05 155)",
      sidebarAccent: "oklch(0.30 0.04 155)",
    },
    {
      secondary: "oklch(0.25 0.02 155)",
      secondaryForeground: "oklch(0.985 0 0)",
      accent: "oklch(0.25 0.03 155)",
      accentForeground: "oklch(0.985 0 0)",
      sidebar: "oklch(0.14 0.025 155)",
      sidebarAccent: "oklch(0.20 0.025 155)",
    },
  ),
  purple: makePreset(
    "Purple",
    "oklch(0.55 0.18 290)",
    {
      secondary: "oklch(0.93 0.01 290)",
      secondaryForeground: "oklch(0.38 0.13 290)",
      accent: "oklch(0.93 0.02 290)",
      accentForeground: "oklch(0.38 0.13 290)",
      sidebar: "oklch(0.25 0.05 290)",
      sidebarAccent: "oklch(0.30 0.04 290)",
    },
    {
      secondary: "oklch(0.25 0.02 290)",
      secondaryForeground: "oklch(0.985 0 0)",
      accent: "oklch(0.25 0.03 290)",
      accentForeground: "oklch(0.985 0 0)",
      sidebar: "oklch(0.14 0.025 290)",
      sidebarAccent: "oklch(0.20 0.025 290)",
    },
  ),
  orange: makePreset(
    "Orange",
    "oklch(0.65 0.18 55)",
    {
      secondary: "oklch(0.93 0.01 55)",
      secondaryForeground: "oklch(0.42 0.12 55)",
      accent: "oklch(0.93 0.02 55)",
      accentForeground: "oklch(0.42 0.12 55)",
      sidebar: "oklch(0.28 0.05 55)",
      sidebarAccent: "oklch(0.33 0.04 55)",
    },
    {
      secondary: "oklch(0.25 0.02 55)",
      secondaryForeground: "oklch(0.985 0 0)",
      accent: "oklch(0.25 0.03 55)",
      accentForeground: "oklch(0.985 0 0)",
      sidebar: "oklch(0.16 0.025 55)",
      sidebarAccent: "oklch(0.22 0.025 55)",
    },
  ),
  red: makePreset(
    "Red",
    "oklch(0.55 0.20 25)",
    {
      secondary: "oklch(0.93 0.01 25)",
      secondaryForeground: "oklch(0.38 0.14 25)",
      accent: "oklch(0.93 0.02 25)",
      accentForeground: "oklch(0.38 0.14 25)",
      sidebar: "oklch(0.25 0.05 25)",
      sidebarAccent: "oklch(0.30 0.04 25)",
    },
    {
      secondary: "oklch(0.25 0.02 25)",
      secondaryForeground: "oklch(0.985 0 0)",
      accent: "oklch(0.25 0.03 25)",
      accentForeground: "oklch(0.985 0 0)",
      sidebar: "oklch(0.14 0.025 25)",
      sidebarAccent: "oklch(0.20 0.025 25)",
    },
  ),
  teal: makePreset(
    "Teal",
    "oklch(0.58 0.14 190)",
    {
      secondary: "oklch(0.93 0.01 190)",
      secondaryForeground: "oklch(0.38 0.10 190)",
      accent: "oklch(0.93 0.02 190)",
      accentForeground: "oklch(0.38 0.10 190)",
      sidebar: "oklch(0.25 0.04 190)",
      sidebarAccent: "oklch(0.30 0.035 190)",
    },
    {
      secondary: "oklch(0.25 0.02 190)",
      secondaryForeground: "oklch(0.985 0 0)",
      accent: "oklch(0.25 0.03 190)",
      accentForeground: "oklch(0.985 0 0)",
      sidebar: "oklch(0.14 0.02 190)",
      sidebarAccent: "oklch(0.20 0.02 190)",
    },
  ),
  // Slate has different light vs dark accent values, so darkAccent is passed explicitly.
  slate: makePreset(
    "Slate",
    "oklch(0.45 0.02 260)",
    {
      secondary: "oklch(0.93 0.005 260)",
      secondaryForeground: "oklch(0.30 0.01 260)",
      accent: "oklch(0.93 0.005 260)",
      accentForeground: "oklch(0.30 0.01 260)",
      sidebar: "oklch(0.22 0.02 260)",
      sidebarAccent: "oklch(0.28 0.015 260)",
    },
    {
      secondary: "oklch(0.25 0.01 260)",
      secondaryForeground: "oklch(0.985 0 0)",
      accent: "oklch(0.25 0.01 260)",
      accentForeground: "oklch(0.985 0 0)",
      sidebar: "oklch(0.14 0.015 260)",
      sidebarAccent: "oklch(0.20 0.015 260)",
    },
    "oklch(0.55 0.02 260)",
  ),
};
