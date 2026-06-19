import * as React from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { cn } from "../lib/utils";

interface TextFieldProps {
  label: string;
  value?: string;
  placeholder?: string;
  helpText?: string;
  error?: string;
  required?: boolean;
  icon?: React.ReactNode;
  state?: "default" | "focus" | "error" | "disabled";
  className?: string;
}

function TextField({
  label,
  value,
  placeholder,
  helpText,
  error,
  required,
  icon,
  state = "default",
  className,
}: TextFieldProps) {
  const id = React.useId();
  const isError = state === "error" || !!error;
  const isDisabled = state === "disabled";

  return (
    <div data-slot="text-field" className={cn("flex flex-col gap-[6px]", className)}>
      <label htmlFor={id} className="text-xs font-semibold text-muted-foreground">
        {label}
        {required && (
          <span className="text-destructive ml-0.5" aria-hidden>
            *
          </span>
        )}
      </label>

      <div
        className={cn(
          "flex flex-row items-center gap-2 border rounded-lg px-3 py-[9px] bg-card",
          isError
            ? "border-destructive focus-within:ring-[3px] focus-within:ring-destructive/20"
            : "border-border focus-within:ring-[3px] focus-within:ring-ring/30 focus-within:border-ring",
          isDisabled && "opacity-60 bg-muted pointer-events-none",
        )}
      >
        {icon && (
          <span className="text-muted-foreground flex-shrink-0 [&>svg]:size-[15px]">{icon}</span>
        )}
        <input
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}
          disabled={isDisabled}
          aria-invalid={isError || undefined}
          className="flex-1 text-[13px] bg-transparent outline-none text-foreground placeholder:text-muted-foreground min-w-0"
          readOnly={value !== undefined}
        />
      </div>

      {(helpText || error) && (
        <div
          className={cn(
            "flex items-center gap-1 text-xs",
            isError ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {isError && <WarningCircle size={12} aria-hidden />}
          <span>{isError ? (error ?? helpText) : helpText}</span>
        </div>
      )}
    </div>
  );
}

export { TextField };
