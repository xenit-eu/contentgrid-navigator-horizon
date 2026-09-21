import * as React from "react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { UploadSimpleIcon as UploadSimple, XIcon as X } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { Badge } from "../../primitives/badge";
import { Button } from "../../primitives/button";
import { Progress } from "../../primitives/progress";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats a byte count as `"B"`/`"KB"`/`"MB"`/`"GB"`, the single implementation shared by
 * every file-size display in this package — do not re-derive this in a consuming feature.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ContentUploadFieldProps {
  /** Currently selected file, or null when no file is selected */
  file: File | null;
  /** Called when the user selects or removes a file */
  onFileChange: (file: File | null) => void;
  /**
   * Optional MIME type accept filter, e.g. `{ "application/pdf": [".pdf"] }`.
   * Passed to the hidden `<input>` accept attribute (only keys are used).
   */
  accept?: Record<string, string[]>;
  /** Upload progress 0–100. When defined, renders a progress bar below the file name. */
  uploadProgress?: number;
  /** When true, shows an error indicator below the file name. */
  uploadError?: boolean;
  /** Replaces the Remove button with a Cancel button during upload. */
  onCancelUpload?: () => void;
  /** Shows a Retry button when combined with uploadError. */
  onRetryUpload?: () => void;
  /**
   * Only affects the `file === null` view:
   * - `"default"` (default) — a full drag-and-drop box, for a standalone form field.
   * - `"compact"` — a small icon-only trigger button (no drop zone), for inline use next to
   *   existing content, e.g. a "Replace" affordance in a table cell.
   *
   * The file-selected view (name, size, progress, cancel/retry/remove) is identical either way —
   * this only changes how a file gets picked in the first place.
   */
  variant?: "default" | "compact";
  /** Accessible label for the compact trigger button. Ignored for `variant: "default"`. */
  triggerLabel?: string;
  /**
   * Icon for the compact trigger button. Defaults to an upload icon; callers using `compact`
   * for a "replace this existing value" affordance (rather than a first-time upload) should
   * pass something that reads as "change this" instead — e.g. a pencil icon — since an upload
   * icon next to a value that already exists doesn't clearly signal that clicking it replaces
   * it. Ignored for `variant: "default"`.
   */
  triggerIcon?: ReactNode;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function ContentUploadField({
  file,
  onFileChange,
  accept,
  uploadProgress,
  uploadError,
  onCancelUpload,
  onRetryUpload,
  variant = "default",
  triggerLabel = "Select file",
  triggerIcon = <UploadSimple />,
}: Readonly<ContentUploadFieldProps>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Build the accept string for the hidden file input
  const acceptString = accept ? Object.keys(accept).join(",") : undefined;

  // Image preview URL lifecycle
  useEffect(() => {
    if (!file?.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLButtonElement>) => {
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
    // Cancel only makes sense while something is actually in flight — never once it has
    // already errored, even if a caller passes onCancelUpload unconditionally.
    const showCancelButton = onCancelUpload !== undefined && uploadError !== true;
    const showRetryButton = onRetryUpload !== undefined && uploadError === true;
    // Remove is the escape hatch whenever Cancel isn't available — including alongside Retry,
    // so a permanently-failing upload never traps the user with no way back except retrying
    // the same file forever.
    const showRemoveButton = !showCancelButton;

    return (
      <div className="flex items-center gap-3 rounded-md border p-3">
        {previewUrl && isImage ? (
          <img src={previewUrl} alt="Preview" className="h-20 w-20 shrink-0 rounded object-cover" />
        ) : (
          <UploadSimple className="h-5 w-5 text-muted-foreground" />
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
          {uploadProgress !== undefined && !uploadError && (
            <Progress value={uploadProgress} aria-label="Upload progress" className="mt-2" />
          )}
          {uploadError && <p className="mt-1 text-xs text-destructive">Upload failed</p>}
        </div>
        {showCancelButton && (
          <Button variant="ghost" size="icon" onClick={onCancelUpload} type="button">
            <X className="h-4 w-4" />
            <span className="sr-only">Cancel upload</span>
          </Button>
        )}
        {showRetryButton && (
          <Button variant="ghost" size="sm" onClick={onRetryUpload} type="button">
            Retry
          </Button>
        )}
        {showRemoveButton && (
          <Button variant="ghost" size="icon" onClick={() => onFileChange(null)} type="button">
            <X className="h-4 w-4" />
            <span className="sr-only">Remove file</span>
          </Button>
        )}
      </div>
    );
  }

  // The single hidden file input backing BOTH no-file views below — one implementation of
  // "pick a file, then reset the input so the same file can be re-selected" for the whole
  // package, rather than a consuming feature hand-rolling its own copy.
  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      className="sr-only"
      accept={acceptString}
      onChange={handleInputChange}
      tabIndex={-1}
      aria-hidden="true"
    />
  );

  // -------------------------------------------------------------------------
  // Compact trigger — icon-only button, no drop zone (e.g. inline "Replace")
  // -------------------------------------------------------------------------
  if (variant === "compact") {
    return (
      <>
        {hiddenInput}
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          onClick={() => inputRef.current?.click()}
        >
          {triggerIcon}
          <span className="sr-only">{triggerLabel}</span>
        </Button>
      </>
    );
  }

  // -------------------------------------------------------------------------
  // Drop-zone view
  // -------------------------------------------------------------------------
  return (
    <>
      {hiddenInput}
      <button
        type="button"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex w-full cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed p-8 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50",
        )}
      >
        <UploadSimple className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {isDragActive ? "Drop the file here" : "Drag & drop a file, or click to select"}
        </p>
      </button>
    </>
  );
}
