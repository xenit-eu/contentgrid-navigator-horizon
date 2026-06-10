import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { COLOR_PRESETS } from "./color-presets";
import { DEFAULT_CONFIG } from "./defaults";
import { validateConfig } from "./schema";
import { clearConfig, configStorageKey, deepMerge, loadConfig, saveConfig } from "./storage";
import type { AppConfig } from "./types";

interface AppConfigContextValue {
  config: AppConfig;
  updateConfig: (partial: DeepPartial<AppConfig>) => void;
  resetConfig: () => void;
  exportConfig: () => string;
  importConfig: (json: string) => { success: true } | { success: false; error: string };
}

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Record<string, unknown> ? DeepPartial<T[P]> : T[P];
};

const AppConfigContext = createContext<AppConfigContextValue | null>(null);

export function AppConfigProvider({ children, appId }: { children: ReactNode; appId?: string }) {
  const storageKey = useMemo(() => configStorageKey(appId ?? window.location.origin), [appId]);

  const [config, setConfig] = useState<AppConfig>(() => loadConfig(storageKey));

  // Re-load from storage when the key changes (e.g. appId prop changes)
  useEffect(() => {
    setConfig(loadConfig(storageKey));
  }, [storageKey]);

  // Persist to localStorage on change
  useEffect(() => {
    saveConfig(storageKey, config);
  }, [storageKey, config]);

  // Set document title from branding
  useEffect(() => {
    document.title = config.branding.appName;
  }, [config.branding.appName]);

  // Apply color preset CSS variables
  useEffect(() => {
    const preset = config.theme.colorPreset;
    const root = document.documentElement;

    if (!preset || !COLOR_PRESETS[preset]) {
      // Remove any preset overrides - revert to CSS defaults
      root.style.removeProperty("--primary");
      root.style.removeProperty("--primary-foreground");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--sidebar-primary");
      root.style.removeProperty("--sidebar-ring");
      root.style.removeProperty("--chart-1");
      root.style.removeProperty("--secondary");
      root.style.removeProperty("--secondary-foreground");
      root.style.removeProperty("--accent");
      root.style.removeProperty("--accent-foreground");
      root.style.removeProperty("--sidebar");
      root.style.removeProperty("--sidebar-accent");
      return;
    }

    const colors = COLOR_PRESETS[preset];
    const isDark = root.classList.contains("dark");
    const vars = isDark ? colors.dark : colors.light;

    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }

    // Observe class changes on <html> to swap light/dark preset vars
    const observer = new MutationObserver(() => {
      const nowDark = root.classList.contains("dark");
      const nowVars = nowDark ? colors.dark : colors.light;
      for (const [key, value] of Object.entries(nowVars)) {
        root.style.setProperty(key, value);
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [config.theme.colorPreset]);

  const updateConfig = useCallback((partial: DeepPartial<AppConfig>) => {
    setConfig(
      (prev) =>
        deepMerge(
          prev as unknown as Record<string, unknown>,
          partial as Record<string, unknown>,
        ) as unknown as AppConfig,
    );
  }, []);

  const resetConfig = useCallback(() => {
    clearConfig(storageKey);
    setConfig(DEFAULT_CONFIG);
  }, [storageKey]);

  const exportConfig = useCallback(() => {
    return JSON.stringify(config, null, 2);
  }, [config]);

  const importConfig = useCallback(
    (json: string): { success: true } | { success: false; error: string } => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        return { success: false, error: "Invalid JSON" };
      }
      const result = validateConfig(parsed);
      if (!result.success) {
        return { success: false, error: result.error };
      }
      const merged = deepMerge(
        DEFAULT_CONFIG as unknown as Record<string, unknown>,
        result.data as Record<string, unknown>,
      ) as unknown as AppConfig;
      setConfig(merged);
      return { success: true };
    },
    [],
  );

  const value = useMemo(
    () => ({ config, updateConfig, resetConfig, exportConfig, importConfig }),
    [config, updateConfig, resetConfig, exportConfig, importConfig],
  );

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig() {
  const ctx = useContext(AppConfigContext);
  if (!ctx) {
    throw new Error("useAppConfig must be used within AppConfigProvider");
  }
  return ctx;
}
