import type { ReactNode } from "react";
import type { FieldValue } from "@contentgrid/navigator-data/field-value";
import { Button } from "../../primitives/button";
import { Label } from "../../primitives/label";
import { Skeleton } from "../../primitives/skeleton";
import { FieldMessage, RequiredMarker } from "./field-shell";

export interface RelationToOneRendererProps {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description?: string;
  /** The linked item's href, or `""` when nothing is linked. */
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly error?: string;
  /**
   * Pre-rendered summary of the currently linked item (e.g. an `EntityItemReference`) —
   * `undefined` when `value` is `""`, or while a non-empty `value`'s summary is still loading.
   * Resolving `value` (a href) into a summary is a fetching concern that stays in the caller
   * (see this package's CLAUDE.md) — this component never sees the linked `EntityItem` itself.
   */
  readonly linkedItem?: ReactNode;
  /** True while `linkedItem` is being resolved for a non-empty `value`. */
  readonly isLoading?: boolean;
  /**
   * Opens the caller's item picker (e.g. `RelationItemSearchDialog`) for linking/changing the
   * item. `undefined` when the caller isn't ready to open a picker yet (e.g. the target profile
   * hasn't resolved) — the Link/Change button hides itself rather than being wired to a handler
   * that would silently do nothing, mirroring how the edit-view's `RelationToOneSection` hides
   * its own Link button under the same condition.
   */
  readonly onLink?: () => void;
}

/**
 * Renders a to-one relation field: the currently linked item's summary (if any) plus
 * Link/Change/Unlink actions. Unlinking is just clearing the value back to `""` — no separate
 * callback needed, the same way `EnumRenderer`'s "(none)" option clears its own value directly.
 */
export function RelationToOneRenderer({
  name,
  label,
  required,
  readOnly,
  description,
  value,
  onChange,
  error,
  linkedItem,
  isLoading = false,
  onLink,
}: Readonly<RelationToOneRendererProps>) {
  const hasValue = typeof value === "string" && value !== "";

  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {required && <RequiredMarker />}
      </Label>

      <div id={name} className="space-y-2">
        {isLoading && <Skeleton className="h-12 w-full rounded-md" />}

        {!isLoading && hasValue && linkedItem && (
          <div className="flex items-center justify-between gap-2 rounded-md border p-3">
            <div className="min-w-0 flex-1">{linkedItem}</div>
            {!readOnly && (
              <div className="flex shrink-0 gap-2">
                {onLink && (
                  <Button type="button" variant="outline" size="sm" onClick={onLink}>
                    Change
                  </Button>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
                  Unlink
                </Button>
              </div>
            )}
          </div>
        )}

        {/* `hasValue` but `linkedItem` never resolved: the linked item couldn't be loaded (e.g.
         * it was deleted server-side). Still surfaced with an Unlink action — otherwise a broken
         * reference could never be cleared from this field. */}
        {!isLoading && hasValue && !linkedItem && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-destructive/50 p-3">
            <p className="text-sm text-muted-foreground">Couldn't load linked item</p>
            {!readOnly && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
                Unlink
              </Button>
            )}
          </div>
        )}

        {!isLoading && !hasValue && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-dashed p-3">
            <p className="text-sm text-muted-foreground">No item linked</p>
            {!readOnly && onLink && (
              <Button type="button" variant="outline" size="sm" onClick={onLink}>
                Link
              </Button>
            )}
          </div>
        )}
      </div>

      <FieldMessage name={name} description={description} error={error} />
    </div>
  );
}
