import type { ReactNode } from "react";
import { AttributeValue } from "@contentgrid/ui";

export interface ContentAttributeRendererProps {
  readonly metadata: { readonly filename: string | null; readonly length: number } | null;
  readonly icon?: ReactNode;
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
}: Readonly<ContentAttributeRendererProps>) {
  if (metadata == null) {
    return <AttributeValue />;
  }

  const text = `${metadata.filename ?? "Untitled"} · ${formatFileSize(metadata.length)}`;
  const value = (
    <AttributeValue className="text-xs text-muted-foreground/80">{text}</AttributeValue>
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
