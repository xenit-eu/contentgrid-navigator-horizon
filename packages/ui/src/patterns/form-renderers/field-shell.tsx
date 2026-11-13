import type { ReactNode } from "react";
import { Label } from "../../primitives/label";

export interface FieldShellProps {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly description?: string;
  readonly error?: string;
  /** Keeps the label as the control's accessible name but hides it visually — for a field whose
   *  surrounding group heading already names it (e.g. a search form's exact-match filter under
   *  its attribute's section title). */
  readonly hideLabel?: boolean;
  readonly children: ReactNode;
}

/** Shared across every renderer that marks a field required — `FieldShell` below and
 * `BooleanRenderer` (whose checkbox-beside-label layout doesn't use `FieldShell`). */
export function RequiredMarker() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  );
}

/** Id of `FieldShell`'s label — for a control that is not a labelable element (e.g. a
 * `role="group"`) and so must point at the label with `aria-labelledby` instead. */
export function fieldLabelId(name: string): string {
  return `${name}-label`;
}

/** `aria-invalid`/`aria-describedby` for a field's own input control — shared by every
 * single-input renderer in this directory (spread directly onto the control element). */
export function fieldAriaProps(
  name: string,
  error: string | undefined,
): { readonly "aria-invalid": boolean; readonly "aria-describedby": string | undefined } {
  return {
    "aria-invalid": !!error,
    "aria-describedby": error ? `${name}-error` : undefined,
  };
}

/** The description-or-error line below a field's control — shared by `FieldShell` below and
 * `BooleanRenderer` (whose checkbox-beside-label layout renders this same footer itself, outside
 * `FieldShell`). */
export function FieldMessage({
  name,
  description,
  error,
}: Readonly<Pick<FieldShellProps, "name" | "description" | "error">>) {
  return (
    <>
      {description && !error && (
        <p className="text-xs leading-snug text-muted-foreground">{description}</p>
      )}
      {error && (
        <p id={`${name}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </>
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
  hideLabel,
  children,
}: Readonly<FieldShellProps>) {
  return (
    <div className="space-y-1.5">
      <Label id={fieldLabelId(name)} htmlFor={name} className={hideLabel ? "sr-only" : undefined}>
        {label}
        {required && <RequiredMarker />}
      </Label>
      {children}
      <FieldMessage name={name} description={description} error={error} />
    </div>
  );
}
