import { WebStorageStateStore } from "oidc-client-ts";
import type { AuthProviderProps } from "react-oidc-context";
import { isDevTokenMode } from "./dev-token";

interface ContentGridConfig {
  v1: {
    apiBaseUrl: string;
    oidc: {
      authority: string;
      client_id: string;
    };
  };
}

declare global {
  interface Window {
    contentGridConfig?: ContentGridConfig;
  }
}

export interface AppConfig {
  authority: string;
  clientId: string;
  apiBaseUrl: string;
}

let cachedConfig: AppConfig | null = null;

async function fetchConfigJs(): Promise<ContentGridConfig> {
  const response = await fetch(`${window.location.origin}/config.js`);
  const text = await response.text();
  // config.js sets window.contentGridConfig = { ... }; eval-style load for runtime injection
  const fn = new Function(text + "\nreturn window.contentGridConfig;");
  return fn() as ContentGridConfig;
}

function isValidConfigJs(config: ContentGridConfig): boolean {
  const { apiBaseUrl, oidc } = config.v1;
  return (
    !apiBaseUrl.includes("${") && !oidc.authority.includes("${") && !oidc.client_id.includes("${")
  );
}

export async function loadAppConfig(): Promise<AppConfig> {
  if (cachedConfig) return cachedConfig;

  try {
    const config = await fetchConfigJs();
    if (isValidConfigJs(config)) {
      cachedConfig = {
        authority: config.v1.oidc.authority,
        clientId: config.v1.oidc.client_id,
        apiBaseUrl: config.v1.apiBaseUrl,
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
