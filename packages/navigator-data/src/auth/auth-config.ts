import { WebStorageStateStore } from "oidc-client-ts";
import type { AuthProviderProps } from "react-oidc-context";
import { z } from "zod";
import { DEFAULT_RENDITION_POLL_INTERVAL_MS } from "../preview/rendition-job";
import { isDevTokenMode } from "./dev-token";

const isNotTemplate = (s: string) => !s.includes("${");

/** Minimum allowed `renditionPollIntervalMs` — see `validateRenditionSettings`. */
const MIN_RENDITION_POLL_INTERVAL_MS = 250;

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
    /**
     * URI template for the PDF rendition service, delivered per deployment via Liaison's
     * `config.js` (see `specs/002-pdf-viewer/research.md` §8.6). Optional: renditions are
     * simply disabled (`useContentPreview` returns `{ kind: "unavailable" }` for non-PDF
     * files) when unset.
     */
    renditionUri: z.string().optional(),
    /** Delay between rendition job polls, in milliseconds. Defaults to 2000 when unset. */
    renditionPollIntervalMs: z.number().optional(),
    /** Rendition polling ceiling, in milliseconds. Defaults to 60000 when unset. */
    renditionTimeoutMs: z.number().optional(),
  }),
});

/**
 * Candidate rendition settings gathered from any one config source (window config,
 * `config.js`, the dev-config override, or env vars) before they are trusted.
 */
interface RenditionSettingsCandidate {
  renditionUri?: string;
  renditionPollIntervalMs?: number;
  renditionTimeoutMs?: number;
}

/**
 * Validates rendition configuration from any source and drops (with a `console.warn`,
 * never a thrown error — a misconfigured rendition endpoint must not block the rest of
 * the app from loading) any value that fails its rule:
 * - `renditionUri` must be a URI template containing the `{?url}` expansion the rendition
 *   client relies on (`preview/rendition-job.ts`).
 * - `renditionPollIntervalMs` must be at least {@link MIN_RENDITION_POLL_INTERVAL_MS} —
 *   below that, polling would hammer the rendition service.
 * - `renditionTimeoutMs` must be at least the (possibly defaulted) poll interval — a
 *   timeout shorter than one poll interval could never observe a single poll result.
 */
function validateRenditionSettings(
  candidate: RenditionSettingsCandidate,
): RenditionSettingsCandidate {
  let { renditionUri, renditionPollIntervalMs, renditionTimeoutMs } = candidate;

  if (renditionUri !== undefined && !renditionUri.includes("{?url}")) {
    // Intentional: warn-and-drop, not throw — a misconfigured rendition endpoint must
    // not block the rest of the app from loading.
    // eslint-disable-next-line no-console
    console.warn(
      `Ignoring renditionUri "${renditionUri}": must be a URI template containing "{?url}".`,
    );
    renditionUri = undefined;
  }

  if (
    renditionPollIntervalMs !== undefined &&
    renditionPollIntervalMs < MIN_RENDITION_POLL_INTERVAL_MS
  ) {
    // eslint-disable-next-line no-console -- intentional, see the warn above.
    console.warn(
      `Ignoring renditionPollIntervalMs ${renditionPollIntervalMs}: must be at least ${MIN_RENDITION_POLL_INTERVAL_MS}ms.`,
    );
    renditionPollIntervalMs = undefined;
  }

  const effectiveIntervalMs = renditionPollIntervalMs ?? DEFAULT_RENDITION_POLL_INTERVAL_MS;
  if (renditionTimeoutMs !== undefined && renditionTimeoutMs < effectiveIntervalMs) {
    // eslint-disable-next-line no-console -- intentional, see the warn above.
    console.warn(
      `Ignoring renditionTimeoutMs ${renditionTimeoutMs}: must be >= the poll interval (${effectiveIntervalMs}ms).`,
    );
    renditionTimeoutMs = undefined;
  }

  return { renditionUri, renditionPollIntervalMs, renditionTimeoutMs };
}

declare global {
  interface Window {
    contentGridConfig?: unknown;
  }
}

export interface RuntimeAppConfig {
  authority: string;
  clientId: string;
  apiBaseUrl: string;
  extractServiceUrl?: string;
  renditionUri?: string;
  /** Delay between rendition job polls, in milliseconds. Defaults to 2000 when unset. */
  renditionPollIntervalMs?: number;
  /** Rendition polling ceiling, in milliseconds. Defaults to 60000 when unset. */
  renditionTimeoutMs?: number;
}

export const DEV_CONFIG_STORAGE_KEY = "contentgrid-navigator:dev-config";

const DevConfigOverrideSchema = z.object({
  apiBaseUrl: z.string().min(1),
  authority: z.string().min(1),
  clientId: z.string().min(1),
  extractServiceUrl: z.string().optional(),
  renditionUri: z.string().optional(),
  renditionPollIntervalMs: z.number().optional(),
  renditionTimeoutMs: z.number().optional(),
});

let cachedConfig: RuntimeAppConfig | null = null;

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
  // What is this???
  const fn = new Function(text + "\nreturn window.contentGridConfig;"); // NOSONAR: intentional — Liaison config.js pattern; requires 'unsafe-eval' in CSP
  return fn();
}

export async function loadAppConfig(): Promise<RuntimeAppConfig> {
  if (cachedConfig) return cachedConfig;

  // Dev override: check localStorage first — set by the app-selector settings page.
  // Only active in local development; Liaison-served deployments do not use this path.
  try {
    const overrideRaw = localStorage.getItem(DEV_CONFIG_STORAGE_KEY);
    if (overrideRaw) {
      const parsed = DevConfigOverrideSchema.safeParse(JSON.parse(overrideRaw));
      if (parsed.success) {
        cachedConfig = { ...parsed.data, ...validateRenditionSettings(parsed.data) };
        return cachedConfig;
      }
    }
  } catch {
    // localStorage unavailable or malformed — fall through
  }

  try {
    const raw = await fetchConfigJs();
    const parsed = ContentGridConfigSchema.safeParse(raw);
    if (parsed.success) {
      cachedConfig = {
        authority: parsed.data.v1.oidc.authority,
        clientId: parsed.data.v1.oidc.client_id,
        apiBaseUrl: parsed.data.v1.apiBaseUrl,
        extractServiceUrl: import.meta.env.VITE_EXTRACT_SERVICE_URL || undefined,
        ...validateRenditionSettings({
          renditionUri:
            parsed.data.v1.renditionUri ?? (import.meta.env.VITE_RENDITION_URI || undefined),
          renditionPollIntervalMs: parsed.data.v1.renditionPollIntervalMs,
          renditionTimeoutMs: parsed.data.v1.renditionTimeoutMs,
        }),
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

  cachedConfig = {
    authority,
    clientId,
    apiBaseUrl,
    extractServiceUrl: import.meta.env.VITE_EXTRACT_SERVICE_URL || undefined,
    ...validateRenditionSettings({ renditionUri: import.meta.env.VITE_RENDITION_URI || undefined }),
  };
  return cachedConfig;
}

export function storeDevConfig(config: RuntimeAppConfig): void {
  localStorage.setItem(DEV_CONFIG_STORAGE_KEY, JSON.stringify(config));
  cachedConfig = null;
}

export function clearDevConfig(): void {
  localStorage.removeItem(DEV_CONFIG_STORAGE_KEY);
  cachedConfig = null;
}

export function getAppConfig(): RuntimeAppConfig {
  if (!cachedConfig) {
    throw new Error("App config not loaded. Call loadAppConfig() first.");
  }
  return cachedConfig;
}

function buildOidcBase(config: RuntimeAppConfig) {
  return {
    authority: config.authority,
    client_id: config.clientId,
    redirect_uri: window.location.origin,
    scope: "openid profile email",
    userStore: new WebStorageStateStore({ store: localStorage }),
  };
}

export async function signinWithNewConfig(config: RuntimeAppConfig): Promise<void> {
  storeDevConfig(config);
  const userManager = new (await import("oidc-client-ts")).UserManager(buildOidcBase(config));
  await userManager.removeUser();
  return userManager.signinRedirect();
}

export function getOidcConfig(config: RuntimeAppConfig): AuthProviderProps {
  return {
    ...buildOidcBase(config),
    post_logout_redirect_uri: window.location.origin,
    automaticSilentRenew: true,
    onSigninCallback: (user) => {
      const target = typeof user?.state === "string" ? user.state : window.location.pathname;
      window.history.replaceState({}, document.title, target);
    },
  };
}
