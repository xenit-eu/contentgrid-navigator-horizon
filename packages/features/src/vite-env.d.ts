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

declare module "*.svg" {
  const url: string;
  export default url;
}

/**
 * `packages/features` does not depend on `vite` directly, so
 * `/// <reference types="vite/client" />` is not resolvable here — the `?url` import suffix for
 * the self-hosted PDFium WASM binary (`entity-item/variations/content-focus/util/pdfium-wasm-url.ts`)
 * is declared by hand instead, matching `packages/ui/src/vite-env.d.ts`'s equivalent declaration.
 */
declare module "*.wasm?url" {
  const url: string;
  export default url;
}
