interface ImportMetaEnv {
  readonly VITE_DEV_TOKEN?: string;
  readonly VITE_OIDC_AUTHORITY?: string;
  readonly VITE_OIDC_CLIENT_ID?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_EXTRACT_SERVICE_URL?: string;
  readonly VITE_RENDITION_URI?: string;
  /** Vite's built-in dev-mode flag; used to gate dev-only UI (e.g. the sidebar App selector link). */
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
