import type { ReactNode } from "react";
import { Label } from "../../primitives/label";

export interface FieldShellProps {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly description?: string;
  readonly error?: string;
  readonly children: ReactNode;
}

/**
 * Shared label/required-marker/description/error chrome for the input-per-row
 * form-renderers in this directory (everything except `BooleanRenderer`, whose
 * checkbox-beside-label layout doesn't fit this above-the-input shape).
 */
export function FieldShell({
  name,
  label,
  required,
  description,
  error,
  children,
}: Readonly<FieldShellProps>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {required && (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        )}
      </Label>
      {children}
      {description && !error && <p className="text-sm text-muted-foreground">{description}</p>}
      {error && (
        <p id={`${name}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
