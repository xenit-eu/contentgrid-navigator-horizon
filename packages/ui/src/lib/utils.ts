import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

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
