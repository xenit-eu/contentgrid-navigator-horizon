import type { ReactNode } from "react";
import { EyeIcon, LinkBreakIcon, PlusIcon } from "@phosphor-icons/react";
import { Button } from "../../primitives/button";
import { Skeleton } from "../../primitives/skeleton";
import { RecordRowAction } from "../record-table/record-row-action";
import { RelationAccordion } from "../relation-accordion/relation-accordion";
import { FieldMessage, RequiredMarker, fieldAriaProps } from "./field-shell";

export interface RelationToOneRendererProps {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description?: string;
  /** The linked item's href, or `""` when nothing is linked. */
  readonly value: string | undefined;
  readonly onChange: (value: string) => void;
  readonly error?: string;
  /** Summary of the linked item, rendered by the caller. */
  readonly linkedItem?: ReactNode;
  /** True while `linkedItem` is being resolved for a non-empty `value`. */
  readonly isLoading?: boolean;
  /** Opens the caller's item picker. The Link/Change button is hidden when absent. */
  readonly onLink?: () => void;
  /** Opens the linked item's details. The Details button is hidden when absent. */
  readonly onViewDetails?: () => void;
}

/**
 * A to-one relation field: a `RelationAccordion` (label, Link/Change/Unlink/Details actions)
 * around the linked item's summary. Unlink clears the value to `""`.
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
  onViewDetails,
}: Readonly<RelationToOneRendererProps>) {
  const hasValue = value !== undefined && value !== "";
  const isLinked = !isLoading && hasValue;

  return (
    <div className="space-y-1.5">
      <RelationAccordion
        title={
          <span id={`${name}-label`} className="inline-flex items-center gap-2">
            {label}
            {required && <RequiredMarker />}
          </span>
        }
        actions={
          <>
            {isLinked && onViewDetails && (
              <RecordRowAction
                label="Details"
                icon={<EyeIcon className="size-4" aria-hidden />}
                onClick={onViewDetails}
              />
            )}
            {isLinked && !readOnly && onLink && (
              <Button type="button" variant="outline" size="sm" onClick={onLink}>
                Change
              </Button>
            )}
            {isLinked && !readOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onChange("")}
              >
                <LinkBreakIcon className="size-4" />
                Unlink
              </Button>
            )}
            {!isLoading && !hasValue && !readOnly && onLink && (
              <Button type="button" variant="outline" size="sm" onClick={onLink}>
                <PlusIcon className="size-4" />
                Link
              </Button>
            )}
          </>
        }
      >
        <div role="group" aria-labelledby={`${name}-label`} {...fieldAriaProps(name, error)}>
          {isLoading && <Skeleton className="h-12 w-full rounded-md" />}
          {isLinked && linkedItem && (
            <div className="rounded-md border bg-muted/40 px-3 py-2.5">{linkedItem}</div>
          )}
          {!isLoading && !hasValue && (
            <p className="rounded-md border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
              No item linked
            </p>
          )}
        </div>
      </RelationAccordion>

      <FieldMessage name={name} description={description} error={error} />
    </div>
  );
}
