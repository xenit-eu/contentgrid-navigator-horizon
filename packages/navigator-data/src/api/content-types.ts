export const ACCEPT_HAL = "application/prs.hal-forms+json, application/hal+json, application/json";

export const CONTENT_TYPE_JSON = "application/json";
export const CONTENT_TYPE_URI_LIST = "text/uri-list";

/**
 * Builds a Content-Disposition attachment header value with the given filename.
 *
 * - ASCII filenames: emitted as `filename="..."` with only `"` and `\` backslash-escaped
 *   (RFC 6266 quoted-string encoding).
 * - Non-ASCII filenames: emitted as `filename*=UTF-8''<percent-encoded>` (RFC 5987 / RFC 8187
 *   extended notation, using `encodeURIComponent` for percent-encoding).
 *
 * @param filename - The filename to embed in the Content-Disposition header
 * @returns A Content-Disposition header value string
 */
export function contentDispositionAttachment(filename: string): string {
  const isAscii = [...filename].every((c) => c.charCodeAt(0) <= 127);
  if (isAscii) {
    // RFC 6266 quoted-string: backslash-escape only " and \
    const escaped = filename.replace(/["\\]/g, (c) => `\\${c}`);
    return `attachment; filename="${escaped}"`;
  }
  // RFC 5987 / RFC 8187 extended notation for non-ASCII filenames
  return `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;
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
  const extMatch = /filename\*\s*=\s*(?:[a-z0-9-]+'')?([^;]+)/i.exec(header);
  if (extMatch) {
    try {
      return decodeURIComponent(extMatch[1].trim());
    } catch {
      // fall through to plain filename
    }
  }
  // Quoted-string branch handles backslash-escape sequences (e.g. \" and \\).
  const match = /filename\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;]*))/i.exec(header);
  if (!match) {
    return null;
  }
  const quoted = match[1];
  const unquoted = match[2];
  if (quoted !== undefined) {
    // Unescape backslash sequences: \" → ", \\ → \, etc.
    return quoted.replace(/\\(.)/g, "$1") || null;
  }
  return (unquoted ?? "").trim() || null;
}
