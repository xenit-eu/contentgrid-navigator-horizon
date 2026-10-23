import { type ReactNode, useRef } from "react";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react";
import { Button, FilterChips } from "@contentgrid/ui";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const quickFilterOpenProps = (groupKey: string) => ({
    open: searchBar.openQuickFilter === groupKey,
    onOpenChange: (open: boolean) => searchBar.setOpenQuickFilter(open ? groupKey : undefined),
  });

  const rows: ReactNode[] = [];

  if (searchBar.chips.length > 0) {
    rows.push(
      <FilterChips
        key="chips"
        onRemove={searchBar.removeChip}
        onSelect={(id) => {
          if (searchBar.chipTargets.get(id)?.kind === "input") {
            // Focus first: the input's focus handler may ask for the popover, which editing closes.
            inputRef.current?.focus();
          }
          const target = searchBar.editChip(id);
          if (target?.kind === "quick-filter") {
            // The quick-filter row scrolls; bring the trigger the popover anchors to into view.
            const slot = Array.from(
              rootRef.current?.querySelectorAll<HTMLElement>("[data-quick-filter]") ?? [],
            ).find((el) => el.dataset.quickFilter === target.groupKey);
            slot
              ?.querySelector("button")
              ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
          }
        }}
        chips={searchBar.chips.map((chip) => ({
          id: chip.id,
          field: chip.field,
          mode: chip.mode,
          value: chip.value,
          modeIcon: chip.valueKind ? searchTypeIcon(chip.valueKind, chip.searchType) : undefined,
          valueIcon:
            chip.booleanValue === undefined ? undefined : booleanValueIcon(chip.booleanValue),
          selectable: searchBar.chipTargets.has(chip.id),
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
          inputRef={inputRef}
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
        {/* Same as Enter with nothing highlighted; only useful once a parameter has a value. */}
        <Button
          type="button"
          variant="secondary"
          onClick={input.submit}
          disabled={!input.selected || input.value.trim() === ""}
          className="bg-ring font-semibold text-white shadow-xs hover:bg-ring/85"
        >
          <PaperPlaneTiltIcon aria-hidden />
          Search
        </Button>
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
                  {...quickFilterOpenProps(quickFilter.groupKey)}
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
                  {...quickFilterOpenProps(quickFilter.groupKey)}
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
                  {...quickFilterOpenProps(quickFilter.groupKey)}
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
    <div
      ref={rootRef}
      data-slot="entity-search-bar"
      className={`flex flex-col gap-2 ${props.className ?? ""}`}
    >
      {rows}
    </div>
  );
}
