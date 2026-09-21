import * as React from "react";
import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { usePdfiumEngine } from "@embedpdf/engines/react";
import type { PdfEngine } from "@embedpdf/models";

/**
 * Font fallback disabled: a stable, module-level reference (never recreated
 * on render) so `usePdfiumEngine`'s effect dependency array keeps a stable
 * identity across re-renders. `@embedpdf/engines` otherwise defaults to
 * fetching missing glyphs from jsDelivr's CDN; an empty `fonts` map means no
 * such request is ever made (research.md §8.2, FR-027 — no third-party CDN).
 */
const NO_FONT_FALLBACK = { fonts: {} };

/** Status of the shared PDFium/WASM engine for a `PdfEngineProvider` subtree. */
export type PdfEngineStatus =
  | { status: "loading"; engine?: undefined; error?: undefined }
  | { status: "ready"; engine: PdfEngine; error?: undefined }
  | { status: "error"; engine?: undefined; error: Error };

const PdfEngineStatusContext = createContext<PdfEngineStatus | undefined>(undefined);

/**
 * Reads the engine status from the nearest ancestor `PdfEngineProvider`, or
 * `undefined` when there is none in scope. `PdfViewer` uses `undefined` as
 * the signal that it must create its own provider (contract: "one engine per
 * subtree; the viewer creates one when not wrapped").
 */
export function useAmbientPdfEngineStatus(): PdfEngineStatus | undefined {
  return useContext(PdfEngineStatusContext);
}

export interface PdfEngineProviderProps {
  /** Absolute URL of the self-hosted `pdfium.wasm` binary. Never a CDN URL. */
  wasmUrl: string;
  children: React.ReactNode;
}

/**
 * Creates one PDFium/WASM engine instance and makes it available to every
 * `PdfViewer` in the subtree, so several viewers can share a single engine
 * (and a single worker) instead of each creating its own.
 *
 * Guards against the upstream Strict-Mode double-invoke leak
 * (`@embedpdf/engines` issue #700): `usePdfiumEngine`'s effect can resolve a
 * second engine after React's dev-mode mount -> cleanup -> mount cycle
 * without destroying the first (its success path is not gated on the
 * cleanup's `cancelled` flag the way its error path is). This component
 * tracks the previously-seen engine instance and tears it down itself the
 * moment a different one replaces it, so at most one live engine — and one
 * live wasm worker — exists at a time regardless of how many times the
 * underlying hook's effect re-ran.
 *
 * Genuine unmount (not a Strict-Mode replacement) is **not** handled here on
 * purpose: `usePdfiumEngine` already destroys the engine it created in its
 * own effect cleanup (`node_modules/@embedpdf/engines/dist/react/index.js`,
 * the `useEffect` in `usePdfiumEngine` — cleanup calls
 * `engineRef.current?.closeAllDocuments?.().wait(() => engineRef.current?.destroy?.(), ignore)`
 * unconditionally, i.e. on every unmount of the component calling the hook,
 * not only on a Strict-Mode re-run). Adding a second destroy call here for
 * the terminal engine on our own unmount would double-free it. See the unit
 * test "does not double-destroy the engine on unmount" below.
 */
export function PdfEngineProvider({ wasmUrl, children }: Readonly<PdfEngineProviderProps>) {
  const { engine, isLoading, error } = usePdfiumEngine({
    wasmUrl,
    worker: true,
    fontFallback: NO_FONT_FALLBACK,
  });

  const previousEngineRef = useRef<PdfEngine | null>(null);
  useEffect(() => {
    const previous = previousEngineRef.current;
    if (previous && previous !== engine) {
      previous.closeAllDocuments().wait(
        () => previous.destroy?.(),
        () => previous.destroy?.(),
      );
    }
    previousEngineRef.current = engine;
  }, [engine]);

  const value = useMemo<PdfEngineStatus>(() => {
    if (error) return { status: "error", error };
    if (!engine || isLoading) return { status: "loading" };
    return { status: "ready", engine };
  }, [engine, isLoading, error]);

  return (
    <PdfEngineStatusContext.Provider value={value}>{children}</PdfEngineStatusContext.Provider>
  );
}
