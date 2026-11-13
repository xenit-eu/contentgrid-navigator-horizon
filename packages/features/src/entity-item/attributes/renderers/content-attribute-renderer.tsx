import type { ReactNode } from "react";
import { AttributeValue } from "@contentgrid/ui";

export interface ContentAttributeRendererProps {
  readonly metadata: { readonly filename: string | null; readonly length: number } | null;
  readonly icon?: ReactNode;
  /** Wrap a long file name onto more lines instead of cutting it off with an ellipsis. */
  readonly wrap?: boolean;
}

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

/** kB/MB/GB only — files stay in GB past that rather than growing a TB tier. */
function formatFileSize(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / KB).toFixed(1)} kB`;
}

export function ContentAttributeRenderer({
  metadata,
  icon,
  wrap,
}: Readonly<ContentAttributeRendererProps>) {
  if (metadata == null) {
    return <AttributeValue />;
  }

  const text = `${metadata.filename ?? "Untitled"} · ${formatFileSize(metadata.length)}`;
  // When a long file name is cut off with an ellipsis, the title shows the whole name.
  const value = (
    <span className="block min-w-0" title={text}>
      <AttributeValue wrap={wrap} className="text-xs text-muted-foreground/80">
        {text}
      </AttributeValue>
    </span>
  );

  if (!icon) {
    return value;
  }

  return (
    <span className="flex items-center gap-1.5">
      {icon}
      {value}
    </span>
  );
}
