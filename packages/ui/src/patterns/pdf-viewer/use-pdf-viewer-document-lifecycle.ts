import { useEffect, useMemo, useState } from "react";
import { useDocumentState } from "@embedpdf/core/react";
import { PdfErrorCode, ignore } from "@embedpdf/models";
import { useDocumentManagerCapability } from "@embedpdf/plugin-document-manager/react";

export type PdfDocumentPhase = "idle" | "opening" | "ready" | "protected" | "invalid";

export interface UseDocumentLifecycleOptions {
  /** The document bytes to display; a new reference (re)opens the document. */
  bytes: ArrayBuffer;
  /** Used as the document's display name inside the engine (not a URL). */
  filename: string;
}

export interface DocumentLifecycleState {
  readonly documentId: string | null;
  readonly documentState: PdfDocumentPhase;
}

/**
 * Opens/closes the document as `bytes` changes and derives the document's
 * phase. Deliberately does **not** touch the scroll or zoom plugins: both
 * throw ("Zoom state not found for document: ...") when queried for a
 * document id that was never registered, so — unlike `useDocumentState`,
 * which is documented to accept `null` — they must only ever be called with
 * a real, already-open document id. `usePdfViewerActiveState`
 * (`use-pdf-viewer-state.ts`) is the half of this hook family that is safe to
 * call only once `documentId` is known; `pdf-viewer.tsx` mounts the
 * component that calls it conditionally on that. Split into its own file:
 * it has no dependency on, and nothing else depends on, `usePdfViewerActiveState`'s
 * internals — only `documentId`/`documentState` cross that boundary, both
 * already plain values.
 */
export function useDocumentLifecycle({
  bytes,
  filename,
}: UseDocumentLifecycleOptions): DocumentLifecycleState {
  const { provides: documentManager } = useDocumentManagerCapability();
  const [documentId, setDocumentId] = useState<string | null>(null);
  // "opening" is set the moment `openDocumentBuffer` is called, not only
  // once a document id comes back — the open call itself can take a beat.
  const [localPhase, setLocalPhase] = useState<"idle" | "opening" | "invalid" | "protected">(
    "idle",
  );

  const rawDocumentState = useDocumentState(documentId);

  // -----------------------------------------------------------------------
  // Open the document whenever `bytes` (re)opens; close-after-open guard
  // (upstream #754: closing a still-loading document leaks). A document is
  // only ever closed once we actually hold its id — either by this effect's
  // own cleanup, or, if the id only becomes known after the effect was
  // already cleaned up (React Strict-Mode double-invoke, or `bytes`
  // changing again before the previous open settled), by the success
  // callback itself noticing it is stale and closing what it just opened.
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!documentManager) {
      setLocalPhase("idle");
      return;
    }

    let cancelled = false;
    let openedDocumentId: string | null = null;

    setDocumentId(null);
    setLocalPhase("opening");

    const openTask = documentManager.openDocumentBuffer({ buffer: bytes, name: filename });
    openTask.wait(
      (response) => {
        if (cancelled) {
          documentManager.closeDocument(response.documentId);
          return;
        }
        openedDocumentId = response.documentId;
        setDocumentId(response.documentId);
      },
      (error) => {
        if (cancelled) return;
        setLocalPhase(error.reason.code === PdfErrorCode.Password ? "protected" : "invalid");
      },
    );

    return () => {
      cancelled = true;
      if (openedDocumentId) {
        documentManager.closeDocument(openedDocumentId).wait(ignore, ignore);
      }
    };
  }, [documentManager, bytes, filename]);

  const documentState: PdfDocumentPhase = useMemo(() => {
    if (localPhase === "invalid" || localPhase === "protected") return localPhase;
    if (!documentId) return localPhase;
    if (!rawDocumentState) return "opening";
    switch (rawDocumentState.status) {
      case "loading":
        return "opening";
      case "loaded":
        return "ready";
      case "error":
        return rawDocumentState.errorCode === PdfErrorCode.Password ? "protected" : "invalid";
      default:
        return "opening";
    }
  }, [localPhase, documentId, rawDocumentState]);

  return { documentId, documentState };
}
