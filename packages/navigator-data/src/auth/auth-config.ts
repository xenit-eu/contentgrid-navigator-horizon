import { WebStorageStateStore } from "oidc-client-ts";
import type { AuthProviderProps } from "react-oidc-context";
import { z } from "zod";
import { isDevTokenMode } from "./dev-token";

const isNotTemplate = (s: string) => !s.includes("${");

const ContentGridConfigSchema = z.object({
  v1: z.object({
    apiBaseUrl: z.string().min(1).refine(isNotTemplate, "Contains unreplaced template placeholder"),
    oidc: z.object({
      authority: z
        .string()
        .min(1)
        .refine(isNotTemplate, "Contains unreplaced template placeholder"),
      client_id: z
        .string()
        .min(1)
        .refine(isNotTemplate, "Contains unreplaced template placeholder"),
    }),
  }),
});

declare global {
  interface Window {
    contentGridConfig?: unknown;
  }
}

export interface AppConfig {
  authority: string;
  clientId: string;
  apiBaseUrl: string;
}

let cachedConfig: AppConfig | null = null;

async function fetchConfigJs(): Promise<unknown> {
  // config.js may already be present on window if loaded as a <script> tag in index.html.
  if (window.contentGridConfig) {
    return window.contentGridConfig;
  }

  const response = await fetch(`${window.location.origin}/config.js`);
  if (!response.ok) {
    throw new Error(`Failed to load config.js: HTTP ${response.status}`);
  }
  const text = await response.text();
  // Execute config.js which sets window.contentGridConfig. Requires 'unsafe-eval' in CSP.
  // In strict-CSP deployments, include config.js as a <script> tag in index.html instead.
  const fn = new Function(text + "\nreturn window.contentGridConfig;");
  return fn();
}

export async function loadAppConfig(): Promise<AppConfig> {
  if (cachedConfig) return cachedConfig;

  try {
    const raw = await fetchConfigJs();
    const parsed = ContentGridConfigSchema.safeParse(raw);
    if (parsed.success) {
      cachedConfig = {
        authority: parsed.data.v1.oidc.authority,
        clientId: parsed.data.v1.oidc.client_id,
        apiBaseUrl: parsed.data.v1.apiBaseUrl,
      };
      return cachedConfig;
    }
  } catch {
    // config.js not available or invalid — fall through to env vars
  }

  const authority = import.meta.env.VITE_OIDC_AUTHORITY;
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  const clientId = import.meta.env.VITE_OIDC_CLIENT_ID;

  if (isDevTokenMode()) {
    if (!apiBaseUrl) {
      throw new Error("VITE_API_BASE_URL is required for dev token mode.");
    }
    cachedConfig = { authority: "", clientId: "", apiBaseUrl };
    return cachedConfig;
  }

  if (!authority || !apiBaseUrl || !clientId) {
    throw new Error(
      "Cannot derive config from hostname. Set VITE_OIDC_AUTHORITY, VITE_OIDC_CLIENT_ID, and VITE_API_BASE_URL for local development.",
    );
  }

  cachedConfig = { authority, clientId, apiBaseUrl };
  return cachedConfig;
}

export function getAppConfig(): AppConfig {
  if (!cachedConfig) {
    throw new Error("App config not loaded. Call loadAppConfig() first.");
  }
  return cachedConfig;
}

export function getOidcConfig(config: AppConfig): AuthProviderProps {
  return {
    authority: config.authority,
    client_id: config.clientId,
    redirect_uri: window.location.origin,
    post_logout_redirect_uri: window.location.origin,
    scope: "openid profile email",
    automaticSilentRenew: true,
    userStore: new WebStorageStateStore({ store: localStorage }),
    onSigninCallback: () => {
      window.history.replaceState({}, document.title, window.location.pathname);
    },
  };
}
