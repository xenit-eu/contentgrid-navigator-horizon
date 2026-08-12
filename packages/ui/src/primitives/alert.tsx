import * as React from "react";
import {
  ArrowSquareOutIcon as ArrowSquareOut,
  CircleIcon as Circle,
  InfoIcon as Info,
  WarningIcon as Warning,
  XIcon as X,
  XCircleIcon as XCircle,
} from "@phosphor-icons/react";
import { cn } from "../lib/utils";
import { Button } from "./button";

type AlertTone = "info" | "warning" | "error";

const toneConfig = {
  info: {
    textClass: "text-[#084772] dark:text-[#7CCDF4]",
    bgClass: "bg-[rgba(1,155,227,0.08)] dark:bg-[rgba(90,196,242,0.12)]",
    borderClass: "border-[rgba(1,155,227,0.3)] dark:border-[rgba(90,196,242,0.34)]",
    icon: <Info size={16} aria-hidden />,
    role: "status" as const,
  },
  warning: {
    textClass: "text-[#A4501F] dark:text-[#E89A63]",
    bgClass: "bg-[rgba(212,104,42,0.10)] dark:bg-[rgba(232,154,99,0.14)]",
    borderClass: "border-[rgba(212,104,42,0.3)] dark:border-[rgba(232,154,99,0.34)]",
    icon: <Warning size={16} aria-hidden />,
    role: "alert" as const,
  },
  error: {
    textClass: "text-destructive",
    bgClass: "bg-destructive/10",
    borderClass: "border-destructive/50",
    icon: <XCircle size={16} aria-hidden />,
    role: "alert" as const,
  },
} satisfies Record<
  AlertTone,
  {
    textClass: string;
    bgClass: string;
    borderClass: string;
    icon: React.ReactNode;
    role: "status" | "alert";
  }
>;

const AlertToneContext = React.createContext<AlertTone>("info");

interface AlertProps extends Omit<React.ComponentProps<"div">, "onClose"> {
  readonly tone?: AlertTone;
  /** Renders a dismiss (×) button in the top-right corner when provided. */
  readonly onClose?: () => void;
}

function Alert({ tone = "info", onClose, className, children, ...props }: AlertProps) {
  const config = toneConfig[tone];

  return (
    <AlertToneContext.Provider value={tone}>
      <div
        data-slot="alert"
        data-tone={tone}
        role={config.role}
        className={cn(
          "relative rounded-md border px-3 py-2 text-xs space-y-1",
          config.textClass,
          config.bgClass,
          config.borderClass,
          onClose && "pr-8",
          className,
        )}
        {...props}
      >
        {children}
        {onClose && (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onClose}
            className="absolute top-2 right-2 opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </AlertToneContext.Provider>
  );
}

function AlertTitle({ className, children, ...props }: React.ComponentProps<"div">) {
  const tone = React.useContext(AlertToneContext);
  return (
    <div
      data-slot="alert-title"
      className={cn("flex items-center gap-1.5 font-medium", className)}
      {...props}
    >
      <span className="flex-shrink-0">{toneConfig[tone].icon}</span>
      {children}
    </div>
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-description" className={cn(className)} {...props} />;
}

/** A real, clickable action button — sized and colored to match the alert's tone. */
function AlertButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  const tone = React.useContext(AlertToneContext);
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className={cn(toneConfig[tone].textClass, className)}
      {...props}
    />
  );
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
      className={cn(toneConfig[tone].textClass, className)}
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
