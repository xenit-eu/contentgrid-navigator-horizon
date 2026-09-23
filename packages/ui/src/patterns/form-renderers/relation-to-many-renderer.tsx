import { useState } from "react";
import { LinkBreakIcon, PlusIcon } from "@phosphor-icons/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../primitives/alert-dialog";
import { Button } from "../../primitives/button";
import { CountIndicatorChip } from "../../primitives/count-indicator-chip";
import { DataTable, type DataTableColumn, type DataTableRow } from "../data-table";
import { RelationAccordion } from "../relation-accordion/relation-accordion";
import { FieldMessage, RequiredMarker } from "./field-shell";

export interface RelationToManyRendererProps {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description?: string;
  readonly error?: string;
  /** The related (target) entity's name/title — forwarded to `DataTable`, which uses it in its
   * Unlink confirmation dialog's title/body text ("Unlink {entityTitle}? ..."). `DataTable`'s own
   * empty-state fallback (which also reads these) never renders here, since an empty relation
   * shows its own "No items linked" text instead of mounting `DataTable` at all. */
  readonly entityName: string;
  readonly entityTitle: string;
  /** Same shape `packages/features`'s `buildColumns` produces for the edit-view's relation
   * table (`RelationToManySection`) — passing the identical columns is what keeps this table's
   * structure uniform with that one, matching legacy Navigator's `CollectionSearchTable` being
   * literally the same component in both the create-form and the edit-view. */
  readonly columns: DataTableColumn[];
  /**
   * One row per resolved linked item — `id` is that item's href (not its entity id): unlike the
   * edit-view relation table (which unlinks an existing relation link by entity id via a
   * mutation), this table's rows describe not-yet-submitted local state, so the href IS the
   * value being edited and is what `onUnlink` reports back.
   */
  readonly rows: DataTableRow[];
  /** Called with a row's href (== `DataTableRow.id`) when its Unlink action is used. */
  readonly onUnlink: (href: string) => void;
  /**
   * Opens the caller's item picker (e.g. `RelationItemSearchDialog`) for linking another item.
   * `undefined` when the caller isn't ready to open a picker yet (e.g. the target profile hasn't
   * resolved) — the header's Link button hides itself rather than being wired to a handler that
   * would silently do nothing.
   */
  readonly onLinkMore?: () => void;
  /**
   * Clears every linked item at once, from a header "Unlink all" action (behind its own confirm
   * dialog, mirroring the edit-view's `RelationToManySection`). `undefined` hides the action —
   * same "presence decides visibility" convention as `onLinkMore`.
   */
  readonly onUnlinkAll?: () => void;
}

/**
 * Renders a to-many relation field as a `RelationAccordion` around a `DataTable` of the
 * currently linked items — the same accordion-header-plus-table pattern
 * `RelationToManySection` uses for an existing entity's relation (count chip + title on the
 * left, a "Link" action on the right), so a create-form relation field and its edit-view
 * counterpart look and behave the same way.
 */
export function RelationToManyRenderer({
  name,
  label,
  required,
  readOnly,
  description,
  error,
  entityName,
  entityTitle,
  columns,
  rows,
  onUnlink,
  onLinkMore,
  onUnlinkAll,
}: Readonly<RelationToManyRendererProps>) {
  const [confirmUnlinkAll, setConfirmUnlinkAll] = useState(false);
  const canUnlinkAll = !readOnly && !!onUnlinkAll && rows.length > 0;

  return (
    <div className="space-y-1.5">
      <RelationAccordion
        defaultOpen={rows.length > 0}
        title={
          <span className="inline-flex items-center gap-2">
            <CountIndicatorChip variant="solid" count={rows.length} />
            {label}
            {required && <RequiredMarker />}
          </span>
        }
        actions={
          <>
            {!readOnly && onLinkMore && (
              <Button type="button" variant="outline" size="sm" onClick={onLinkMore}>
                <PlusIcon className="size-4" />
                Link
              </Button>
            )}
            {canUnlinkAll && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmUnlinkAll(true)}
              >
                <LinkBreakIcon className="size-4" />
                Unlink all
              </Button>
            )}
          </>
        }
      >
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No items linked</p>}

        {rows.length > 0 && (
          <DataTable
            entityName={entityName}
            entityTitle={entityTitle}
            columns={columns}
            rows={rows}
            onUnlink={readOnly ? undefined : onUnlink}
          />
        )}
      </RelationAccordion>

      {canUnlinkAll && (
        <AlertDialog open={confirmUnlinkAll} onOpenChange={setConfirmUnlinkAll}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Unlink all {entityTitle.toLowerCase()}</AlertDialogTitle>
              <AlertDialogDescription>
                Remove all {rows.length} linked item{rows.length === 1 ? "" : "s"}? This will not
                delete the {entityTitle.toLowerCase()} themselves.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  onUnlinkAll?.();
                  setConfirmUnlinkAll(false);
                }}
              >
                Unlink all
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <FieldMessage name={name} description={description} error={error} />
    </div>
  );
}
