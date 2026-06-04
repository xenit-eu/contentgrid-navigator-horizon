import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Badge } from "../../primitives/badge";
import { Button } from "../../primitives/button";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ---------------------------------------------------------------------------
// PDF thumbnail (optional preview for PDF files)
// ---------------------------------------------------------------------------

/**
 * Renders a canvas preview of the first page of a PDF using pdfjs-dist.
 * Silently omits the thumbnail if pdfjs-dist is unavailable.
 */
function PdfThumbnail({ file }: { file: File }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        // pdfjs-dist is an optional peer — not declared as a dep here;
        // the dynamic import will succeed only if the consumer has it installed.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfjs: any = await import(/* @vite-ignore */ "pdfjs-dist" as string);
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.mjs",
          import.meta.url,
        ).toString();

        const data = new Uint8Array(await file.arrayBuffer());
        const doc = await pdfjs.getDocument({ data }).promise;
        const page = await doc.getPage(1);

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = 160 / unscaledViewport.width;
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext("2d")!;
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        if (!cancelled) setReady(true);
      } catch {
        // Silently fail — thumbnail just won't show
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [file]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("h-20 w-20 shrink-0 rounded border object-contain", !ready && "hidden")}
    />
  );
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FileUploadZoneProps {
  /** Currently selected file, or null when no file is selected */
  file: File | null;
  /** Called when the user selects or removes a file */
  onFileChange: (file: File | null) => void;
  /**
   * Optional MIME type accept filter, e.g. `{ "application/pdf": [".pdf"] }`.
   * Passed to the hidden `<input>` accept attribute (only keys are used).
   */
  accept?: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function FileUploadZone({ file, onFileChange, accept }: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Build the accept string for the hidden file input
  const acceptString = accept ? Object.keys(accept).join(",") : undefined;

  // Image preview URL lifecycle
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragActive(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) onFileChange(dropped);
    },
    [onFileChange],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) onFileChange(selected);
      // Reset the input value so the same file can be re-selected
      e.target.value = "";
    },
    [onFileChange],
  );

  // -------------------------------------------------------------------------
  // File selected view
  // -------------------------------------------------------------------------
  if (file) {
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";

    return (
      <div className="flex items-center gap-3 rounded-md border p-3">
        {previewUrl && isImage ? (
          <img src={previewUrl} alt="Preview" className="h-20 w-20 shrink-0 rounded object-cover" />
        ) : isPdf ? (
          <PdfThumbnail file={file} />
        ) : (
          <Upload className="h-5 w-5 text-muted-foreground" />
        )}
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
            {file.type && (
              <Badge variant="outline" className="text-xs shrink-0">
                {file.type}
              </Badge>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onFileChange(null)} type="button">
          <X className="h-4 w-4" />
          <span className="sr-only">Remove file</span>
        </Button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Drop-zone view
  // -------------------------------------------------------------------------
  return (
    <div
      role="button"
      tabIndex={0}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed p-8 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={acceptString}
        onChange={handleInputChange}
        tabIndex={-1}
      />
      <Upload className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        {isDragActive ? "Drop the file here" : "Drag & drop a file, or click to select"}
      </p>
    </div>
  );
}
