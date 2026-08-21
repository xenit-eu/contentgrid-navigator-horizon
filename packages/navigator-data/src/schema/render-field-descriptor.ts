import type { SimpleLink } from "@contentgrid/hal";
import type { HalFormsProperty } from "@contentgrid/hal-forms";
import type { ProfileRelation } from "../accessors/relation-profile";

/**
 * Fields every RenderFieldDescriptor variant carries. `property` is the original HAL-FORMS
 * property — kept on every variant so the bridge never has to be extended just to stop dropping
 * a field the caller turns out to need (see packages/navigator-data/CLAUDE.md's "carry full
 * template property metadata through the RenderFieldDescriptor bridge" rule).
 */
export interface RenderFieldDescriptorBase {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description?: string;
  readonly property: HalFormsProperty;
}

export interface FieldOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Where an enum-like field's choices come from. Kept as a discriminated union rather than
 * collapsing to a plain `options` array — dropping `link` for a remote enumeration would
 * silently break forms with server-resolved allowed values (see the CLAUDE.md rule above).
 * Resolving `link` into options is a data-fetching concern and stays out of the descriptor
 * itself (packages/ui/CLAUDE.md forbids `packages/ui` from resolving it directly).
 */
export type FieldOptionsSource =
  | { readonly kind: "inline"; readonly options: readonly FieldOption[] }
  | { readonly kind: "remote"; readonly link: SimpleLink };

/** One bound of a date-range field, pointing at its own independently-named HAL-FORMS property. */
export interface RangeBound {
  readonly name: string;
  readonly label: string;
}

/**
 * RenderFieldDescriptor discriminated union (ADR-004's "FieldDescriptor switch" in place of a
 * JSONForms-style tester/rank registry). One variant per rendering shape a `packages/ui`
 * form-renderer needs to handle — see `packages/ui/src/patterns/form-renderers/`.
 *
 * `date-range` has no corresponding ContentGrid attribute type — it only ever arises from a
 * *search* template's `~from`/`~until` (or `~after`/`~before`) operator-pair convention, grouped
 * by `SearchHalFormTemplateProperty.groupKey` (see extended-forms/search-form.ts). `from`/`until`
 * point at the two independently-named HAL-FORMS properties, mirroring how FilterSidebar already
 * groups and renders this exact pair (packages/ui/src/patterns/filter-sidebar/filter-sidebar.tsx)
 * — never a single synthesized `{from, until}` value, since the wire protocol has no such object.
 */
export type RenderFieldDescriptor = RenderFieldDescriptorBase &
  (
    | {
        readonly type: "text";
        readonly regex: RegExp;
        readonly minLength: number;
        readonly maxLength: number;
      }
    | { readonly type: "number" }
    | { readonly type: "boolean" }
    | { readonly type: "datetime"; readonly includesTime: boolean }
    | { readonly type: "date-range"; readonly from: RangeBound; readonly until: RangeBound }
    | { readonly type: "enum"; readonly optionsSource: FieldOptionsSource }
    | { readonly type: "enum-multi"; readonly optionsSource: FieldOptionsSource }
    | { readonly type: "file"; readonly multiple: boolean }
    | {
        readonly type: "relation-to-one";
        readonly profileRelation?: ProfileRelation;
        readonly targetCollectionHref: string;
      }
    | {
        readonly type: "relation-to-many";
        readonly profileRelation?: ProfileRelation;
        readonly targetCollectionHref: string;
      }
    | { readonly type: "typeahead" }
  );

export type RenderFieldDescriptorType = RenderFieldDescriptor["type"];
