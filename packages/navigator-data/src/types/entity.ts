export interface EntityInfo {
  name: string;
  title: string;
  href: string;
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

/** Template-level affordance from a profile's `create-form` entry. */
export interface CreateFormTemplate {
  /** HTTP method to use when creating an entity (typically "POST"). */
  method: string;
  /** Target URL for creation; falls back to the entity collection href when absent. */
  target: string | null;
  /** Content-Type for the request body; falls back to "application/json" when absent. */
  contentType: string | null;
}

export interface EntitySchema {
  description?: string;
  attributes: EntityAttribute[];
  relations: EntityRelation[];
  searchProperties: SearchProperty[];
  sortableFields: string[];
  sortOptions: SortOption[];
  createFormRelations: CreateFormRelation[];
  /**
   * Parsed affordance from the profile's `_templates.create-form` entry.
   * Null when the profile does not carry a create-form template (creation not allowed).
   */
  createFormTemplate: CreateFormTemplate | null;
}
