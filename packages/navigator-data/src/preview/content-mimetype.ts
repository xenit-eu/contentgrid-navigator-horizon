/**
 * Mimetype classification for content-attribute previews.
 *
 * A content attribute's `mimetype` metadata field decides whether the raw stored bytes
 * can be handed straight to the PDF viewer (`isPdfMimetype`) or must first go through the
 * platform's rendition service (`needsRendition`). Kept as pure string functions — no HAL,
 * no React — so both `useContentPreview` (navigator-data) and any future non-hook caller
 * (e.g. a file-type icon) can reuse the same classification.
 */

const PDF_MIMETYPE = "application/pdf";

/**
 * Strips any `;`-delimited parameters (e.g. `; charset=binary`), trims surrounding
 * whitespace, and lowercases — the normalised form every classification below compares
 * against. Mirrors how `useDownloadContent` already reads the `Content-Type` response
 * header (see `hooks/item/use-content.ts`), just without the case-folding that header
 * parsing didn't need.
 */
function normalize(mimetype: string): string {
  return (mimetype.split(";")[0] ?? "").trim().toLowerCase();
}

/**
 * Whether a mimetype identifies a PDF document, ready to hand to the viewer as-is.
 *
 * `null`/`undefined` (no mimetype known) is treated as "not a PDF" — the caller falls
 * back to `needsRendition`'s `true` result for the same input, so the two functions never
 * disagree about a mimetype's rendition need.
 *
 * @example
 * isPdfMimetype("application/pdf") // true
 * isPdfMimetype("application/pdf; charset=binary") // true
 * isPdfMimetype("APPLICATION/PDF") // true
 * isPdfMimetype(null) // false
 */
export function isPdfMimetype(mimetype: string | null | undefined): boolean {
  if (mimetype == null) {
    return false;
  }
  return normalize(mimetype) === PDF_MIMETYPE;
}

/**
 * Whether a mimetype requires the rendition service before it can be previewed as PDF.
 *
 * Simply `!isPdfMimetype(mimetype)` — every non-PDF mimetype needs a rendition, including
 * a missing mimetype and the generic `application/octet-stream` / `binary/octet-stream`
 * placeholders the platform uses when it does not know the real type.
 *
 * @example
 * needsRendition("application/pdf") // false
 * needsRendition("application/vnd.openxmlformats-officedocument.wordprocessingml.document") // true
 * needsRendition("application/octet-stream") // true
 * needsRendition(null) // true
 */
export function needsRendition(mimetype: string | null | undefined): boolean {
  return !isPdfMimetype(mimetype);
}
