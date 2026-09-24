import type { ReactNode } from "react";
import { PlusIcon } from "@phosphor-icons/react";
import { Button } from "../../primitives/button";
import { CountIndicatorChip } from "../../primitives/count-indicator-chip";
import { RelationAccordion } from "../relation-accordion/relation-accordion";
import { FieldMessage, RequiredMarker } from "./field-shell";

export interface RelationToManyRendererProps {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description?: string;
  readonly error?: string;
  /** Number of linked items, shown in the header chip. */
  readonly count: number;
  /** The linked-items table, rendered by the caller. */
  readonly children?: ReactNode;
  /** Opens the caller's item picker. The Link button is hidden when absent. */
  readonly onLink?: () => void;
  /** Clears every linked item. The Clear button is hidden when absent. */
  readonly onClear?: () => void;
}

/**
 * A to-many relation field: a `RelationAccordion` (count chip + label, "Link" and "Clear" actions)
 * around the caller's table of linked items — legacy `RelationCandidateTable`.
 */
export function RelationToManyRenderer({
  name,
  label,
  required,
  readOnly,
  description,
  error,
  count,
  children,
  onLink,
  onClear,
}: Readonly<RelationToManyRendererProps>) {
  return (
    <div className="space-y-1.5">
      <RelationAccordion
        title={
          <span className="inline-flex items-center gap-2">
            <CountIndicatorChip variant="solid" count={count} />
            {label}
            {required && <RequiredMarker />}
          </span>
        }
        actions={
          !readOnly && (
            <>
              {onClear && count > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={onClear}>
                  Clear
                </Button>
              )}
              {onLink && (
                <Button type="button" variant="outline" size="sm" onClick={onLink}>
                  <PlusIcon className="size-4" />
                  Link
                </Button>
              )}
            </>
          )
        }
      >
        {children}
      </RelationAccordion>

      <FieldMessage name={name} description={description} error={error} />
    </div>
  );
}
