import * as React from "react";
import {
  ArrowSquareOutIcon as ArrowSquareOut,
  CircleIcon as Circle,
  InfoIcon as Info,
  WarningIcon as Warning,
  XIcon as X,
} from "@phosphor-icons/react";
import { cn } from "../lib/utils";
import { Button } from "./button";

type AlertTone = "info" | "warning" | "error";

/**
 * Per tone: the box (fill and border), the accent colour of the icon, the title and the title
 * link, the icon, and the role. The description (dim) and buttons stay neutral in every tone.
 */
const toneConfig = {
  info: {
    boxClass: "bg-info border-info-border",
    accentClass: "text-info-foreground",
    titleClass: "text-foreground",
    icon: <Info aria-hidden />,
    role: "status" as const,
  },
  warning: {
    boxClass: "bg-warning/10 dark:bg-warning/14 border-warning/30 dark:border-warning/34",
    accentClass: "text-warning-foreground",
    titleClass: "text-warning-foreground",
    icon: <Warning aria-hidden />,
    role: "alert" as const,
  },
  error: {
    boxClass: "bg-destructive/10 border-destructive/30",
    accentClass: "text-destructive",
    titleClass: "text-destructive",
    icon: <Warning aria-hidden />,
    role: "alert" as const,
  },
} satisfies Record<
  AlertTone,
  {
    boxClass: string;
    accentClass: string;
    titleClass: string;
    icon: React.ReactNode;
    role: "status" | "alert";
  }
>;

const AlertToneContext = React.createContext<AlertTone>("info");

interface AlertProps extends Omit<React.ComponentProps<"div">, "onClose"> {
  readonly tone?: AlertTone;
  /** Renders a dismiss (×) button at the end of the alert when provided. */
  readonly onClose?: () => void;
}

/**
 * A tinted box with the tone's icon in its own column and the content beside it: an optional
 * bold title in the tone's colour, a dim description, and neutral action buttons.
 */
function Alert({ tone = "info", onClose, className, children, ...props }: AlertProps) {
  const config = toneConfig[tone];

  return (
    <AlertToneContext.Provider value={tone}>
      <div
        data-slot="alert"
        data-tone={tone}
        role={config.role}
        className={cn(
          "flex gap-2.5 rounded-md border px-3.5 py-3 text-ui text-foreground",
          config.boxClass,
          className,
        )}
        {...props}
      >
        <span className={cn("shrink-0 [&>svg]:size-5", config.accentClass)}>{config.icon}</span>
        <div className="min-w-0 flex-1 space-y-1">{children}</div>
        {onClose && (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onClose}
            className="-my-1 -mr-1 grid size-7 shrink-0 place-items-center self-start rounded-md opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </AlertToneContext.Provider>
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  const tone = React.useContext(AlertToneContext);
  return (
    <div
      data-slot="alert-title"
      className={cn("flex items-center gap-1.5 font-bold", toneConfig[tone].titleClass, className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-description" className={cn("text-dim", className)} {...props} />;
}

/** A real, clickable action button — the neutral outlined button, the same in every tone. */
function AlertButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button type="button" variant="outline" size="compact" className={className} {...props} />;
}

/** Row container for one or more {@link AlertButton}s. */
function AlertActionSection({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-actions"
      className={cn("flex flex-wrap items-center gap-2 pt-1", className)}
      {...props}
    />
  );
}

/** Bulleted list of related issues inside an alert — e.g. one entry per validation field error. */
function AlertList({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul data-slot="alert-list" className={cn("space-y-0.5 mt-1 ml-5", className)} {...props} />
  );
}

/** A single {@link AlertList} entry — a dot marker, message text, plus an optional inline {@link AlertButton}. */
function AlertListItem({ className, children, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="alert-list-item"
      className={cn("flex flex-wrap items-center gap-x-2", className)}
      {...props}
    >
      <Circle size={6} weight="fill" aria-hidden="true" className="flex-shrink-0" />
      {children}
    </li>
  );
}

interface AlertLinkButtonProps {
  /** URL opened in a new tab when clicked. */
  readonly href: string;
  /** Accessible name (this is an icon-only button). */
  readonly label: string;
  readonly className?: string;
}

/** Icon-only button that opens `href` in a new tab — e.g. next to an {@link AlertTitle}. */
function AlertLinkButton({ href, label, className }: AlertLinkButtonProps) {
  const tone = React.useContext(AlertToneContext);
  return (
    <Button
      asChild
      variant="ghost"
      size="icon-xs"
      className={cn(toneConfig[tone].accentClass, className)}
    >
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>
        <ArrowSquareOut size={14} />
      </a>
    </Button>
  );
}

export {
  Alert,
  AlertTitle,
  AlertDescription,
  AlertButton,
  AlertActionSection,
  AlertList,
  AlertListItem,
  AlertLinkButton,
};
export type { AlertProps, AlertTone };
