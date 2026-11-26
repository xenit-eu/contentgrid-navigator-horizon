const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

/**
 * Formats a file size for the interface, one way everywhere: whole kilobytes ("412 KB"), then one
 * decimal from MB up ("1,4 MB" or "1.4 MB": the decimal separator follows the browser's locale,
 * like numbers do, or `locale` when given); under 1 KB the bytes ("512 B"). Binary units
 * (1 KB = 1024 bytes), capital K, and GB is the top tier: bigger files stay in GB.
 */
export function formatFileSize(bytes: number, locale?: string): string {
  const oneDecimal = (value: number) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
      value,
    );
  if (bytes >= GB) return `${oneDecimal(bytes / GB)} GB`;
  if (bytes >= MB || Math.round(bytes / KB) >= KB) return `${oneDecimal(bytes / MB)} MB`;
  if (bytes >= KB) return `${Math.round(bytes / KB)} KB`;
  return `${bytes} B`;
}
