import type { ReactNode } from "react";
import { Button } from "../primitives/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/tooltip";

/**
 * A compact icon-only button with a tooltip carrying its accessible label, for
 * toolbars and other rows of icon actions. Lives outside `pdf-viewer/` so using
 * it doesn't pull in the lazily loaded PDF viewer. Must be rendered inside a
 * `TooltipProvider`.
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
