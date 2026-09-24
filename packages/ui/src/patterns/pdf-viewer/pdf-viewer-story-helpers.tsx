import { useEffect, useState } from "react";
// `@embedpdf/pdfium`'s own wasm binary, self-hosted (never a CDN URL) —
// resolved to an absolute URL the worker can load from any origin. Note:
// the package's `exports` map only exposes this at the `./pdfium.wasm`
// subpath (not `./dist/pdfium.wasm`, despite that being the file's real
// location inside the package) — `./dist/pdfium.wasm?url` fails to resolve
// under Vite/Rolldown's `exports`-conditions resolution.
import pdfiumWasmUrl from "@embedpdf/pdfium/pdfium.wasm?url";
import { PdfViewer } from "./pdf-viewer";

/**
 * Shared harness for `pdf-viewer.stories.tsx` (visual/a11y) and
 * `pdf-viewer.interaction.stories.tsx` (`WithInteraction`). Named
 * `*-story-helpers.tsx`, not `*.stories.tsx`, so Storybook's `**\/*.stories.@(ts|tsx)`
 * glob (`apps/storybook/.storybook/main.ts`) does not pick this file up as a
 * story module in its own right.
 */
export const wasmUrl = new URL(pdfiumWasmUrl, window.location.href).href;

function usePdfBytes(src: string): ArrayBuffer | null {
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBytes(null);
    fetch(src)
      .then((response) => response.arrayBuffer())
      .then((buffer) => {
        if (!cancelled) setBytes(buffer);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  return bytes;
}

/** A story receives a `src` and fetches it itself so the same harness works for every story. */
export function PdfViewerHarness(
  props: Omit<React.ComponentProps<typeof PdfViewer>, "bytes"> & { src: string },
) {
  const { src, ...rest } = props;
  const bytes = usePdfBytes(src);
  // `aria-busy` here keeps the busy chain gap-free from the story's very
  // first commit through to the first page painting — every later state
  // (engine loading, opening, ready-but-unpainted) is already busy; this is
  // the one the `async-content` visual-harness wait would otherwise miss.
  if (!bytes) {
    return (
      <div aria-busy="true" className="p-8 text-sm text-muted-foreground">
        Loading fixture…
      </div>
    );
  }
  return <PdfViewer {...rest} bytes={bytes} />;
}

export function StoryFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="h-[520px] w-[420px] overflow-hidden rounded-md border">{children}</div>;
}
