/**
 * Mimetype classification for content-attribute previews.
 *
 * A content attribute's `mimetype` metadata field decides whether the raw stored bytes
 * can be shown as they are — in the PDF viewer, an `<img>` or a `<video>`
 * (`nativePreviewKind`) — or must first go through the platform's rendition service
 * (`needsRendition`). Kept as pure string functions — no HAL,
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
 * How a stored file of this mimetype is shown as it is: in the PDF viewer (`pdf`), an `<img>`
 * (`image/*`) or a `<video>` (`video/*`). `undefined` when it must go through the rendition
 * service first.
 *
 * @example
 * nativePreviewKind("application/pdf; charset=binary") // "pdf"
 * nativePreviewKind("IMAGE/JPEG") // "image"
 * nativePreviewKind("video/mp4") // "video"
 * nativePreviewKind("application/msword") // undefined
 * nativePreviewKind(null) // undefined
 */
export function nativePreviewKind(
  mimetype: string | null | undefined,
): "pdf" | "image" | "video" | undefined {
  if (mimetype == null) {
    return undefined;
  }
  const normalized = normalize(mimetype);
  if (normalized === PDF_MIMETYPE) return "pdf";
  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("video/")) return "video";
  return undefined;
}

/**
 * Whether a stored file must go through the rendition service before it can be previewed:
 * everything `nativePreviewKind` cannot show as it is. That includes a missing mimetype and the
 * generic `application/octet-stream` / `binary/octet-stream` placeholders the platform uses when
 * it does not know the real type.
 *
 * @example
 * needsRendition("application/pdf") // false
 * needsRendition("image/png") // false
 * needsRendition("video/mp4") // false
 * needsRendition("application/vnd.openxmlformats-officedocument.wordprocessingml.document") // true
 * needsRendition("application/octet-stream") // true
 * needsRendition(null) // true
 */
export function needsRendition(mimetype: string | null | undefined): boolean {
  return nativePreviewKind(mimetype) === undefined;
}
