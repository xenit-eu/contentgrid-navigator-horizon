import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { IconBadge } from "../../primitives/icon-badge";

export interface ItemReferenceProps {
  /** Icon element, e.g. a Phosphor icon — rendered inside the badge. Badge is omitted if absent. */
  readonly icon?: ReactNode;
  /** Badge background color — any CSS color string. Falls back to the theme's muted color. */
  readonly color?: string;
  /** Blends the badge into a soft, semi-transparent fill instead of a solid one. */
  readonly muted?: boolean;
  /** Badge size. Defaults to "sm" — this is meant to sit inline in a table row or list item. */
  readonly size?: "sm" | "default" | "lg";
  /** Primary label. */
  readonly title: ReactNode;
  /** Secondary caption shown under the title. */
  readonly subtitle?: ReactNode;
  /** Renders as a clickable/focusable element when provided. */
  readonly onClick?: () => void;
  /** Visually marks this reference as the active/selected one. */
  readonly selected?: boolean;
  readonly className?: string;
  readonly "aria-label"?: string;
}

function ItemReference({
  icon,
  color,
  muted = false,
  size = "sm",
  title,
  subtitle,
  onClick,
  selected = false,
  className,
  "aria-label": ariaLabel,
}: Readonly<ItemReferenceProps>) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter") {
                onClick();
              } else if (e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-label={ariaLabel}
      aria-pressed={onClick ? selected : undefined}
      data-slot="item-reference"
      data-selected={selected || undefined}
      className={cn(
        "flex min-w-0 items-center gap-[11px] rounded-md",
        onClick &&
          "cursor-pointer transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        selected && "bg-accent",
        className,
      )}
    >
      {icon && <IconBadge icon={icon} color={color} muted={muted} variant={size} />}
      <div className="min-w-0">
        <div
          className={cn(
            "truncate text-[13px] text-foreground",
            selected ? "font-semibold" : "font-medium",
          )}
        >
          {title}
        </div>
        {subtitle && <div className="truncate text-[12px] text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  );
}

export { ItemReference };
