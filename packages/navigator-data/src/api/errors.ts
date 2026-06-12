import { type ProblemDetail, ProblemDetailError } from "@contentgrid/problem-details";

export { checkResponse } from "@contentgrid/problem-details";
export { ProblemDetailError };
export type { ProblemDetail };

/** Thrown when a mutation is rejected with HTTP 412 — the entity was modified concurrently. */
export class PreconditionFailedError extends Error {
  readonly problemDetail: ProblemDetail;

  constructor(problemDetail: ProblemDetail) {
    super(problemDetail.detail ?? problemDetail.title);
    this.name = "PreconditionFailedError";
    this.problemDetail = problemDetail;
  }
}

/**
 * A single entry from the `errors[]` array on an `input/validation` problem
 * detail. Each sub-error is itself a ProblemDetail (title + optional detail)
 * scoped to a specific attribute via `property`.
 *
 * Shape verified against the original ContentGrid Navigator:
 * SubError = ProblemDetail & { property?: string; invalid_value: unknown }
 */
export interface FieldError {
  /** The attribute name this validation error applies to. Absent for entity-level errors. */
  property?: string;
  /** The value that failed validation. */
  invalid_value?: unknown;
  /** Short error type/title from the platform (e.g. "required", "duplicate"). */
  title: string;
  /** Detailed human-readable description, if provided. Use `detail ?? title` for display. */
  detail?: string;
}

export function extractFieldErrors(error: unknown): FieldError[] {
  if (error instanceof ProblemDetailError) {
    const pd = error.problemDetail as ProblemDetail & {
      errors?: Array<ProblemDetail & { property?: string; invalid_value?: unknown }>;
    };
    return pd.errors ?? [];
  }
  return [];
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ProblemDetailError) {
    return error.problemDetail.detail ?? error.problemDetail.title;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred";
}
