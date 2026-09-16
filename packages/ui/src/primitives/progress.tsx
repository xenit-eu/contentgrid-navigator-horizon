import * as React from "react";
import { cn } from "../lib/utils";

function Progress({ className, max = 100, ...props }: React.ComponentProps<"progress">) {
  return (
    <progress
      data-slot="progress"
      max={max}
      className={cn(
        "h-1.5 w-full appearance-none overflow-hidden rounded-full bg-muted [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-primary [&::-moz-progress-bar]:transition-all [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary [&::-webkit-progress-value]:transition-all",
        className,
      )}
      {...props}
    />
  );
}

export { Progress };
