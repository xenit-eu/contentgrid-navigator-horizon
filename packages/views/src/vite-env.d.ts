// Declared here because `@contentgrid/navigator-data` (typechecked transitively through the
// `@contentgrid/features` imports) reads these `VITE_*` variables.
interface ImportMetaEnv {
  readonly VITE_DEV_TOKEN?: string;
  readonly VITE_OIDC_AUTHORITY?: string;
  readonly VITE_OIDC_CLIENT_ID?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_EXTRACT_SERVICE_URL?: string;
  readonly VITE_RENDITION_URI?: string;
  /** Vite's built-in dev-mode flag; a missing navigation provider throws only when it is set. */
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.svg" {
  const url: string;
  export default url;
}

declare module "*.wasm?url" {
  const url: string;
  export default url;
}
