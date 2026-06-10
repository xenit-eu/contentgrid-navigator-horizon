import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, RotateCw, Upload, X } from "lucide-react";
import { cn } from "../../lib/utils";
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

export function FileUploadZone({ file, onFileChange, accept }: Readonly<FileUploadZoneProps>) {
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

    return (
      <div className="rounded-[10px] border-[1.5px] border-dashed border-[#cdd6df] bg-card p-[22px] text-center">
        {previewUrl && isImage ? (
          <img
            src={previewUrl}
            alt="Preview"
            className="mx-auto h-20 w-20 rounded-md object-cover"
          />
        ) : (
          <FileText className="mx-auto size-[22px] text-[var(--cg-color-steel)]" />
        )}
        <p className="mt-2 truncate text-[13px] font-medium text-[var(--cg-color-midnight)]">
          {file.name}
        </p>
        <p className="mt-0.5 text-xs text-[var(--cg-color-text-dim)]">
          {formatFileSize(file.size)} · ready to upload on save
        </p>
        <div className="mt-2.5 flex justify-center gap-2">
          <Button
            variant="ghost"
            size="xs"
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-[var(--cg-color-text-dim)]"
          >
            <RotateCw />
            Replace
          </Button>
          <Button
            variant="ghost"
            size="xs"
            type="button"
            onClick={() => onFileChange(null)}
            className="text-[var(--cg-color-danger)] hover:text-[var(--cg-color-danger)]"
          >
            <X />
            Remove
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={acceptString}
          onChange={handleInputChange}
          tabIndex={-1}
          aria-hidden="true"
        />
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
          "flex w-full cursor-pointer flex-col items-center rounded-[10px] border-[1.5px] border-dashed bg-card p-[22px] text-center transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          isDragActive ? "border-ring bg-[var(--cg-color-sky-50)]" : "border-[#cdd6df]",
        )}
      >
        <Upload className="size-[22px] text-[var(--cg-color-steel)]" />
        <span className="mt-2 text-[13px] font-medium text-[var(--cg-color-midnight)]">
          {isDragActive ? "Drop the file here" : "Drop a file here"}
        </span>
        <span className="mt-0.5 text-xs text-[var(--cg-color-text-dim)]">
          or{" "}
          <span className="font-semibold text-[var(--cg-color-link-text)] underline">browse</span> ·
          PDF, DOCX, PNG up to 20 MB
        </span>
      </button>
    </>
  );
}
