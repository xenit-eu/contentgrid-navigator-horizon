import type { ReactNode } from "react";
import { Button } from "../primitives/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/tooltip";

/**
 * A toolbar icon button with a tooltip carrying its accessible label. Used by
 * `pdf-viewer-toolbar.tsx` (page/zoom/download/print/fullscreen),
 * `pdf-viewer-search-popover.tsx` (previous/next/clear match) and any other
 * preview toolbar that should look the same. Lives outside `pdf-viewer/` so
 * using it doesn't pull in the lazily loaded PDF viewer. Must be rendered
 * inside a `TooltipProvider` (the PDF toolbar wraps its whole render tree in one).
 */
export function ToolbarIconButton({
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
