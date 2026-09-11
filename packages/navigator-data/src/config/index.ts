// config — Zod-validated app config, presets, and React context.
// See packages/navigator-data/CLAUDE.md for what belongs here.

export { appConfigSchema, validateConfig } from "./schema";
export type { AppConfig } from "./types";
export { DEFAULT_CONFIG } from "./defaults";
export { configStorageKey, loadConfig, saveConfig, clearConfig, deepMerge } from "./storage";
export { AppConfigProvider, useAppConfig } from "./context";
export { COLOR_PRESETS } from "./color-presets";
export type { ColorPreset } from "./color-presets";
export { localDevPreset, stagingPreset, CONFIG_PRESETS } from "./presets";
