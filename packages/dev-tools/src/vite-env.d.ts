interface ImportMetaEnv {
  /** Dev mock user: "full" (default) or "restricted" (derived permission limits, see RESTRICTED_POLICY). */
  readonly VITE_MOCK_USER?: string;
  readonly VITE_DEV_TOKEN?: string;
  readonly VITE_OIDC_AUTHORITY?: string;
  readonly VITE_OIDC_CLIENT_ID?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_EXTRACT_SERVICE_URL?: string;
  readonly VITE_RENDITION_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.svg" {
  const url: string;
  export default url;
}
