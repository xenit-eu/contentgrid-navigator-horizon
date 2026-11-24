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
   * `"table"` (a collection column) shows a 24px file tile before the text and the text in the
   * normal colour; the other variants keep the small muted text.
   */
  readonly variant?: AttributeRendererVariant;
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

  const isColumn = variant === "table";
  const fileIcon =
    icon ?? (isColumn ? <FileTile size="sm" mimetype={metadata.mimetype} /> : undefined);
  const text = `${metadata.filename ?? "Untitled"} · ${formatFileSize(metadata.length)}`;
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
