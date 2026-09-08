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

/** Shared across every renderer that marks a field required — `FieldShell` below,
 * `BooleanRenderer` (whose checkbox-beside-label layout doesn't use `FieldShell`), and
 * `RelationSection` (`packages/ui/src/patterns/relation-section/`). */
export function RequiredMarker() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  );
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
        {required && <RequiredMarker />}
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
