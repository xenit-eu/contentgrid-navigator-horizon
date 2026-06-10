import { DEFAULT_CONFIG } from "./defaults";
import { deepMerge } from "./storage";
import type { AppConfig } from "./types";

export const localDevPreset: AppConfig = deepMerge(
  DEFAULT_CONFIG as unknown as Record<string, unknown>,
  {
    branding: {
      appName: "ContentGrid Navigator (local-dev)",
    },
    display: {
      defaultPageSize: 20,
    },
    featureFlags: {},
  },
) as unknown as AppConfig;

export const stagingPreset: AppConfig = deepMerge(
  DEFAULT_CONFIG as unknown as Record<string, unknown>,
  {
    branding: {
      appName: "ContentGrid Navigator (staging)",
    },
  },
) as unknown as AppConfig;

export const CONFIG_PRESETS: Record<string, AppConfig> = {
  "local-dev": localDevPreset,
  staging: stagingPreset,
};
