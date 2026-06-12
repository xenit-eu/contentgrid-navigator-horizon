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

/** A normalised option entry — both inline and remote options are normalised to this shape. */
export interface OptionEntry {
  value: string;
  prompt: string;
}

export interface SearchProperty {
  name: string;
  prompt?: string;
  type: string;
  options?: {
    /** Inline enumerated values, normalised to { value, prompt } pairs. */
    inline?: OptionEntry[];
    /** Remote options resource: fetch application/hal+json from href and use embedded item resources. */
    link?: { href: string };
  };
  /** Whether this field is required (from the template property). */
  required?: boolean;
  /** Whether this field is read-only (from the template property). */
  readOnly?: boolean;
}

export interface CreateFormRelation {
  name: string;
  title: string;
  targetEntityName: string;
  required: boolean;
  manyToOne: boolean;
}

/**
 * A non-relation property in the create-form template, with full constraint metadata
 * carried through the schema bridge so client-side validation can mirror the server contract.
 */
export interface CreateFormField {
  name: string;
  prompt?: string;
  type: string;
  required: boolean;
  readOnly: boolean;
  /** Inline enumerated values allowed by the server (from options.inline). */
  allowedValues?: OptionEntry[];
  /** Remote options resource (from options.link). */
  optionsLink?: { href: string };
  /** Regex pattern the value must satisfy (from the template property, if present). */
  pattern?: string;
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
  /** Non-relation create-form fields with full constraint metadata. */
  createFormFields: CreateFormField[];
}
