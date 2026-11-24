import type { ReactNode } from "react";
import { AttributeValue, formatFileSize } from "@contentgrid/ui";
import { FileTile } from "./file-tile";
import type { AttributeRendererVariant } from "./variant";

export interface ContentAttributeRendererProps {
  readonly metadata: {
    readonly filename: string | null;
    readonly length: number;
    readonly mimetype?: string;
  } | null;
  readonly icon?: ReactNode;
  /** Wrap a long file name onto more lines instead of cutting it off with an ellipsis. */
  readonly wrap?: boolean;
  /**
   * `"collection-table"` (the collection page's column) shows a 24px file tile before the text,
   * the text in the normal colour and the size as "412 KB"; the other variants keep the small
   * muted text and the size as "412.0 kB".
   */
  readonly variant?: AttributeRendererVariant;
}

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

/** kB/MB/GB only — files stay in GB past that rather than growing a TB tier. */
function formatLegacyFileSize(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / KB).toFixed(1)} kB`;
}

export function ContentAttributeRenderer({
  metadata,
  icon,
  wrap,
  variant = "default",
}: Readonly<ContentAttributeRendererProps>) {
  if (metadata == null) {
    return <AttributeValue />;
  }

  const isColumn = variant === "collection-table";
  const fileIcon =
    icon ?? (isColumn ? <FileTile size="sm" mimetype={metadata.mimetype} /> : undefined);
  const text = `${metadata.filename ?? "Untitled"} · ${isColumn ? formatFileSize(metadata.length) : formatLegacyFileSize(metadata.length)}`;
  // When a long file name is cut off with an ellipsis, the title shows the whole name.
  const value = (
    <span className="block min-w-0" title={text}>
      <AttributeValue
        wrap={wrap}
        className={isColumn ? "text-[13px]" : "text-xs text-muted-foreground/80"}
      >
        {text}
      </AttributeValue>
    </span>
  );

  if (!fileIcon) {
    return value;
  }

  return (
    <span className="flex items-center gap-1.5">
      {fileIcon}
      {value}
    </span>
  );
}
