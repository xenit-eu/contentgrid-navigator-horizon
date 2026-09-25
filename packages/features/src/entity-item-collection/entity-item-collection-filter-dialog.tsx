import { CircleNotchIcon as CircleNotch } from "@phosphor-icons/react";
import type { CollectionTotalCount, FieldValue, FieldValueMap } from "@contentgrid/navigator-data";
import { Button, Dialog, DialogContent, DialogTitle } from "@contentgrid/ui";
import {
  type FieldState,
  HalFormsContainer,
  type HalFormsField,
  type LayoutSchema,
} from "../hal-forms";

export interface EntityItemCollectionFilterDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly activeFilterCount: number;
  readonly onClearAll: () => void;
  readonly fields: readonly HalFormsField[];
  readonly layout: LayoutSchema;
  readonly values: FieldValueMap;
  readonly onChange: (name: string, value: FieldValue) => void;
  readonly fieldState: Readonly<Record<string, FieldState>>;
  /** Total item count metadata for the collection under the currently-applied filters (filtering
   * is live, so this always reflects the form's current state); `undefined` while that count is
   * unknown (e.g. still loading). Drives the footer's "Show N items" label, including the
   * "(estimated)" suffix. */
  readonly totalItems: CollectionTotalCount | undefined;
  /** Whether the collection query for the currently-applied filters is in flight (the caller's own
   * `collection.isFetching` — covers both the very first load and every filter-triggered
   * refetch). `totalItems` is `placeholderData`-backed and so may still show the PREVIOUS
   * filters' count while this is true; the footer's "Show N items" button surfaces a spinner so
   * that stale count doesn't read as already up to date. */
  readonly isLoading: boolean;
}

/**
 * The `EntityItemCollectionView` filter modal — extracted so the "Filters" header and the
 * "Clear all"/"Show N items" footer stay pinned while only the (potentially long, multi-section)
 * `HalFormsContainer` body scrolls. `DialogContent` is capped at `85vh` and laid out as a column
 * (`flex flex-col`, overriding its own default `grid`); the header and footer are `shrink-0` and
 * the `HalFormsContainer` wrapper is `min-h-0 flex-1 overflow-y-auto` so it's the only part that
 * ever grows a scrollbar.
 *
 * Filtering itself is already live — every `HalFormsContainer` field change round-trips through
 * `onChange` to the caller's `onFiltersChange` immediately (see `EntityItemCollectionView`'s own
 * doc comment). The footer's "Show N items" button doesn't apply anything itself; it just closes
 * the dialog onto results the table is already showing — while `isLoading`, it also shows a
 * spinner, since `totalItems` may still be the previous filters' count at that point.
 */
export function EntityItemCollectionFilterDialog({
  open,
  onOpenChange,
  activeFilterCount,
  onClearAll,
  fields,
  layout,
  values,
  onChange,
  fieldState,
  totalItems,
  isLoading,
}: Readonly<EntityItemCollectionFilterDialogProps>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col px-0">
        <div className="shrink-0 border-b pb-4">
          <DialogTitle className="text-center text-base font-semibold">Filters</DialogTitle>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          <HalFormsContainer
            fields={fields}
            layout={layout}
            values={values}
            onChange={onChange}
            fieldState={fieldState}
          />
        </div>
        <div className="flex shrink-0 items-center justify-between border-t pt-4 px-4">
          {activeFilterCount > 0 ? (
            <Button
              size="sm"
              variant="link"
              className="h-6 px-2 text-sm text-muted-foreground"
              onClick={onClearAll}
            >
              Clear all
            </Button>
          ) : (
            <span />
          )}
          <Button size="sm" onClick={() => onOpenChange(false)}>
            {isLoading && <CircleNotch className="size-4 animate-spin" aria-hidden />}
            Show {totalItems?.count ?? "-"} items{totalItems?.isEstimated && " (estimated)"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
