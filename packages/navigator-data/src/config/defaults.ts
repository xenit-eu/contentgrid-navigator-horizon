import type { AppConfig } from "./types";

export const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  branding: {
    appName: "ContentGrid Navigator",
    logoUrl: null,
    logoAlt: "ContentGrid",
  },
  homePage: {
    welcomeTitle: "Welcome to ContentGrid Navigator",
    welcomeSubtitle: "Select an entity to browse, search, or create content.",
  },
  display: {
    defaultPageSize: 20,
    entityOverrides: {},
  },
  theme: {
    colorPreset: null,
  },
  featureFlags: {},
};
