// ContentGrid application problem-detail `type` URIs.
//
// Every problem returned by the ContentGrid Application REST API as
// `application/problem+json` carries a `type` URI under a common prefix.
// These string-literal constants are the discriminant used to narrow a
// `ContentGridProblemDetail` union member.
//
// Catalogue reference:
//   https://docs.contentgrid.com/reference/app-api/problem-types/
// Field shapes verified live against a running application, see:
//   docs/audits/app-api-robustness-findings.md

/**
 * The common URI prefix shared by all ContentGrid problem `type` values.
 */
export const CONTENTGRID_PROBLEM_PREFIX = "https://contentgrid.cloud/problems/" as const;

/**
 * String-literal constants for every ContentGrid problem-detail `type` URI.
 *
 * Use these as the discriminant when narrowing a {@link ContentGridProblemDetail},
 * e.g. `if (problem.type === ContentGridProblemType.VALIDATION_DUPLICATE) { ... }`.
 *
 * NOTE: some error responses are NOT `application/problem+json` and therefore
 * have no `type` at all — see the "opaque responses" note in `index.ts`.
 */
export const ContentGridProblemType = {
  // ── Input validation (HTTP 400) ────────────────────────────────────────────
  /** Wrapper for one or more field-level validation errors (`errors[]`). */
  VALIDATION: `${CONTENTGRID_PROBLEM_PREFIX}input/validation`,
  /** A required attribute or relation was null / missing / empty. */
  VALIDATION_REQUIRED: `${CONTENTGRID_PROBLEM_PREFIX}input/validation/required`,
  /** A value had the wrong JSON data type (e.g. array where a scalar is expected). */
  VALIDATION_TYPE: `${CONTENTGRID_PROBLEM_PREFIX}input/validation/type`,
  /** Correct type but wrong format (e.g. a non-RFC3339 datetime string). */
  VALIDATION_TYPE_FORMAT: `${CONTENTGRID_PROBLEM_PREFIX}input/validation/type/format`,
  /** A content sub-field was set while no content (file) is present. */
  VALIDATION_NO_CONTENT: `${CONTENTGRID_PROBLEM_PREFIX}input/validation/no-content`,
  /** A unique attribute already holds this value on another entity item. */
  VALIDATION_DUPLICATE: `${CONTENTGRID_PROBLEM_PREFIX}input/validation/duplicate`,
  /** The value is not one of the constrained allowed values. */
  VALIDATION_ALLOWED_VALUES: `${CONTENTGRID_PROBLEM_PREFIX}input/validation/allowed-values`,
  /** The value does not fully match the required regular expression. */
  VALIDATION_PATTERN: `${CONTENTGRID_PROBLEM_PREFIX}input/validation/pattern`,
  /** A relation target being linked does not exist. */
  VALIDATION_MISSING_RELATION_TARGET: `${CONTENTGRID_PROBLEM_PREFIX}input/validation/missing-relation-target`,

  // ── Query parameter problems (HTTP 400) ────────────────────────────────────
  /** A filter value could not be converted to the expected type. */
  QUERY_FILTER_FORMAT: `${CONTENTGRID_PROBLEM_PREFIX}invalid-query-parameter/filter/format`,
  /** The `_sort` parameter is malformed (not `<attr>,asc|desc`). */
  QUERY_SORT_FORMAT: `${CONTENTGRID_PROBLEM_PREFIX}invalid-query-parameter/sort/format`,
  /** The `_sort` parameter references a non-existent / unsortable attribute. */
  QUERY_SORT_TARGET: `${CONTENTGRID_PROBLEM_PREFIX}invalid-query-parameter/sort/target`,
  /** A pagination parameter (`_cursor` / `_size`) is invalid. */
  QUERY_PAGINATION: `${CONTENTGRID_PROBLEM_PREFIX}invalid-query-parameter/pagination`,

  // ── General request problems (HTTP 400) ────────────────────────────────────
  /** The request body is malformed and cannot be parsed. */
  REQUEST_BODY: `${CONTENTGRID_PROBLEM_PREFIX}invalid-request/body`,
  /** The request body contains malformed JSON. */
  REQUEST_BODY_JSON: `${CONTENTGRID_PROBLEM_PREFIX}invalid-request/body/json`,
  /** The request body contains a malformed `text/uri-list`. */
  REQUEST_BODY_URI_LIST: `${CONTENTGRID_PROBLEM_PREFIX}invalid-request/body/uri-list`,
  /** A to-one relation `PUT` did not contain exactly one link. */
  REQUEST_BODY_SINGLE_LINK: `${CONTENTGRID_PROBLEM_PREFIX}invalid-request/body/single-link`,
  /** A required HTTP header is missing. */
  REQUEST_REQUIRED_HEADER: `${CONTENTGRID_PROBLEM_PREFIX}invalid-request/required-header`,
  /** A forbidden HTTP header is present. */
  REQUEST_FORBIDDEN_HEADER: `${CONTENTGRID_PROBLEM_PREFIX}invalid-request/forbidden-header`,
  /** An HTTP header has a syntactically invalid value. */
  REQUEST_INVALID_HEADER: `${CONTENTGRID_PROBLEM_PREFIX}invalid-request/invalid-header`,

  // ── Version conflict (HTTP 412) ────────────────────────────────────────────
  /** The `If-Match` / `If-None-Match` version does not match the current one. */
  UNSATISFIED_VERSION: `${CONTENTGRID_PROBLEM_PREFIX}unsatisfied-version`,

  // ── Not found (HTTP 404) ───────────────────────────────────────────────────
  /** The URL does not match any known endpoint (entity/relation/attribute name). */
  NOT_FOUND_ENDPOINT: `${CONTENTGRID_PROBLEM_PREFIX}not-found/endpoint`,
  /** No entity item exists with the specified id (or access is denied). */
  NOT_FOUND_ENTITY_ITEM: `${CONTENTGRID_PROBLEM_PREFIX}not-found/entity-item`,
  /** The relation does not contain the requested item / is not linked. */
  NOT_FOUND_RELATION_ITEM: `${CONTENTGRID_PROBLEM_PREFIX}not-found/relation-item`,
  /** No content is stored in the content attribute. */
  NOT_FOUND_CONTENT: `${CONTENTGRID_PROBLEM_PREFIX}not-found/content`,

  // ── Integrity (HTTP 409) ───────────────────────────────────────────────────
  /** A to-one relation target is already referenced elsewhere; linking would overwrite it. */
  INTEGRITY_BLIND_RELATION_OVERWRITE: `${CONTENTGRID_PROBLEM_PREFIX}integrity/blind-relation-overwrite`,
  /** The entity item is referenced by a required relation (delete / unlink blocked). */
  INTEGRITY_REQUIRED_RELATION: `${CONTENTGRID_PROBLEM_PREFIX}integrity/required-relation`,
} as const;

/**
 * Union of all known ContentGrid problem `type` URIs.
 */
export type ContentGridProblemTypeUri =
  (typeof ContentGridProblemType)[keyof typeof ContentGridProblemType];
