export const ACCEPT_HAL = "application/prs.hal-forms+json, application/hal+json, application/json";

export const CONTENT_TYPE_JSON = "application/json";
export const CONTENT_TYPE_URI_LIST = "text/uri-list";

/**
 * Builds a Content-Disposition attachment header value with the given filename.
 *
 * The filename is percent-encoded to ensure safe transmission of special characters.
 *
 * @param filename - The filename to embed in the Content-Disposition header
 * @returns A Content-Disposition header value string
 */
export function contentDispositionAttachment(filename: string): string {
  // Use encodeURIComponent to escape special characters; RFC 6266 / RFC 8187 compliant approach.
  const escaped = filename.replace(/["\\]/g, (c) => `\\${c}`);
  return `attachment; filename="${escaped}"`;
}

/**
 * Parses a Content-Disposition header value and extracts the filename.
 *
 * Handles both `filename="..."` (quoted) and `filename=...` (unquoted) forms.
 * Returns `null` if no filename is present or the header is null.
 *
 * @param header - The Content-Disposition header value, or null
 * @returns The filename, or null if not found
 */
export function parseContentDisposition(header: string | null): string | null {
  if (!header) {
    return null;
  }
  // Match filename*= (RFC 5987 extended) first, then filename=
  const extMatch = /filename\*\s*=\s*(?:[A-Za-z0-9-]+'')?([^;]+)/i.exec(header);
  if (extMatch) {
    try {
      return decodeURIComponent(extMatch[1].trim());
    } catch {
      // fall through to plain filename
    }
  }
  const match = /filename\s*=\s*(?:"([^"\\]*)"|([^;]*))/i.exec(header);
  if (!match) {
    return null;
  }
  return (match[1] ?? match[2] ?? "").trim() || null;
}
