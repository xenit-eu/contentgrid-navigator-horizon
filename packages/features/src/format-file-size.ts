const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

/**
 * kB/MB/GB only — files stay in GB past that rather than growing a TB tier. Shared between
 * `ContentAttributeRenderer` (a content attribute's own display) and `use-column-visibility`'s
 * `buildRows` (the same content attribute, formatted as a table cell) — both need the identical
 * "filename · size" text.
 */
export function formatFileSize(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / KB).toFixed(1)} kB`;
}
