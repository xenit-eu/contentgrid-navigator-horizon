/**
 * Shared attribute-value formatting utilities for the entity browser.
 *
 * Single source of truth for:
 *  - formatAttributeValue  — renders any attribute value as a React node
 *  - isDisplayableAttribute / pickDisplayAttributes — column/field filtering
 *  - SYSTEM_FIELDS / EXCLUDED_TYPES — shared constants
 */
import type { ReactNode } from "react";
import type { EntityAttribute } from "@contentgrid/navigator-data";
import { Badge } from "@contentgrid/ui";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Attribute types that add no value in list / detail views. */
export const EXCLUDED_TYPES = new Set(["content", "audit_metadata"]);

/**
 * Names of system-managed read-only attributes we skip in list + detail views.
 * Only filtered when `attr.readOnly === true`.
 */
export const SYSTEM_FIELDS = new Set([
  "id",
  "created_at",
  "created_by",
  "created_date",
  "modified_at",
  "modified_by",
  "modified_date",
  "updated_at",
  "updated_by",
]);

// ---------------------------------------------------------------------------
// Attribute filter helpers
// ---------------------------------------------------------------------------

/** Returns true when the attribute should be shown to the user. */
export function isDisplayableAttribute(attr: EntityAttribute): boolean {
  if (EXCLUDED_TYPES.has(attr.type)) return false;
  if (attr.readOnly && SYSTEM_FIELDS.has(attr.name)) return false;
  return true;
}

const MAX_COLUMNS = 6;

/**
 * Filters and optionally caps the attributes suitable for display.
 *
 * @param attrs - Full attribute list from the entity schema.
 * @param max   - Maximum number of attributes to return (default: MAX_COLUMNS).
 */
export function pickDisplayAttributes(
  attrs: EntityAttribute[],
  max: number = MAX_COLUMNS,
): EntityAttribute[] {
  return attrs.filter(isDisplayableAttribute).slice(0, max);
}

// ---------------------------------------------------------------------------
// Value formatter
// ---------------------------------------------------------------------------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * Format a single attribute value into a React node.
 *
 * @param value - Raw value from the entity data object.
 * @param type  - Attribute type string from the schema (e.g. "string", "date", "boolean").
 * @param opts  - Optional rendering hints:
 *   - `mono`: wrap object/JSON in a monospace span (default: false).
 *   - `italic`: apply italic to the empty-state "—" (default: false).
 */
export function formatAttributeValue(
  value: unknown,
  type: string,
  opts?: { mono?: boolean; italic?: boolean },
): ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className={`text-muted-foreground${opts?.italic ? " italic" : ""}`}>—</span>;
  }

  // Boolean — green/red pill
  if (type === "boolean") {
    const boolVal = Boolean(value);
    return (
      <Badge
        variant="outline"
        className={
          boolVal
            ? "border-transparent bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : "border-transparent bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        }
      >
        {boolVal ? "Yes" : "No"}
      </Badge>
    );
  }

  // Date / datetime — localised string
  if (type === "date" || type === "datetime") {
    return formatDateValue(value, type);
  }

  // Numbers — thousands-separated (no currency — Navigator is schema-driven)
  if (type === "long" || type === "double" || type === "number") {
    const num = Number(value);
    if (!isNaN(num)) return num.toLocaleString();
    return String(value);
  }

  // Objects — JSON, optionally mono
  if (typeof value === "object") {
    try {
      const json = JSON.stringify(value);
      return opts?.mono ? <span className="font-mono text-[12px]">{json}</span> : json;
    } catch {
      return "";
    }
  }

  // Heuristic: bare strings that look like ISO dates (for relation table values
  // where the attribute type may not be known)
  if (type === "string" && typeof value === "string" && ISO_DATE_RE.test(value)) {
    const hasTime = value.includes("T");
    return formatDateValue(value, hasTime ? "datetime" : "date");
  }

  return String(value);
}

/**
 * Format a single relation-table cell value to a plain STRING.
 *
 * RelationSection (in @contentgrid/ui) stringifies cell values with its own
 * internal formatter that does not localise dates/numbers, so we pre-format
 * here. Returns a string (never JSX) to stay compatible with that renderer.
 *
 * Value-based (not schema-based): detects numbers and ISO-date-looking strings
 * so the relation table matches the main collection table without an extra
 * per-relation schema fetch.
 */
export function formatRelationValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";

  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (typeof value === "number") return value.toLocaleString();

  if (typeof value === "string") {
    // Numeric string (e.g. "24800") — format with thousands separators.
    // Guard against empty/space-only strings which Number() coerces to 0.
    if (value.trim() !== "" && !isNaN(Number(value))) {
      return Number(value).toLocaleString();
    }
    // ISO-date-looking string — localise the same way as the main table.
    if (ISO_DATE_RE.test(value)) {
      return String(formatDateValue(value, value.includes("T") ? "datetime" : "date"));
    }
    return value;
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }

  return String(value);
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function formatDateValue(value: unknown, type: "date" | "datetime"): ReactNode {
  const str = typeof value === "string" ? value : String(value);
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      if (type === "date") {
        return d.toLocaleDateString(undefined, {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      }
      return d.toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  } catch {
    // fall through to raw string
  }
  return str;
}
