import type { HalFormsTemplate } from "@contentgrid/hal-forms";
import type { TypedRequestSpec } from "@contentgrid/typed-fetch";

/**
 * HAL-FORMS `search` template resolved from the entity profile (`_templates.search`).
 * Searches are executed by encoding values through this template via the
 * hal-forms codecs — never by hand-building query URLs (affordance rule 7).
 * Null when the profile exposes no search template, which means search is not
 * permitted for this entity/user (affordance rule 2).
 */
export type SearchTemplate = HalFormsTemplate<TypedRequestSpec<unknown, unknown>>;

export interface EntityInfo {
  name: string;
  title: string;
  /** Full URL of the HAL-FORMS entity profile, e.g. https://api.example.com/profile/invoices */
  href: string;
  /** Full URL of the entity collection, e.g. https://api.example.com/invoices.
   * Sourced from the root resource's cg:entity link href (matched by name) —
   * never derived from the profile URL. Entities without a matching root link
   * are not listed at all (affordance rule 2). */
  collectionHref: string;
}

export interface EntityAttribute {
  name: string;
  title: string;
  type: string;
  description?: string;
  readOnly: boolean;
  required: boolean;
  unique: boolean;
  searchable: boolean;
  prefixSearchable: boolean;
  allowedValues?: string[];
}

export interface EntityRelation {
  name: string;
  title: string;
  manyToOne: boolean;
  manyToMany: boolean;
  targetEntityHref?: string;
}

export interface SearchProperty {
  name: string;
  prompt?: string;
  type: string;
  options?: { inline?: string[] };
}

export interface CreateFormRelation {
  name: string;
  title: string;
  targetEntityName: string;
  required: boolean;
  manyToOne: boolean;
}

export interface SortOption {
  value: string;
  property: string;
  prompt: string;
}

export interface EntitySchema {
  description?: string;
  attributes: EntityAttribute[];
  relations: EntityRelation[];
  searchProperties: SearchProperty[];
  sortableFields: string[];
  sortOptions: SortOption[];
  createFormRelations: CreateFormRelation[];
  /** Resolved `_templates.search` template, or null when the profile has none. */
  searchTemplate: SearchTemplate | null;
  /** RFC 6570 URI template for a single item, e.g. https://api.example.com/invoices/{id}.
   * Read from the entity profile's _links.describes item link (name: "item",
   * templated: true) — never constructed from the collection URL. Null when the
   * link is absent, which means item access is not available (affordance rule 2). */
  itemTemplateHref: string | null;
}
