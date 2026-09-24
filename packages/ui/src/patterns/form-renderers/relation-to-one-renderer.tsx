import type { ReactNode } from "react";
import { EyeIcon } from "@phosphor-icons/react";
import type { FieldValue } from "@contentgrid/navigator-data/field-value";
import { Button } from "../../primitives/button";
import { Label } from "../../primitives/label";
import { Skeleton } from "../../primitives/skeleton";
import { RecordRowAction } from "../record-table/record-row-action";
import { FieldMessage, RequiredMarker, fieldAriaProps } from "./field-shell";

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
  /** Summary of the linked item (e.g. an `EntityItemReference`), rendered by the caller. */
  readonly linkedItem?: ReactNode;
  /** True while `linkedItem` is being resolved for a non-empty `value`. */
  readonly isLoading?: boolean;
  /** Opens the caller's item picker. The Link/Change button is hidden when absent. */
  readonly onLink?: () => void;
  /** Opens the linked item's details. The Details button is hidden when absent. */
  readonly onViewDetails?: () => void;
}

/** A to-one relation field: the linked item's summary plus Link/Change/Unlink (clears to `""`). */
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
  onViewDetails,
}: Readonly<RelationToOneRendererProps>) {
  const hasValue = typeof value === "string" && value !== "";

  return (
    <div className="space-y-1.5">
      <Label id={`${name}-label`}>
        {label}
        {required && <RequiredMarker />}
      </Label>

      <div
        role="group"
        aria-labelledby={`${name}-label`}
        {...fieldAriaProps(name, error)}
        className="space-y-2"
      >
        {isLoading && <Skeleton className="h-12 w-full rounded-md" />}

        {!isLoading && hasValue && linkedItem && (
          <div className="flex items-center justify-between gap-2 rounded-md border p-3">
            <div className="min-w-0 flex-1">{linkedItem}</div>
            <div className="flex shrink-0 items-center gap-2">
              {onViewDetails && (
                <RecordRowAction
                  label="Details"
                  icon={<EyeIcon className="size-4" aria-hidden />}
                  onClick={onViewDetails}
                />
              )}
              {!readOnly && onLink && (
                <Button type="button" variant="outline" size="sm" onClick={onLink}>
                  Change
                </Button>
              )}
              {!readOnly && (
                <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
                  Unlink
                </Button>
              )}
            </div>
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
