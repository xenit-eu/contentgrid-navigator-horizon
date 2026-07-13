// Typed ContentGrid problem details — a discriminated union over the generic
// RFC 9457 `ProblemDetail` base from `@contentgrid/problem-details`.
//
// Each member is keyed on its `type` URI (see `./constants`) and documents,
// in the "When it occurs" note, the exact situation that produces it plus the
// HTTP status. Field shapes are modelled from live responses captured in
// `docs/audits/app-api-robustness-findings.md`.
//
// ── Opaque responses (no `type`) ─────────────────────────────────────────────
// Not every error is `application/problem+json`. Two important cases carry NO
// `type` discriminant and therefore surface as the bare {@link ProblemDetail}
// base (with `type` undefined):
//   • `403` with an EMPTY body — the deny-by-default gateway masks unknown
//     endpoints, unknown relations AND unsupported HTTP methods this way, before
//     the application can answer. Never assume a `403` carries a problem body.
//   • `500` with a Spring Boot default error page (`{ timestamp, status, error,
//     path }`) — e.g. a NUL byte (`U+0000`) in a string value/filter. Not RFC 9457.
// Treat any `ProblemDetail` whose `type` is undefined as opaque.
import type { ProblemDetail } from "@contentgrid/problem-details";
import { ContentGridProblemType } from "./constants";

export * from "./constants";
export type { ProblemDetail };

// ─────────────────────────────────────────────────────────────────────────────
// Input validation (HTTP 400)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single entry in a {@link ValidationProblemDetail} `errors[]` array.
 *
 * Each field error is itself shaped like a problem detail (`type`/`title`/
 * `detail`) and is scoped to an input via `field` (a property path such as
 * `invoices.total`). Entity-level errors may omit `field`.
 *
 * NOTE: the live app-server uses `field` here. An earlier Navigator generation
 * used `property` + `invalid_value`; those are intentionally NOT modelled — the
 * `field` shape is authoritative.
 */
export type ValidationFieldError =
  | RequiredFieldError
  | TypeFieldError
  | TypeFormatFieldError
  | NoContentFieldError
  | DuplicateFieldError
  | AllowedValuesFieldError
  | PatternFieldError
  | MissingRelationTargetFieldError;

interface ValidationFieldErrorBase {
  /** Human-readable short title (e.g. "Mandatory field"). */
  readonly title: string;
  /** Optional longer description. Prefer `detail ?? title` for display. */
  readonly detail?: string;
  /** Property path of the offending input; absent for entity-level errors. */
  readonly field?: string;
  /** Occasionally echoed on a sub-error; usually mirrors the wrapper's 400. */
  readonly status?: number;
}

/**
 * When it occurs: a required attribute or relation is null / missing / empty.
 * Example: `POST /products {}` (no `name`), or `POST /orders {}` (no required
 * `customer` relation).
 */
export interface RequiredFieldError extends ValidationFieldErrorBase {
  readonly type: typeof ContentGridProblemType.VALIDATION_REQUIRED;
}

/**
 * When it occurs: a value has the wrong JSON data type — e.g. a JSON array or
 * object where a scalar is expected, or a decimal where a long is expected.
 * Example: `POST /products { "name": ["a","b"] }`.
 */
export interface TypeFieldError extends ValidationFieldErrorBase {
  readonly type: typeof ContentGridProblemType.VALIDATION_TYPE;
  /** Technical name of the expected type, e.g. "string". */
  readonly expected_type: string;
  /** Technical name of the received type, e.g. "list". */
  readonly actual_type: string;
}

/**
 * When it occurs: the type is right (usually string) but the format is wrong —
 * e.g. a non-RFC3339 datetime, or a relation link whose URL/entity-type does
 * not match the target. Example: `POST /invoices { "invoice_date": "nope" }`,
 * or `PUT /orders/{id}/customer` with a `/products/{id}` URL.
 */
export interface TypeFormatFieldError extends ValidationFieldErrorBase {
  readonly type: typeof ContentGridProblemType.VALIDATION_TYPE_FORMAT;
  /** Expected type / relation target, e.g. "datetime" or "entity:person". */
  readonly expected_type: string;
  /** Description of the format error. */
  readonly format_error: string;
}

/**
 * When it occurs: a content sub-field (e.g. `content.filename`) is written but
 * no actual file content is present on the attribute. Example:
 * `PATCH /animals/{id} { "content": { "filename": "x.txt" } }` with no upload.
 */
export interface NoContentFieldError extends ValidationFieldErrorBase {
  readonly type: typeof ContentGridProblemType.VALIDATION_NO_CONTENT;
}

/**
 * When it occurs: a unique-constrained attribute already holds this value on a
 * different entity item. Example: creating a second product with an existing
 * `product_code`.
 */
export interface DuplicateFieldError extends ValidationFieldErrorBase {
  readonly type: typeof ContentGridProblemType.VALIDATION_DUPLICATE;
  /** URL of the entity item that already uses this value. */
  readonly conflicting_item: string;
}

/**
 * When it occurs: the value is not one of the constrained allowed values.
 * Example: `POST /invoices { "invoice_a_type": "NotAValidCategory" }`.
 */
export interface AllowedValuesFieldError extends ValidationFieldErrorBase {
  readonly type: typeof ContentGridProblemType.VALIDATION_ALLOWED_VALUES;
  /** The full set of permitted values for the field. */
  readonly allowed_values: readonly unknown[];
}

/**
 * When it occurs: the value does not fully match the field's required regular
 * expression (the whole value must match). Example: an invalid `mimetype` on a
 * content attribute.
 */
export interface PatternFieldError extends ValidationFieldErrorBase {
  readonly type: typeof ContentGridProblemType.VALIDATION_PATTERN;
  /** The regular expression the value must match. */
  readonly pattern: string;
}

/**
 * When it occurs: an entity item being linked into a relation does not exist.
 * Example: `POST /invoices { "person": ".../persons/<non-existent-id>" }`.
 */
export interface MissingRelationTargetFieldError extends ValidationFieldErrorBase {
  readonly type: typeof ContentGridProblemType.VALIDATION_MISSING_RELATION_TARGET;
  /** URL of the entity item that does not exist. */
  readonly missing_item: string;
}

/**
 * When it occurs: one or more input validation errors on a write.
 * Raised by: `POST` on an entity-collection, `PUT`/`PATCH` on an entity-item,
 * `PUT` on a to-one relation, `POST` on a to-many relation. HTTP 400.
 *
 * The individual failures are in `errors[]` (see {@link ValidationFieldError}).
 */
export interface ValidationProblemDetail extends ProblemDetail {
  readonly type: typeof ContentGridProblemType.VALIDATION;
  readonly status: 400;
  readonly errors: readonly ValidationFieldError[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Query parameter problems (HTTP 400) — `GET` on an entity-collection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * When it occurs: a filter value cannot be converted to the expected type.
 * Example: `GET /invoices?total~gt=notanumber`.
 */
export interface FilterFormatProblem extends ProblemDetail {
  readonly type: typeof ContentGridProblemType.QUERY_FILTER_FORMAT;
  readonly status: 400;
  /** The offending query parameter name, e.g. "total~gt". */
  readonly query_parameter: string;
  /** The expected data type, e.g. "decimal". */
  readonly expected_type: string;
  /** Description of the conversion error. */
  readonly format_error: string;
  /** Additional filter-format errors when several occur at once. */
  readonly additional_errors?: readonly unknown[];
}

/**
 * When it occurs: the `_sort` parameter is malformed — not `<attr>,asc|desc`
 * (bad direction, extra parts, ...). Example: `GET /invoices?_sort=total,sideways`.
 */
export interface SortFormatProblem extends ProblemDetail {
  readonly type: typeof ContentGridProblemType.QUERY_SORT_FORMAT;
  readonly status: 400;
  /** Always `_sort`. */
  readonly query_parameter: string;
  /** Description of the format error. */
  readonly format_error: string;
}

/**
 * When it occurs: `_sort` references an attribute that does not exist or is not
 * sortable. Example: `GET /invoices?_sort=nonexistent_field,asc`.
 * (Also returned for an empty `_sort=` value.)
 */
export interface SortTargetProblem extends ProblemDetail {
  readonly type: typeof ContentGridProblemType.QUERY_SORT_TARGET;
  readonly status: 400;
  /** Always `_sort`. */
  readonly query_parameter: string;
  /** The sort target that could not be sorted on. */
  readonly target_name: string;
}

/**
 * When it occurs: a pagination parameter is invalid — `_size` out of the 1..1000
 * range, or a `_cursor` that was manually constructed / no longer valid.
 * Example: `GET /products?_size=0` or `GET /invoices?_cursor=garbage`.
 */
export interface PaginationProblem extends ProblemDetail {
  readonly type: typeof ContentGridProblemType.QUERY_PAGINATION;
  readonly status: 400;
  /** The offending parameter, e.g. "_size" or "_cursor". */
  readonly query_parameter: string;
  /** Description of the error. */
  readonly format_error: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// General request problems (HTTP 400)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * When it occurs: the request body is malformed and cannot be parsed, and no
 * more specific body problem applies.
 */
export interface InvalidBodyProblem extends ProblemDetail {
  readonly type: typeof ContentGridProblemType.REQUEST_BODY;
  readonly status: 400;
}

/**
 * When it occurs: the request body is not valid JSON.
 * Example: `POST /products` with body `{ this is not json`.
 */
export interface InvalidBodyJsonProblem extends ProblemDetail {
  readonly type: typeof ContentGridProblemType.REQUEST_BODY_JSON;
  readonly status: 400;
}

/**
 * When it occurs: a `text/uri-list` body cannot be parsed.
 * Example: `POST /invoices/{id}/products` with a body containing illegal URIs.
 */
export interface InvalidBodyUriListProblem extends ProblemDetail {
  readonly type: typeof ContentGridProblemType.REQUEST_BODY_URI_LIST;
  readonly status: 400;
}

/**
 * When it occurs: a to-one relation `PUT` did not contain exactly one link
 * (zero or multiple). Example: `PUT /invoices/{id}/person` with two URIs.
 */
export interface SingleLinkProblem extends ProblemDetail {
  readonly type: typeof ContentGridProblemType.REQUEST_BODY_SINGLE_LINK;
  readonly status: 400;
}

/**
 * When it occurs: a required HTTP header is missing from the request.
 * (Rare in normal integration.)
 */
export interface RequiredHeaderProblem extends ProblemDetail {
  readonly type: typeof ContentGridProblemType.REQUEST_REQUIRED_HEADER;
  readonly status: 400;
  /** The missing header name. */
  readonly header: string;
}

/**
 * When it occurs: a header that is not allowed is present on the request.
 */
export interface ForbiddenHeaderProblem extends ProblemDetail {
  readonly type: typeof ContentGridProblemType.REQUEST_FORBIDDEN_HEADER;
  readonly status: 400;
  /** The forbidden header name. */
  readonly header: string;
}

/**
 * When it occurs: a header has a syntactically invalid value.
 */
export interface InvalidHeaderProblem extends ProblemDetail {
  readonly type: typeof ContentGridProblemType.REQUEST_INVALID_HEADER;
  readonly status: 400;
  /** The invalid header name. */
  readonly header: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Version conflict (HTTP 412)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * When it occurs: an `If-Match` / `If-None-Match` conditional request does not
 * match the current entity version (optimistic-locking failure). Re-fetch,
 * re-apply the change, and retry. HTTP 412.
 */
export interface UnsatisfiedVersionProblem extends ProblemDetail {
  readonly type: typeof ContentGridProblemType.UNSATISFIED_VERSION;
  readonly status: 412;
  /** The current version (ETag) of the entity. */
  readonly actual_version?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Not found (HTTP 404)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * When it occurs: the URL does not match any known endpoint (typo in an entity,
 * relation, or attribute name).
 *
 * NOTE: in a gateway-fronted deployment this is usually UNOBSERVABLE — the
 * deny-by-default gateway returns an opaque `403` for unknown paths instead.
 */
export interface NotFoundEndpointProblem extends ProblemDetail {
  readonly type: typeof ContentGridProblemType.NOT_FOUND_ENDPOINT;
  readonly status: 404;
}

/**
 * When it occurs: no entity item exists with the given id — it was deleted,
 * never existed, or is hidden by ABAC. Example: `GET /invoices/<unknown-id>`.
 */
export interface NotFoundEntityItemProblem extends ProblemDetail {
  readonly type: typeof ContentGridProblemType.NOT_FOUND_ENTITY_ITEM;
  readonly status: 404;
}

/**
 * When it occurs: a relation does not contain the requested item — a to-one
 * relation with nothing linked, or a to-many relation-item that is not linked.
 * Example: `GET /invoices/{id}/person` when no person is set.
 */
export interface NotFoundRelationItemProblem extends ProblemDetail {
  readonly type: typeof ContentGridProblemType.NOT_FOUND_RELATION_ITEM;
  readonly status: 404;
}

/**
 * When it occurs: a content attribute has no stored content.
 * Example: `GET /animals/{id}/content` when nothing was uploaded.
 */
export interface NotFoundContentProblem extends ProblemDetail {
  readonly type: typeof ContentGridProblemType.NOT_FOUND_CONTENT;
  readonly status: 404;
}

// ─────────────────────────────────────────────────────────────────────────────
// Integrity (HTTP 409)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * When it occurs: a to-one relation target is already referenced by another
 * entity, and the operation would silently overwrite that reference. Unlink the
 * existing relation first (`DELETE existing_relation`), then link.
 * Raised by `PUT` on a one-to-one relation, `POST` on a one-to-many relation,
 * or `POST` on an entity-collection. HTTP 409.
 */
export interface BlindRelationOverwriteProblem extends ProblemDetail {
  readonly type: typeof ContentGridProblemType.INTEGRITY_BLIND_RELATION_OVERWRITE;
  readonly status: 409;
  /** URL of the entity you are trying to link. */
  readonly new_item?: string;
  /** URL of the relation you are trying to set. */
  readonly new_relation?: string;
  /** URL of the entity currently linked. */
  readonly existing_item?: string;
  /** URL of the existing relation. */
  readonly existing_relation?: string;
  /** URL of the target entity. */
  readonly target_item?: string;
  /** URL of the inverse relation, if available. */
  readonly target_relation?: string;
  /** Additional overwrite errors when several occur at once. */
  readonly additional_errors?: readonly unknown[];
}

/**
 * When it occurs: an entity item is referenced by a REQUIRED relation, so it
 * cannot be deleted, and the depended-on target cannot be removed. Delete or
 * re-link the referencing entity first. HTTP 409.
 * Example: `DELETE /persons/{id}` while that person is the required `customer`
 * of an order.
 *
 * NOTE: directly unlinking a required to-one from its OWNING side
 * (`DELETE /orders/{id}/customer`) instead yields a
 * {@link ValidationProblemDetail} `required` (HTTP 400), not this 409.
 */
export interface RequiredRelationProblem extends ProblemDetail {
  readonly type: typeof ContentGridProblemType.INTEGRITY_REQUIRED_RELATION;
  readonly status: 409;
  /** URL of the relation that requires this entity. */
  readonly affected_relation: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Union of all typed ContentGrid problem details
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Discriminated union of every known ContentGrid problem detail, keyed on `type`.
 *
 * Narrow with the `type` field against {@link ContentGridProblemType}. Responses
 * that are not `application/problem+json` (opaque `403`, Spring `500`) do not
 * appear here — they surface as the bare {@link ProblemDetail} with no `type`.
 */
export type ContentGridProblemDetail =
  | ValidationProblemDetail
  | FilterFormatProblem
  | SortFormatProblem
  | SortTargetProblem
  | PaginationProblem
  | InvalidBodyProblem
  | InvalidBodyJsonProblem
  | InvalidBodyUriListProblem
  | SingleLinkProblem
  | RequiredHeaderProblem
  | ForbiddenHeaderProblem
  | InvalidHeaderProblem
  | UnsatisfiedVersionProblem
  | NotFoundEndpointProblem
  | NotFoundEntityItemProblem
  | NotFoundRelationItemProblem
  | NotFoundContentProblem
  | BlindRelationOverwriteProblem
  | RequiredRelationProblem;
