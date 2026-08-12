// Maps any caught error (typed ContentGrid problem, opaque problem, or plain
// `Error`) to a flat, presentation-ready `ProblemDisplayModel`. This is the
// bridge consumed by the `ProblemAlert` UI component — no HAL objects, no
// class instances, just plain data a renderer can switch on.
//
// Unrecognized problem `type`s (forward-compat: a future addition to
// `ContentGridProblemDetail` this module hasn't been updated for yet) and
// unrecognized `errors[]` field-error `type`s fall back to `"unknown"` /
// `"unknownField"` respectively, rather than throwing.
import { ContentGridProblemType } from "./constants";
import { isProblemDetailError, isProblemOfType, isValidationProblem } from "./guards";
import type { ValidationFieldError } from "./index";

/**
 * A single `errors[]` entry from a {@link ValidationProblemDetail}, flattened
 * for display. `message` is always `detail ?? title`.
 */
export type ValidationFieldDisplay =
  | { readonly kind: "required"; readonly field?: string; readonly message: string }
  | {
      readonly kind: "type";
      readonly field?: string;
      readonly message: string;
      readonly expectedType: string;
      readonly actualType: string;
    }
  | {
      readonly kind: "typeFormat";
      readonly field?: string;
      readonly message: string;
      readonly expectedType: string;
      readonly formatError: string;
    }
  | { readonly kind: "noContent"; readonly field?: string; readonly message: string }
  | {
      readonly kind: "duplicate";
      readonly field?: string;
      readonly message: string;
      readonly conflictingItem: string;
    }
  | {
      readonly kind: "allowedValues";
      readonly field?: string;
      readonly message: string;
      readonly allowedValues: readonly unknown[];
    }
  | {
      readonly kind: "pattern";
      readonly field?: string;
      readonly message: string;
      readonly pattern: string;
    }
  | {
      readonly kind: "missingRelationTarget";
      readonly field?: string;
      readonly message: string;
      readonly missingItem: string;
    }
  | { readonly kind: "unknownField"; readonly field?: string; readonly message: string };

/**
 * Flat, presentation-ready shape for any caught mutation/query error.
 * Build one with {@link toProblemDisplayModel}.
 *
 * `type` is the raw RFC 9457 `type` URI when known — per RFC 9457 §3.1.1,
 * dereferencing it should show human-readable documentation for the problem.
 * Undefined for a plain `Error` or an opaque problem (masked 403, Spring 500).
 */
export type ProblemDisplayModel =
  | {
      readonly kind: "validation";
      readonly status: number;
      readonly title: string;
      readonly detail?: string;
      readonly type?: string;
      readonly fields: readonly ValidationFieldDisplay[];
    }
  | {
      readonly kind: "queryParameter";
      readonly status: number;
      readonly title: string;
      readonly detail?: string;
      readonly type?: string;
      readonly parameter: string;
      readonly message: string;
    }
  | {
      readonly kind: "requestBody";
      readonly status: number;
      readonly title: string;
      readonly detail?: string;
      readonly type?: string;
    }
  | {
      readonly kind: "header";
      readonly status: number;
      readonly title: string;
      readonly detail?: string;
      readonly type?: string;
      readonly header: string;
    }
  | {
      readonly kind: "unsatisfiedVersion";
      readonly status: number;
      readonly title: string;
      readonly detail?: string;
      readonly type?: string;
      readonly actualVersion?: string;
    }
  | {
      readonly kind: "notFound";
      readonly status: number;
      readonly title: string;
      readonly detail?: string;
      readonly type?: string;
    }
  | {
      readonly kind: "blindRelationOverwrite";
      readonly status: number;
      readonly title: string;
      readonly detail?: string;
      readonly type?: string;
      readonly existingItem?: string;
      readonly existingRelation?: string;
      readonly newItem?: string;
      readonly newRelation?: string;
    }
  | {
      readonly kind: "requiredRelation";
      readonly status: number;
      readonly title: string;
      readonly detail?: string;
      readonly type?: string;
      readonly affectedRelation: string;
    }
  | {
      readonly kind: "unknown";
      readonly status?: number;
      readonly title: string;
      readonly detail?: string;
      readonly type?: string;
    };

function toValidationFieldDisplay(fe: ValidationFieldError): ValidationFieldDisplay {
  const { field } = fe;
  const message = fe.detail ?? fe.title;
  switch (fe.type) {
    case ContentGridProblemType.VALIDATION_REQUIRED:
      return { kind: "required", field, message };
    case ContentGridProblemType.VALIDATION_TYPE:
      return {
        kind: "type",
        field,
        message,
        expectedType: fe.expected_type,
        actualType: fe.actual_type,
      };
    case ContentGridProblemType.VALIDATION_TYPE_FORMAT:
      return {
        kind: "typeFormat",
        field,
        message,
        expectedType: fe.expected_type,
        formatError: fe.format_error,
      };
    case ContentGridProblemType.VALIDATION_NO_CONTENT:
      return { kind: "noContent", field, message };
    case ContentGridProblemType.VALIDATION_DUPLICATE:
      return { kind: "duplicate", field, message, conflictingItem: fe.conflicting_item };
    case ContentGridProblemType.VALIDATION_ALLOWED_VALUES:
      return { kind: "allowedValues", field, message, allowedValues: fe.allowed_values };
    case ContentGridProblemType.VALIDATION_PATTERN:
      return { kind: "pattern", field, message, pattern: fe.pattern };
    case ContentGridProblemType.VALIDATION_MISSING_RELATION_TARGET:
      return {
        kind: "missingRelationTarget",
        field,
        message,
        missingItem: fe.missing_item,
      };
    default:
      return { kind: "unknownField", field, message };
  }
}

/**
 * Turn any caught mutation/query error into a flat {@link ProblemDisplayModel}.
 * Handles plain `Error`s (pre-fetch guard failures, network errors), opaque
 * problems (masked `403`, Spring Boot `500`), and every typed
 * `ContentGridProblemDetail` member.
 */
export function toProblemDisplayModel(error: unknown): ProblemDisplayModel {
  if (!isProblemDetailError(error)) {
    const message = error instanceof Error ? error.message : String(error);
    return { kind: "unknown", title: "Something went wrong", detail: message };
  }

  const { status, title, detail, type } = error.problemDetail;

  if (type === undefined) {
    return { kind: "unknown", status, title, detail };
  }

  if (isValidationProblem(error)) {
    return {
      kind: "validation",
      status,
      title,
      detail,
      type,
      fields: error.problemDetail.errors.map(toValidationFieldDisplay),
    };
  }

  if (
    isProblemOfType(error, ContentGridProblemType.QUERY_FILTER_FORMAT) ||
    isProblemOfType(error, ContentGridProblemType.QUERY_SORT_FORMAT) ||
    isProblemOfType(error, ContentGridProblemType.QUERY_SORT_TARGET) ||
    isProblemOfType(error, ContentGridProblemType.QUERY_PAGINATION)
  ) {
    const problem = error.problemDetail;
    const message =
      "format_error" in problem
        ? problem.format_error
        : `Unsupported sort target: ${problem.target_name}`;
    return {
      kind: "queryParameter",
      status,
      title,
      detail,
      type,
      parameter: problem.query_parameter,
      message,
    };
  }

  if (
    isProblemOfType(error, ContentGridProblemType.REQUEST_BODY) ||
    isProblemOfType(error, ContentGridProblemType.REQUEST_BODY_JSON) ||
    isProblemOfType(error, ContentGridProblemType.REQUEST_BODY_URI_LIST) ||
    isProblemOfType(error, ContentGridProblemType.REQUEST_BODY_SINGLE_LINK)
  ) {
    return { kind: "requestBody", status, title, detail, type };
  }

  if (
    isProblemOfType(error, ContentGridProblemType.REQUEST_REQUIRED_HEADER) ||
    isProblemOfType(error, ContentGridProblemType.REQUEST_FORBIDDEN_HEADER) ||
    isProblemOfType(error, ContentGridProblemType.REQUEST_INVALID_HEADER)
  ) {
    return { kind: "header", status, title, detail, type, header: error.problemDetail.header };
  }

  if (isProblemOfType(error, ContentGridProblemType.UNSATISFIED_VERSION)) {
    return {
      kind: "unsatisfiedVersion",
      status,
      title,
      detail,
      type,
      actualVersion: error.problemDetail.actual_version,
    };
  }

  if (
    isProblemOfType(error, ContentGridProblemType.NOT_FOUND_ENDPOINT) ||
    isProblemOfType(error, ContentGridProblemType.NOT_FOUND_ENTITY_ITEM) ||
    isProblemOfType(error, ContentGridProblemType.NOT_FOUND_RELATION_ITEM) ||
    isProblemOfType(error, ContentGridProblemType.NOT_FOUND_CONTENT)
  ) {
    return { kind: "notFound", status, title, detail, type };
  }

  if (isProblemOfType(error, ContentGridProblemType.INTEGRITY_BLIND_RELATION_OVERWRITE)) {
    const problem = error.problemDetail;
    return {
      kind: "blindRelationOverwrite",
      status,
      title,
      detail,
      type,
      existingItem: problem.existing_item,
      existingRelation: problem.existing_relation,
      newItem: problem.new_item,
      newRelation: problem.new_relation,
    };
  }

  if (isProblemOfType(error, ContentGridProblemType.INTEGRITY_REQUIRED_RELATION)) {
    return {
      kind: "requiredRelation",
      status,
      title,
      detail,
      type,
      affectedRelation: error.problemDetail.affected_relation,
    };
  }

  // Forward-compat: a `type` we don't (yet) model. Keep `type` so the caller
  // can still offer a "view problem type" link even for a problem this
  // module hasn't been updated to map to a specific kind.
  return { kind: "unknown", status, title, detail, type };
}
