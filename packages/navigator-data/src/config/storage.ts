import { DEFAULT_CONFIG } from "./defaults";
import { validateConfig } from "./schema";
import type { AppConfig } from "./types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep-merge source into target, returning a new object. Arrays are replaced, not merged.
 * `undefined` values in `source` never overwrite a value already present in `target`.
 *
 * General-purpose: used for app-config loading here, and also by
 * `useEntityDisplayPreferences` (packages/features/src/preferences) to layer backend-default
 * and user-override entity display preferences on top of the heuristic default.
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>,
): T {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const targetVal = (target as Record<string, unknown>)[key];
    const sourceVal = source[key];
    if (isPlainObject(targetVal) && isPlainObject(sourceVal)) {
      (result as Record<string, unknown>)[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal,
      );
    } else if (sourceVal !== undefined) {
      (result as Record<string, unknown>)[key] = sourceVal;
    }
  }
  return result;
}

/** Returns the localStorage key for a given app identity. */
export function configStorageKey(appId: string): string {
  return `contentgrid-navigator-config:${appId}`;
}

export function loadConfig(storageKey: string): AppConfig {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_CONFIG;
    const parsed: unknown = JSON.parse(raw);
    // Validate before merging: a stored shape like {"branding": null} would
    // otherwise overwrite the default object and break consumers downstream.
    const validated = validateConfig(parsed);
    if (!validated.success) return DEFAULT_CONFIG;
    return deepMerge(
      DEFAULT_CONFIG as unknown as Record<string, unknown>,
      validated.data,
    ) as unknown as AppConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(storageKey: string, config: AppConfig): void {
  localStorage.setItem(storageKey, JSON.stringify(config));
}

export function clearConfig(storageKey: string): void {
  localStorage.removeItem(storageKey);
}
