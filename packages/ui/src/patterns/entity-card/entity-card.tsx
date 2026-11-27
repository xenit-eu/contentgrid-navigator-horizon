import type { ComponentProps, KeyboardEvent } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { Card } from "../../primitives/card";
import { Skeleton } from "../../primitives/skeleton";

/**
 * An entity card is built from small parts: `EntityCard` draws the card, and a page places
 * `EntityCardText` (holding `EntityCardTitle` and `EntityCardDescription`), `EntityCardArrow` and
 * its own content in it, in the order its design asks for. Cards go in an `EntityCardGrid`, and
 * `EntityCardSkeleton` stands in for a card while it loads.
 */

export interface EntityCardProps extends ComponentProps<"div"> {
  /**
   * Makes the whole card one button that calls `onOpen` on a click, Enter or Space. Leave it out
   * for a card whose own controls (a link, an icon button) do the work; a clickable card should
   * hold no other controls, since a control inside a button is not reachable on its own.
   */
  readonly onOpen?: () => void;
}

/** The card an entity is shown in: a line border, rounded corners, no shadow. */
export function EntityCard({ onOpen, className, ...props }: Readonly<EntityCardProps>) {
  return (
    <Card
      data-slot="entity-card"
      {...openProps(onOpen)}
      className={cn(
        "h-full gap-3 rounded-lg p-4 shadow-none",
        onOpen && "cursor-pointer transition-colors hover:border-primary/50",
        className,
      )}
      {...props}
    />
  );
}

function openProps(onOpen: (() => void) | undefined) {
  if (!onOpen) return {};
  return {
    role: "button",
    tabIndex: 0,
    onClick: onOpen,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen();
      }
    },
  };
}

/** Groups the title with the lines under it, close together. */
export function EntityCardText({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return (
    <div data-slot="entity-card-text" className={cn("min-w-0 space-y-0.5", className)} {...props} />
  );
}

/** The entity's name, on one line; the full name shows on hover when it is cut. */
export function EntityCardTitle({
  children,
  className,
}: Readonly<{ children: string; className?: string }>) {
  return (
    <h2
      data-slot="entity-card-title"
      title={children}
      className={cn("line-clamp-1 text-card-title font-bold", className)}
    >
      {children}
    </h2>
  );
}

/** A muted line under the title, at most two lines; the full text shows on hover when it is cut. */
export function EntityCardDescription({
  children,
  className,
}: Readonly<{ children: string; className?: string }>) {
  return (
    <p
      data-slot="entity-card-description"
      title={children}
      className={cn("line-clamp-2 text-ui text-muted-foreground", className)}
    >
      {children}
    </p>
  );
}

/** The muted arrow that marks a card as opening something. Decorative. */
export function EntityCardArrow({ className }: Readonly<{ className?: string }>) {
  return (
    <ArrowRightIcon
      data-slot="entity-card-arrow"
      aria-hidden
      className={cn("size-4 shrink-0 text-muted-foreground", className)}
    />
  );
}

/** The grid entity cards are laid out in: as many columns of at least 250px as fit. */
export function EntityCardGrid({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return (
    <div
      data-slot="entity-card-grid"
      className={cn("grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4", className)}
      {...props}
    />
  );
}

/** Stands in for an entity card while it loads: the icon tile, the title and the line under it. */
export function EntityCardSkeleton() {
  return (
    <EntityCard aria-hidden>
      <Skeleton className="size-9" />
      <Skeleton className="h-3 w-3/5" />
      <Skeleton className="h-2.5 w-2/5" />
    </EntityCard>
  );
}
