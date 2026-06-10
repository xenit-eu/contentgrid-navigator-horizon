/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" in dev → MSW serves the stubbed HAL endpoint (see src/mocks/). */
  readonly VITE_USE_MOCK_API?: string;
  /** Static bearer token enabling dev-token auth mode (bypasses OIDC). */
  readonly VITE_DEV_TOKEN?: string;
  /** ContentGrid API base URL; in production resolved from config.js (Liaison). */
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_OIDC_AUTHORITY?: string;
  readonly VITE_OIDC_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
