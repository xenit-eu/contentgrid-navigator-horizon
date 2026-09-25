import * as React from "react";
import { useRef } from "react";
import { FileArrowUpIcon, UploadSimpleIcon, XIcon } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { AttributeValue } from "../../primitives/attribute-value";
import { Button } from "../../primitives/button";
import { FileCard } from "./file-card";
import { UploadProgress } from "./upload-progress";
import { useFileDrop } from "./use-file-drop";

/** Metadata of the file shown in a `FileUpload` — the server's content metadata or a picked file's. */
interface CurrentFileMetadata {
  readonly filename: string | null;
  readonly mimetype: string;
  readonly length: number;
}

/** State of an in-flight or failed upload (progress 0–100). */
type FileUploadStatus =
  | { readonly isLoading: false; readonly error: Error | null }
  | { readonly isLoading: true; readonly error: null; readonly progress: number };

interface FileUploadProps {
  /** The file to show, or null when there is none. */
  readonly currentFileMetadata: CurrentFileMetadata | null;
  readonly status?: FileUploadStatus | null;
  /** Called with a picked or dropped file, or with null when the shown file is removed/cancelled. */
  readonly onUpload: (file: File | null) => void;
  /** Shown as a "Retry" button while `status.error` is set. */
  readonly onRetry?: () => void;
  /**
   * `"form"`: a dashed drop zone when empty, and the card's X removes the file.
   * `"inline"`: an Upload icon when empty, and the card offers a Replace icon — for a value that is
   * already stored and can only be overwritten, not removed.
   */
  readonly variant?: "form" | "inline";
}

/** A hidden file input plus a function that opens it. */
function useFilePicker(onPick: (file: File) => void) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) onPick(selected);
    // Reset so the same file can be picked again.
    e.target.value = "";
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      className="sr-only"
      onChange={handleChange}
      tabIndex={-1}
      aria-hidden="true"
    />
  );

  return { input, open: () => inputRef.current?.click() };
}

function PickFileButton({
  label,
  onPick,
}: Readonly<{ label: string; onPick: (file: File) => void }>) {
  const picker = useFilePicker(onPick);
  return (
    <>
      {picker.input}
      <Button variant="ghost" size="icon-sm" type="button" title={label} onClick={picker.open}>
        <FileArrowUpIcon />
        <span className="sr-only">{label}</span>
      </Button>
    </>
  );
}

function ClearButton({ label, onClick }: Readonly<{ label: string; onClick: () => void }>) {
  return (
    <Button variant="ghost" size="icon-sm" type="button" onClick={onClick}>
      <XIcon />
      <span className="sr-only">{label}</span>
    </Button>
  );
}

const dropHint = (text: string) => <span className="text-xs text-primary">{text}</span>;

/** Pick or drop a single file, and show it as a card with upload progress. */
export function FileUpload({
  currentFileMetadata,
  status,
  onUpload,
  onRetry,
  variant = "form",
}: Readonly<FileUploadProps>) {
  const isLoading = status?.isLoading === true;
  const error = status?.isLoading === false ? status.error : null;
  // Dropping a file uploads it, except while an upload is already in flight.
  const { isDragActive, dropProps } = useFileDrop(isLoading ? null : onUpload);
  const dropClassName = cn("rounded-md", isDragActive && "bg-primary/5 ring-2 ring-primary");
  const picker = useFilePicker(onUpload);

  if (currentFileMetadata) {
    return (
      <div {...dropProps} className={dropClassName}>
        <FileCard
          name={currentFileMetadata.filename}
          size={currentFileMetadata.length}
          type={currentFileMetadata.mimetype}
          detail={
            status?.isLoading ? (
              <UploadProgress progress={status.progress} />
            ) : isDragActive ? (
              dropHint("Drop to replace the file")
            ) : undefined
          }
          actions={
            isLoading ? (
              <ClearButton label="Cancel upload" onClick={() => onUpload(null)} />
            ) : error ? (
              <>
                {onRetry && (
                  <Button variant="ghost" size="sm" type="button" onClick={onRetry}>
                    Retry
                  </Button>
                )}
                <ClearButton label="Discard upload" onClick={() => onUpload(null)} />
              </>
            ) : variant === "inline" ? (
              <PickFileButton label="Replace file" onPick={onUpload} />
            ) : (
              <ClearButton label="Remove file" onClick={() => onUpload(null)} />
            )
          }
        />
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <span {...dropProps} className={cn("flex items-center gap-1.5", dropClassName)}>
        {isDragActive ? dropHint("Drop to upload a file") : <AttributeValue />}
        <PickFileButton label="Upload file" onPick={onUpload} />
      </span>
    );
  }

  return (
    <>
      {picker.input}
      <button
        type="button"
        {...dropProps}
        onClick={picker.open}
        className={cn(
          "flex w-full cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed p-8 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50",
        )}
      >
        <UploadSimpleIcon className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {isDragActive ? "Drop the file here" : "Drag & drop a file, or click to select"}
        </p>
      </button>
    </>
  );
}
