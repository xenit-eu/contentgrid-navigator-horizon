import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { UploadSimpleIcon as UploadSimple, XIcon as X } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { Badge } from "../../primitives/badge";
import { Button } from "../../primitives/button";
import { Progress } from "../../primitives/progress";

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
    const showCancelButton = onCancelUpload !== undefined;
    const showRetryButton = onRetryUpload !== undefined && uploadError === true;
    const showRemoveButton = !showCancelButton && !showRetryButton;

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

  // -------------------------------------------------------------------------
  // Drop-zone view
  // -------------------------------------------------------------------------
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={acceptString}
        onChange={handleInputChange}
        tabIndex={-1}
        aria-hidden="true"
      />
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
