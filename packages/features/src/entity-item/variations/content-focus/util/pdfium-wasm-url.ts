/**
 * Absolute URL of the self-hosted PDFium WASM binary, for `PdfEngineProvider`'s `wasmUrl` prop
 * (`@contentgrid/ui`'s `pdf-viewer` pattern). FR-027 forbids loading it from a CDN — `?url`
 * makes Vite emit it as a hashed, immutable asset instead (research.md §8.2 of spec
 * 002-pdf-viewer); `usePdfiumEngine`'s worker is a `blob:` module worker, and a relative
 * `wasmUrl` breaks inside that worker (upstream #633), hence the absolute-URL conversion here.
 *
 * TODO(T022): `@embedpdf/pdfium` is not yet a dependency anywhere in this tree — it is being
 * added to `packages/ui`'s `package.json` by a parallel task (T002). Once installed, this import
 * resolves normally; nothing here needs to change.
 *
 * The subpath is `@embedpdf/pdfium/pdfium.wasm?url`, NOT `.../dist/pdfium.wasm?url` — the
 * package's own `exports` map only publishes the wasm binary at `./pdfium.wasm`, and the
 * `dist/...` path (its real on-disk location) fails to resolve under Vite/Rolldown's
 * `exports`-conditions resolution (`packages/ui`'s CLAUDE.md, added while building Storybook
 * against the real package for the `pdf-viewer` pattern — a fact only observable by actually
 * resolving the module, not from its type declarations).
 */
import wasmUrl from "@embedpdf/pdfium/pdfium.wasm?url";

export const pdfiumWasmUrl = new URL(wasmUrl, window.location.href).href;
