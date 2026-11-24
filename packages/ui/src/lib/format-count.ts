/** A total as the API reports it: exact, or an estimate (shown with a leading `~`). */
export interface CountLike {
  readonly count: number;
  readonly isEstimated: boolean;
}

/** Thin, non-breaking space (U+202F): "1 284" never wraps between its digit groups. */
const THOUSANDS_SEPARATOR = " ";

export interface FormatCountOptions {
  /**
   * How an estimate is marked: `"symbol"` (default) prefixes "~" ("~1 204", for tight places such
   * as a sidebar badge), `"word"` prefixes "about " ("about 1 204", for running text and pills).
   */
  readonly estimate?: "symbol" | "word";
}

/**
 * Formats a count for the interface, one way everywhere: exact "412", thousands grouped with a
 * thin no-break space "1 284", an estimate prefixed with "~" ("~1 204") or, with
 * `{ estimate: "word" }`, "about " ("about 1 204"), zero as "0".
 *
 * Returns `undefined` when there is no usable number (unknown or not allowed), so a caller can
 * render nothing instead of a placeholder.
 */
export function formatCount(
  total: CountLike | undefined | null,
  { estimate = "symbol" }: FormatCountOptions = {},
): string | undefined {
  if (!total || !Number.isFinite(total.count) || total.count < 0) {
    return undefined;
  }
  const digits = String(Math.trunc(total.count)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    THOUSANDS_SEPARATOR,
  );
  if (!total.isEstimated) return digits;
  return estimate === "word" ? `about ${digits}` : `~${digits}`;
}
