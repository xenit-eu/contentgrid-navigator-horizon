import type { HalFormsField } from "../../hal-forms";

/**
 * View models of the entity search bar (specs/003-single-search-bar-entity-item-collection,
 * data-model.md). They are plain data, built by the pure functions in this folder; components
 * pick icons and render them. Nothing here is React- or HAL-wire-specific.
 */

/** What kind of value a search parameter takes (data-model.md §2). */
export type SearchValueKind =
  | "text"
  | "integer"
  | "decimal"
  | "date"
  | "datetime"
  | "boolean"
  | "allowed-values";

/** How a search parameter matches (data-model.md §2). */
export type SearchMode =
  | "prefix"
  | "full-text"
  | "exact"
  | "allowed-values"
  | "gt"
  | "gte"
  | "lt"
  | "lte";

export interface SearchParamOption {
  readonly value: string;
  readonly label: string;
}

/** One search parameter of the entity's search form, normalised (data-model.md §2). */
export interface SearchParamDescriptor {
  /** HAL-FORMS property name, e.g. `customer.name~prefix` — also the `filters` key. */
  readonly name: string;
  /** Attribute key, e.g. `customer.name`; groups the parameters of one attribute. */
  readonly groupKey: string;
  /** Title of the attribute the parameter searches (the target attribute for a relation). */
  readonly attributeLabel: string;
  /** Field label from `resolveHalFormsFields` (prompt-based). */
  readonly label: string;
  readonly valueKind: SearchValueKind;
  readonly mode: SearchMode;
  /** Set when the parameter searches through a relation. */
  readonly relation?: { readonly name: string; readonly title: string };
  /** Audit role of a direct attribute, from its profile constraints — never from its name. */
  readonly auditRole?: "created" | "modified";
  /** Inline options of an allowed-values parameter. */
  readonly options?: readonly SearchParamOption[];
  /** The resolved field, for rendering through `hal-forms`. */
  readonly field: HalFormsField;
}

/** The selector's state (data-model.md §3). */
export type SelectorMode =
  | { readonly kind: "all" }
  | { readonly kind: "all-direct" }
  | { readonly kind: "param"; readonly name: string };

/** Classification of the typed input (data-model.md §4). */
export type InputClass = "empty" | "integer" | "decimal" | "text";

/** A result count shown on a parameter chip or a suggestion group header (data-model.md §5). */
export type CountState =
  | { readonly status: "unknown" }
  | { readonly status: "loading" }
  | { readonly status: "known"; readonly count: number; readonly isEstimated: boolean }
  | { readonly status: "error" };
