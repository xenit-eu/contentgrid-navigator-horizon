import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CloudArrowUpIcon as CloudArrowUp,
  EyeIcon as Eye,
  UploadSimpleIcon as UploadSimple,
  XIcon as X,
} from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { Badge } from "../../primitives/badge";
import { buttonVariants } from "../../primitives/button";
import { TooltipProvider } from "../../primitives/tooltip";
import { ToolbarIconButton } from "../toolbar-icon-button";

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

function dropZoneStateClassName(isDragActive: boolean, previewed: boolean): string {
  if (isDragActive) return "border-primary bg-primary/10";
  if (previewed) return "border-solid border-primary bg-selected";
  return "border-primary/40 bg-primary/[0.03] hover:border-primary hover:bg-primary/5";
}

// ---------------------------------------------------------------------------
// Selected file
// ---------------------------------------------------------------------------

interface SelectedFileProps {
  file: File;
  disabled: boolean;
  previewed: boolean;
  onPreview?: () => void;
  onRemove: () => void;
}

function SelectedFile({
  file,
  disabled,
  previewed,
  onPreview,
  onRemove,
}: Readonly<SelectedFileProps>) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImage = file.type.startsWith("image/");

  // Image preview URL lifecycle
  useEffect(() => {
    if (!file.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div
      aria-current={previewed || undefined}
      className={cn(
        "flex items-center gap-3 rounded-md border p-3",
        previewed && "border-primary bg-selected",
      )}
    >
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
      </div>
      <TooltipProvider>
        {onPreview && (
          <ToolbarIconButton label="Preview file" onClick={onPreview}>
            <Eye className="h-4 w-4" />
          </ToolbarIconButton>
        )}
        {!disabled && (
          <ToolbarIconButton label="Remove file" onClick={onRemove}>
            <X className="h-4 w-4" />
          </ToolbarIconButton>
        )}
      </TooltipProvider>
    </div>
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
  /** Set on the drop-zone button, so a surrounding `<label htmlFor>` targets it. */
  id?: string;
  /** Blocks picking, dropping and removing a file. */
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Opens the file's preview; a selected file gets a "Preview file" button that calls it. */
  onPreview?: () => void;
  /** Marks the zone as the selected one of several, e.g. the one whose file is shown elsewhere. */
  previewed?: boolean;
  /** Shrinks the empty drop zone to a single line, as tall as a text input. */
  compact?: boolean;
  /** Makes the empty drop zone fill its container. */
  fill?: boolean;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function FileUploadZone({
  file,
  onFileChange,
  accept,
  id,
  disabled = false,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  onFocus,
  onBlur,
  onPreview,
  previewed = false,
  compact = false,
  fill = false,
}: Readonly<FileUploadZoneProps>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLButtonElement>(null);
  const focusDropZoneRef = useRef(false);
  const [isDragActive, setIsDragActive] = useState(false);

  // Build the accept string for the hidden file input
  const acceptString = accept ? Object.keys(accept).join(",") : undefined;

  // The remove button unmounts with the file, so hand its focus to the drop zone that replaces it.
  useEffect(() => {
    const shouldFocus = focusDropZoneRef.current;
    focusDropZoneRef.current = false;
    if (!file && shouldFocus) dropZoneRef.current?.focus();
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
    return (
      <SelectedFile
        file={file}
        disabled={disabled}
        previewed={previewed}
        onPreview={onPreview}
        onRemove={() => {
          focusDropZoneRef.current = true;
          onFileChange(null);
        }}
      />
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
        ref={dropZoneRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-current={previewed || undefined}
        // Without a preventDefault'ed dragover the browser refuses the drop.
        onDragOver={disabled ? undefined : handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={disabled ? undefined : handleDrop}
        onClick={() => inputRef.current?.click()}
        onFocus={onFocus}
        onBlur={onBlur}
        className={cn(
          "flex w-full flex-col disabled:cursor-not-allowed disabled:opacity-50 items-center gap-1 rounded-lg border border-dashed px-6 py-7 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          dropZoneStateClassName(isDragActive, previewed),
          compact && "h-9 flex-row gap-2 rounded-md py-0 pr-1.5 pl-3",
          fill && "h-full justify-center border-2",
        )}
      >
        <CloudArrowUp
          className={cn("mb-1 size-7 text-primary", fill && "size-10", compact && "mb-0 size-4")}
          aria-hidden
        />
        {compact ? (
          <>
            <span className="text-sm text-muted-foreground">
              {isDragActive ? "Release to attach" : "No file chosen"}
            </span>
            {/* Looks like a button; the whole field is the real button. */}
            <span className={cn(buttonVariants({ variant: "outline", size: "xs" }), "ml-auto")}>
              Choose file
            </span>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-foreground">
              {isDragActive ? "Release to attach" : "Drop a file here"}
            </p>
            <p className="text-xs text-muted-foreground">
              or{" "}
              <span className="font-medium text-primary underline underline-offset-2">
                choose one from your device
              </span>
            </p>
          </>
        )}
      </button>
    </>
  );
}
