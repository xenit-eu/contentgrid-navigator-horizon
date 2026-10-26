import type { ReactNode } from "react";

/**
 * The bar above a preview that has no viewer toolbar of its own: `start` holds the attribute
 * selector, `end` the preview's actions. Its padding matches `PdfViewerToolbar`'s row, so the bar
 * lines up whichever preview is shown.
 */
export function ContentPreviewToolbar({
  start,
  end,
}: Readonly<{ start?: ReactNode; end?: ReactNode }>) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b px-2 py-1.5">
      {start}
      {end && <div className="ml-auto flex items-center gap-1">{end}</div>}
    </div>
  );
}
