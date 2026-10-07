import { useMemo, useState } from "react";
import type { SearchHalFormTemplate } from "@contentgrid/navigator-data";
import { Button, FilterButton, Popover, PopoverContent, PopoverTrigger } from "@contentgrid/ui";
import {
  HalFormsContainer,
  type HalFormsField,
  generateSearchFormLayout,
  useHalFormsFieldState,
} from "../../hal-forms";
import { encodeFilterValue, filterFieldValues } from "../../search/filter-field-values";
import type { NumberQuickFilter as NumberQuickFilterModel } from "../util/build-quick-filters";
import { searchTypeIcon } from "./search-icons";

export interface NumberQuickFilterProps {
  readonly quickFilter: NumberQuickFilterModel;
  /** The attribute's resolved search fields (exact and/or range), in form order. */
  readonly fields: readonly HalFormsField[];
  readonly searchTemplate: SearchHalFormTemplate;
  readonly filters: Readonly<Record<string, string>>;
  readonly onApply: (groupKey: string, values: Record<string, string | undefined>) => void;
  readonly onClear: (groupKey: string) => void;
}

/**
 * Quick filter for an integer / decimal attribute (FR-029). Its fields — exact on top, Min and
 * Max side by side — render through the `hal-forms` feature (`HalFormsContainer`, draft state in
 * `useHalFormsFieldState`), so they behave exactly like the advanced filter dialog's. Nothing is
 * applied until Apply; only the inputs the user filled in are set.
 */
export function NumberQuickFilter(props: Readonly<NumberQuickFilterProps>) {
  const { quickFilter, onClear } = props;
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FilterButton
          icon={searchTypeIcon(quickFilter.valueKind, "exact")}
          label={quickFilter.label}
          tone={quickFilter.tone}
          onClear={() => onClear(quickFilter.groupKey)}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        {/* Mounted per opening, so the draft always starts from the current filters. */}
        {open && <NumberQuickFilterForm {...props} onDone={() => setOpen(false)} />}
      </PopoverContent>
    </Popover>
  );
}

function NumberQuickFilterForm({
  quickFilter,
  fields,
  searchTemplate,
  filters,
  onApply,
  onClear,
  onDone,
}: Readonly<NumberQuickFilterProps & { onDone: () => void }>) {
  const layout = useMemo(
    () => generateSearchFormLayout(searchTemplate, fields),
    [searchTemplate, fields],
  );
  const state = useHalFormsFieldState({
    fields,
    initialValues: filterFieldValues(fields, filters),
  });

  return (
    <form
      aria-label={`${quickFilter.label} filter`}
      onSubmit={(event) => {
        event.preventDefault();
        onApply(
          quickFilter.groupKey,
          Object.fromEntries(
            fields.map((field) => [field.name, encodeFilterValue(state.values[field.name])]),
          ),
        );
        onDone();
      }}
    >
      <HalFormsContainer
        fields={fields}
        layout={layout}
        values={state.values}
        onChange={state.setValue}
        fieldState={state.fieldState}
        onFieldFocus={state.focusField}
        onFieldBlur={state.blurField}
      />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            onClear(quickFilter.groupKey);
            onDone();
          }}
        >
          Clear
        </Button>
        <Button type="submit" size="sm">
          Apply
        </Button>
      </div>
    </form>
  );
}
