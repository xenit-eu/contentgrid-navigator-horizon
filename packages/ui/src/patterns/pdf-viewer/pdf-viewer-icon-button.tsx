import type { ReactNode } from "react";
import { Button } from "../../primitives/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../primitives/tooltip";

/**
 * A toolbar icon button with a tooltip carrying its accessible label. Shared
 * between `pdf-viewer-toolbar.tsx` (page/zoom/download/print/fullscreen) and
 * `pdf-viewer-search-popover.tsx` (previous/next/clear match) — split into
 * its own file so neither of those needs to import from the other. Must be
 * rendered inside a `TooltipProvider` (the toolbar wraps its whole render
 * tree in one).
 */
export function IconButton({
  label,
  disabled,
  onClick,
  children,
}: Readonly<{
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
