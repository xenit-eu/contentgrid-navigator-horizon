import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** The `--text-*` font sizes `preset.css` adds to the theme. */
const fontSizes = ["ui", "card-title"];

const twMerge = extendTailwindMerge({ extend: { theme: { text: fontSizes } } });

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Render an arbitrary cell value as display text.
 *
 * - `null` / `undefined` → an em dash placeholder.
 * - primitives → their string form.
 * - objects/arrays → a JSON representation rather than the useless
 *   `[object Object]` that `String(value)` would produce.
 */
export function formatCellValue(value: unknown, placeholder = "—"): string {
  if (value == null) return placeholder;
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return placeholder;
    }
  }
  return String(value);
}
