import type { ReactNode } from "react";
import { FileIcon, FileImageIcon, FilePdfIcon } from "@phosphor-icons/react";
import { formatFileSize } from "../../lib/format-file-size";

interface FileCardProps {
  readonly name: string | null;
  readonly size: number;
  readonly type: string;
  /** Buttons shown at the end of the card, e.g. remove or replace. */
  readonly actions: ReactNode;
  /** Shown in place of the size and type line, e.g. upload progress, so the card keeps its height. */
  readonly detail?: ReactNode;
}

function FileTypeIcon({ type }: Readonly<{ type: string }>) {
  const className = "h-6 w-6 shrink-0 text-muted-foreground";
  if (type === "application/pdf") return <FilePdfIcon className={className} aria-hidden />;
  if (type.startsWith("image/")) return <FileImageIcon className={className} aria-hidden />;
  return <FileIcon className={className} aria-hidden />;
}

/** A file's icon, name, size and type. */
export function FileCard({ name, size, type, actions, detail }: Readonly<FileCardProps>) {
  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <FileTypeIcon type={type} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name ?? "Document"}</p>
        <div className="mt-0.5 flex h-4 items-center">
          {detail ?? (
            <p className="truncate text-xs text-muted-foreground">
              {type ? `${formatFileSize(size)} · ${type}` : formatFileSize(size)}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">{actions}</div>
    </div>
  );
}
