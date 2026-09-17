import * as React from "react";
import {
  CheckCircleIcon as CheckCircle,
  CircleNotchIcon as CircleNotch,
  InfoIcon as Info,
  WarningIcon as Warning,
  WarningOctagonIcon as WarningOctagon,
} from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ richColors = true, ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      richColors={richColors}
      className="toaster group"
      icons={{
        success: <CheckCircle className="size-4" />,
        info: <Info className="size-4" />,
        warning: <Warning className="size-4" />,
        error: <WarningOctagon className="size-4" />,
        loading: <CircleNotch className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          // Sonner's own richColors green (a generic mint) clashes with this app's
          // ocean/sky palette — point its success triad at the same green StatusPill
          // already uses for its "success" variant instead.
          "--success-bg": "var(--success)",
          "--success-border": "var(--success-border)",
          "--success-text": "var(--success-foreground)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
