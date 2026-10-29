/** `previewUnavailable`'s message names the actual file type instead of a generic "this file
 * type" whenever the mimetype is known. */
export function buildPreviewUnavailableMessage(mimetype: string | null | undefined): string {
  return mimetype
    ? `Preview isn't available for ${mimetype} files.`
    : "Preview isn't available for this file type.";
}
