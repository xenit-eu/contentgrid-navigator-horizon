import type { ReactNode } from "react";
import { FilterChips } from "@contentgrid/ui";
import { AllowedValuesQuickFilter } from "./components/allowed-values-quick-filter";
import { BooleanQuickFilter } from "./components/boolean-quick-filter";
import { DateQuickFilter } from "./components/date-quick-filter";
import { NumberQuickFilter } from "./components/number-quick-filter";
import { QuickFilterRow } from "./components/quick-filter-row";
import { booleanValueIcon, searchTypeIcon } from "./components/search-icons";
import { SearchInput } from "./components/search-input";
import { SearchParamSelector } from "./components/search-param-selector";
import { type EntitySearchBarProps, useEntitySearchBar } from "./use-entity-search-bar";

export type { EntitySearchBarProps } from "./use-entity-search-bar";

/**
 * The single search bar of an entity item collection (spec 003): three stacked rows — active
 * filter chips, the search-parameter selector with the free-text input, and quick filters.
 * Fully controlled by the collection's `filters`; every change goes out through
 * `onFiltersChange`. A row with nothing to show takes no space; the whole bar renders nothing
 * when all three rows are empty.
 */
export function EntitySearchBar(props: Readonly<EntitySearchBarProps>) {
  const searchBar = useEntitySearchBar(props);
  const { input } = searchBar;

  const rows: ReactNode[] = [];

  if (searchBar.chips.length > 0) {
    rows.push(
      <FilterChips
        key="chips"
        onRemove={searchBar.removeChip}
        chips={searchBar.chips.map((chip) => ({
          id: chip.id,
          field: chip.field,
          mode: chip.mode,
          value: chip.value,
          modeIcon:
            chip.valueKind && chip.searchMode
              ? searchTypeIcon(chip.valueKind, chip.searchMode)
              : undefined,
          valueIcon:
            chip.booleanValue === undefined ? undefined : booleanValueIcon(chip.booleanValue),
        }))}
      />,
    );
  }

  // Only the modes group means there is no parameter to type into (edge case: nothing searchable).
  if (searchBar.selectorGroups.length > 1) {
    rows.push(
      <div key="main" data-slot="search-main-row" className="flex items-start gap-2">
        <SearchParamSelector
          groups={searchBar.selectorGroups}
          mode={input.mode}
          onModeChange={input.setMode}
        />
        <SearchInput
          value={input.value}
          onValueChange={input.setValue}
          error={input.error}
          popoverOpen={input.popoverOpen}
          onPopoverOpenChange={input.setPopoverOpen}
          paramChips={input.paramChips}
          groups={input.groups}
          onSelectParam={input.selectParam}
          onApplySuggestion={input.applySuggestion}
          onSubmit={input.submit}
          onOtherKeyDown={(event) => {
            const selectedParam = input.mode.kind === "param";
            if (event.key === "Escape" && !input.popoverOpen && selectedParam) {
              input.resetMode();
            } else if (event.key === "Backspace" && input.value === "" && selectedParam) {
              input.resetMode();
            }
          }}
        />
      </div>,
    );
  }

  if (searchBar.quickFilters.length > 0 || props.actions) {
    rows.push(
      <QuickFilterRow
        key="quick-filters"
        actions={props.actions}
        quickFilters={searchBar.quickFilters}
        renderQuickFilter={(quickFilter) => {
          switch (quickFilter.kind) {
            case "date":
              return (
                <DateQuickFilter
                  quickFilter={quickFilter}
                  filters={props.filters}
                  onApply={searchBar.applyQuickFilter}
                  onClear={searchBar.clearQuickFilter}
                />
              );
            case "boolean":
              return (
                <BooleanQuickFilter
                  quickFilter={quickFilter}
                  onCycle={searchBar.cycleBoolean}
                  onClear={searchBar.clearQuickFilter}
                />
              );
            case "number":
              return searchBar.searchTemplate ? (
                <NumberQuickFilter
                  quickFilter={quickFilter}
                  fields={searchBar.fieldsFor(quickFilter.groupKey)}
                  searchTemplate={searchBar.searchTemplate}
                  filters={props.filters}
                  onApply={searchBar.applyQuickFilter}
                  onClear={searchBar.clearQuickFilter}
                />
              ) : null;
            case "allowed-values":
              return (
                <AllowedValuesQuickFilter
                  quickFilter={quickFilter}
                  onApply={searchBar.applyQuickFilter}
                  onClear={searchBar.clearQuickFilter}
                />
              );
          }
        }}
      />,
    );
  }

  if (rows.length === 0) return null;

  return (
    <div data-slot="entity-search-bar" className={`flex flex-col gap-2 ${props.className ?? ""}`}>
      {rows}
    </div>
  );
}
