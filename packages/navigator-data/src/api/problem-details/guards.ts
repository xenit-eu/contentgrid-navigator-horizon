// Type guards for narrowing a caught mutation/query error to a typed
// ContentGrid problem detail.
//
// Why guards (and not a `useMutation<_, ProblemDetailError, _>` generic)?
// Mutation/query functions in this package can reject with EITHER:
//   • a `ProblemDetailError` — every non-2xx HTTP response (via `checkResponse`), or
//   • a plain `Error` — pre-fetch affordance/ABAC guards (e.g. "template absent")
//     and network failures.
// The accurate common supertype is therefore `Error`. Following the TanStack
// Query TypeScript guide's advice for `Error` subclasses, we keep the error
// field as `Error` and narrow at the call site with these guards.
import { type ProblemDetail, ProblemDetailError } from "@contentgrid/problem-details";
import { ContentGridProblemType } from "./constants";
import type {
  ContentGridProblemDetail,
  ValidationFieldError,
  ValidationProblemDetail,
} from "./index";

/**
 * A `ProblemDetailError` whose payload is one of the known, typed
 * {@link ContentGridProblemDetail} members.
 */
export type ContentGridProblemDetailError = ProblemDetailError<ContentGridProblemDetail>;

/**
 * Narrow an unknown error to any `ProblemDetailError` (a non-2xx HTTP response).
 * Note: opaque responses (bare `403`, Spring `500`) are still `ProblemDetailError`,
 * but with an untyped payload (no `type`) — use {@link isProblemWithStatus} for those.
 */
export function isProblemDetailError(error: unknown): error is ProblemDetailError<ProblemDetail> {
  return error instanceof ProblemDetailError;
}

/**
 * Narrow to a `ProblemDetailError` whose `type` matches a specific ContentGrid
 * problem type, discriminating the payload down to the exact member.
 *
 * @example
 * if (isProblemOfType(error, ContentGridProblemType.INTEGRITY_REQUIRED_RELATION)) {
 *   error.problemDetail.affected_relation; // typed
 * }
 */
export function isProblemOfType<T extends ContentGridProblemDetail["type"]>(
  error: unknown,
  type: T,
): error is ProblemDetailError<Extract<ContentGridProblemDetail, { readonly type: T }>> {
  return error instanceof ProblemDetailError && error.problemDetail.type === type;
}

/**
 * Narrow to a `ProblemDetailError` with a specific HTTP status. Works for opaque
 * responses that carry no `type` (e.g. `412` conflict, `403` deny, `500`).
 *
 * @example
 * if (isProblemWithStatus(error, 412)) { /* re-fetch, re-apply, retry *\/ }
 */
export function isProblemWithStatus(
  error: unknown,
  status: number,
): error is ProblemDetailError<ProblemDetail> {
  return error instanceof ProblemDetailError && error.problemDetail.status === status;
}

/**
 * Narrow to an `input/validation` problem (HTTP 400), whose per-field failures
 * are in `problemDetail.errors`.
 */
export function isValidationProblem(
  error: unknown,
): error is ProblemDetailError<ValidationProblemDetail> {
  return isProblemOfType(error, ContentGridProblemType.VALIDATION);
}

/**
 * Extract the typed per-field validation errors from a caught error, or an empty
 * array if it is not an `input/validation` problem. Useful for surfacing
 * field-level messages on a create/edit form after a failed mutation.
 */
export function getValidationFieldErrors(error: unknown): readonly ValidationFieldError[] {
  return isValidationProblem(error) ? error.problemDetail.errors : [];
}
