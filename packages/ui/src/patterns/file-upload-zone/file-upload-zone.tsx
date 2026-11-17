import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CloudArrowUpIcon as CloudArrowUp,
  EyeIcon as Eye,
  FileTextIcon as FileText,
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
  return "border-primary/40 bg-primary/[0.03] hover:border-primary hover:bg-primary/5 aria-invalid:border-destructive";
}

// ---------------------------------------------------------------------------
// Selected file
// ---------------------------------------------------------------------------

/** What the zone shows of a file: a picked `File`, or a file already stored on the server. */
export interface FileSummary {
  readonly name: string;
  /** Size in bytes. */
  readonly size: number;
  /** Media type; empty when unknown. */
  readonly type: string;
}

interface SelectedFileProps {
  file: FileSummary;
  disabled: boolean;
  previewed: boolean;
  compact: boolean;
  onPreview?: () => void;
  onFileClick?: () => void;
  onRemove: () => void;
}

function SelectedFile({
  file,
  disabled,
  previewed,
  compact,
  onPreview,
  onFileClick,
  onRemove,
}: Readonly<SelectedFileProps>) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // A thumbnail only for a picked image in the full card: a stored file's bytes are not loaded
  // here, and the compact card shows an icon.
  useEffect(() => {
    if (compact || !(file instanceof Blob) || !file.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, compact]);

  const actions = (
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
  );

  // The file's details are a button when `onFileClick` is given, else plain content.
  const withClick = (details: React.ReactNode) =>
    onFileClick ? (
      <button
        type="button"
        aria-current={previewed || undefined}
        onClick={onFileClick}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-sm text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {details}
      </button>
    ) : (
      <div className="flex min-w-0 flex-1 items-center gap-3">{details}</div>
    );

  // Two short lines next to a small icon tile: roomier than one line, far smaller than the full card.
  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border bg-card py-2 pr-1.5 pl-2",
          previewed && "border-primary bg-selected",
        )}
      >
        {withClick(
          <>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FileText className="size-5" aria-hidden />
            </span>
            <span className="block min-w-0 flex-1">
              <span className="block truncate text-sm leading-5 font-medium" title={file.name}>
                {file.name}
              </span>
              <span className="flex min-w-0 items-center gap-1 text-xs leading-4 text-muted-foreground">
                <span className="shrink-0 tabular-nums">{formatFileSize(file.size)}</span>
                {file.type && <span className="truncate">· {file.type}</span>}
              </span>
            </span>
          </>,
        )}
        {actions}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border p-3",
        previewed && "border-primary bg-selected",
      )}
    >
      {withClick(
        <>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Preview"
              className="h-20 w-20 shrink-0 rounded object-cover"
            />
          ) : (
            <UploadSimple className="h-5 w-5 text-muted-foreground" />
          )}
          <span className="block min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{file.name}</span>
            <span className="mt-0.5 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
              {file.type && (
                <Badge variant="outline" className="text-xs shrink-0">
                  {file.type}
                </Badge>
              )}
            </span>
          </span>
        </>,
      )}
      {actions}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FileUploadZoneProps {
  /** The picked or stored file, or null when there is none. */
  file: FileSummary | null;
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
  /** Called when the user clicks the picked file; makes the file a button. */
  onFileClick?: () => void;
  /** Marks the zone as the selected one of several, e.g. the one whose file is shown elsewhere. */
  previewed?: boolean;
  /** Shrinks the empty drop zone to a single line as tall as a text input, and the selected file
   * to a two-line card. */
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
  onFileClick,
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
        compact={compact}
        onPreview={onPreview}
        onFileClick={onFileClick}
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
