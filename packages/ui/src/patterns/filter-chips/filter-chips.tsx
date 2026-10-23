import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { WarningIcon } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { Chip } from "../../primitives/chip";

export interface FilterChipItem {
  readonly id: string;
  /** What is filtered, e.g. the attribute name. */
  readonly field: string;
  /** How it is matched, e.g. "starts with", "between". */
  readonly mode: string;
  readonly modeIcon?: ReactNode;
  /** The formatted value. */
  readonly value: string;
  readonly valueIcon?: ReactNode;
  /** Whether clicking the chip calls `onSelect`; chips without it are not interactive. */
  readonly selectable?: boolean;
  /**
   * Set when the filter is not applied (e.g. a URL key the search form does not know): the chip
   * turns orange with a warning icon, and this text explains why.
   */
  readonly warning?: string;
}

export interface FilterChipsProps {
  readonly chips: readonly FilterChipItem[];
  /** Called with the chip's id when its remove button is clicked. */
  readonly onRemove: (id: string) => void;
  /** Called with the chip's id when a `selectable` chip is clicked, e.g. to edit its filter. */
  readonly onSelect?: (id: string) => void;
  /** At most this many lines; beyond that the row scrolls horizontally. Defaults to 2. */
  readonly maxLines?: 1 | 2;
  /** Accessible name of the list. */
  readonly label?: string;
  readonly className?: string;
}

const GAP_PX = 8;

/**
 * A row of removable filter chips that wraps onto at most `maxLines` lines and scrolls
 * horizontally beyond that. Renders nothing — no reserved height — when there are no chips.
 *
 * Wrapping is bounded by sizing the wrapping container from the chips' own widths: at a width
 * of at least half their total plus the widest chip, greedy line filling can never need a third
 * line, so anything wider than the viewport scrolls instead.
 */
export function FilterChips({
  chips,
  onRemove,
  onSelect,
  maxLines = 2,
  label = "Active filters",
  className,
}: Readonly<FilterChipsProps>) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [minWidth, setMinWidth] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const list = listRef.current;
    if (!scroller || !list) return;
    const measure = () => {
      // Measure every chip at its natural width: laid out at the current width, a chip wider than
      // the row is already truncated, which would make the computed width too small for 2 lines.
      // Restored before the browser paints, so the unwrapped layout is never visible.
      const previousStyle = list.style.cssText;
      list.style.width = "max-content";
      list.style.flexWrap = "nowrap";
      const widths = Array.from(list.children).map(
        (child) => (child as HTMLElement).getBoundingClientRect().width,
      );
      list.style.cssText = previousStyle;
      const total = widths.reduce((sum, w) => sum + w + GAP_PX, 0);
      const widest = Math.max(0, ...widths) + GAP_PX;
      const needed = maxLines === 1 ? total : total / 2 + widest;
      setMinWidth(needed > scroller.clientWidth ? Math.ceil(needed) : undefined);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [chips, maxLines]);

  if (chips.length === 0) return null;

  return (
    <div
      ref={scrollerRef}
      data-slot="filter-chips"
      className={cn("scrollbar-subtle overflow-x-auto overflow-y-hidden pb-1", className)}
    >
      <ul
        ref={listRef}
        aria-label={label}
        className={cn("m-0 flex list-none gap-2 p-0", maxLines === 1 ? "flex-nowrap" : "flex-wrap")}
        style={minWidth === undefined ? undefined : { width: minWidth }}
        // Keep a chip reached with the keyboard in view.
        onFocus={(event) =>
          (event.target as HTMLElement).scrollIntoView?.({ block: "nearest", inline: "nearest" })
        }
      >
        {chips.map((chip) => (
          <li key={chip.id} className="flex min-w-0">
            <Chip
              tone={chip.warning ? "warning" : "applied"}
              field={chip.field}
              mode={chip.mode}
              modeIcon={
                chip.modeIcon ?? (chip.warning ? <WarningIcon size={12} aria-hidden /> : undefined)
              }
              label={chip.value}
              valueIcon={chip.valueIcon}
              description={chip.warning}
              removable
              onRemove={() => onRemove(chip.id)}
              removeLabel={`Remove filter ${chip.field} ${chip.mode} ${chip.value}`}
              onClick={chip.selectable && onSelect ? () => onSelect(chip.id) : undefined}
              clickLabel={`Edit filter ${chip.field} ${chip.mode} ${chip.value}`}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
