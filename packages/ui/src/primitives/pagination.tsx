import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { type Button, buttonVariants } from "./button";

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
}

// Footer-style pagination bar: left summary text, right prev/next controls.
// Matches the mockup `.pagination`: top 1px line border, frost bg, padding 16px 24px.
function PaginationBar({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination-bar"
      className={cn(
        "flex w-full items-center justify-between gap-4 border-t border-border bg-card px-6 py-4 text-[13px] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function PaginationSummary({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="pagination-summary"
      className={cn("text-[13px] text-muted-foreground", className)}
      {...props}
    />
  );
}

function PaginationControls({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="pagination-controls"
      className={cn("flex items-center gap-1.5", className)}
      {...props}
    />
  );
}

function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex flex-row items-center gap-1", className)}
      {...props}
    />
  );
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />;
}

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<React.ComponentProps<typeof Button>, "size"> &
  React.ComponentProps<"a">;

function PaginationLink({ className, isActive, size = "icon", ...props }: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? "page" : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      className={cn(
        buttonVariants({
          variant: isActive ? "outline" : "ghost",
          size,
        }),
        className,
      )}
      {...props}
    />
  );
}

// Shared `.pg-btn` look from the mockup: 1px line border, frost bg, 13px text,
// radius 6px, 6px gap, disabled = muted color + opacity .6.
const pgButtonClassName = cn(
  "inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-2.5 py-1.5 text-[13px] text-foreground transition-colors",
  "hover:bg-muted hover:text-foreground",
  "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-[3px]",
  "[&[aria-disabled='true']]:pointer-events-none [&[aria-disabled='true']]:text-muted-foreground [&[aria-disabled='true']]:opacity-60",
  "[&_svg]:size-4 [&_svg]:shrink-0",
);

function PaginationPrevious({ className, ...props }: React.ComponentProps<"a">) {
  return (
    <a
      aria-label="Go to previous page"
      data-slot="pagination-previous"
      className={cn(pgButtonClassName, className)}
      {...props}
    >
      <ChevronLeftIcon />
      <span>Previous</span>
    </a>
  );
}

function PaginationNext({ className, ...props }: React.ComponentProps<"a">) {
  return (
    <a
      aria-label="Go to next page"
      data-slot="pagination-next"
      className={cn(pgButtonClassName, className)}
      {...props}
    >
      <span>Next</span>
      <ChevronRightIcon />
    </a>
  );
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn("flex size-9 items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontalIcon className="size-4" />
      <span className="sr-only">More pages</span>
    </span>
  );
}

export {
  Pagination,
  PaginationBar,
  PaginationSummary,
  PaginationControls,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};
