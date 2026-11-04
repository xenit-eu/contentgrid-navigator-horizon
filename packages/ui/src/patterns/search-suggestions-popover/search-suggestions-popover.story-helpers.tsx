import { useState } from "react";
import { HashIcon, MagnifyingGlassIcon, TextAaIcon } from "@phosphor-icons/react";
import { Input } from "../../primitives/input";
import {
  SearchSuggestionsPopover,
  type SuggestionChip,
  type SuggestionGroup,
} from "./search-suggestions-popover";

/**
 * Shared story data and harness for `search-suggestions-popover.stories.tsx` and its interaction
 * file. Named without `.stories.` so Storybook's story glob does not load it as a story module.
 */

export const textChips: SuggestionChip[] = [
  { id: "title", label: "Title", icon: <TextAaIcon size={14} aria-hidden />, count: { count: 12 } },
  {
    id: "notes",
    label: "Notes",
    icon: <MagnifyingGlassIcon size={14} aria-hidden />,
    count: { count: 340, isEstimated: true },
  },
  {
    id: "reference",
    label: "Reference",
    icon: <TextAaIcon size={14} aria-hidden />,
    count: { count: null },
  },
];

export const numberChips: SuggestionChip[] = [
  {
    id: "quantity",
    label: "Quantity",
    icon: <HashIcon size={14} aria-hidden />,
    count: { count: null },
  },
  {
    id: "amount",
    label: "Amount",
    icon: <HashIcon size={14} aria-hidden />,
    count: { count: null },
  },
  ...textChips,
];

export const readyGroups: SuggestionGroup[] = [
  {
    id: "title",
    label: "Title",
    icon: <TextAaIcon size={14} aria-hidden />,
    count: { count: 12 },
    status: "ready",
    items: [
      { id: "Alpha invoice", label: "Alpha invoice" },
      { id: "Alpha order", label: "Alpha order" },
      { id: "Alpine supplies", label: "Alpine supplies" },
    ],
  },
  {
    id: "notes",
    label: "Notes",
    icon: <MagnifyingGlassIcon size={14} aria-hidden />,
    count: { count: 340, isEstimated: true },
    status: "ready",
    items: [{ id: "Paid in advance", label: "Paid in advance" }],
  },
  {
    id: "customer",
    label: "Customer · Name",
    icon: <TextAaIcon size={14} aria-hidden />,
    count: { count: 4 },
    status: "ready",
    items: [
      { id: "Acme Corp", label: "Acme Corp" },
      { id: "Acme Logistics", label: "Acme Logistics" },
    ],
  },
];

export function PopoverHarness({
  chips,
  groups,
  initialValue = "Al",
  onSelect,
}: {
  chips: SuggestionChip[];
  groups: SuggestionGroup[];
  initialValue?: string;
  onSelect?: (what: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState(initialValue);
  return (
    <div className="h-[28rem] w-[28rem] p-4">
      <SearchSuggestionsPopover
        open={open}
        onOpenChange={setOpen}
        chips={chips}
        groups={groups}
        onSelectChip={(id) => onSelect?.(`chip:${id}`)}
        onSelectItem={(groupId, itemId) => {
          onSelect?.(`item:${groupId}:${itemId}`);
          setOpen(false);
        }}
        renderAnchor={(comboboxProps) => (
          <Input
            aria-label="Search"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setOpen(true);
            }}
            {...comboboxProps}
          />
        )}
      />
    </div>
  );
}
