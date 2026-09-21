/**
 * `packages/ui` does not depend on `vite` directly (see CLAUDE.md dependency
 * rules) so `/// <reference types="vite/client" />` is not resolvable here.
 * Storybook (Vite-powered) is the only consumer that needs the `?url` import
 * suffix — for the self-hosted PDFium wasm binary and the pdf-viewer
 * fixtures — so the two shapes it needs are declared by hand instead.
 */
declare module "*.wasm?url" {
  const url: string;
  export default url;
}

declare module "*.pdf?url" {
  const url: string;
  export default url;
}
