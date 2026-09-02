import type { SimpleLink } from "@contentgrid/hal";
import type { ProfileRelation } from "../accessors/relation-profile";

/**
 * Fields every RenderFieldDescriptor variant carries. Every piece of template metadata a
 * `packages/ui` renderer needs (validation constraints, options) is surfaced as its own typed
 * field on the relevant variant — see packages/navigator-data/CLAUDE.md's "carry full template
 * property metadata through the RenderFieldDescriptor bridge" rule. There is no raw
 * `HalFormsProperty` pass-through: `packages/ui` and `packages/features` are both forbidden from
 * importing `@contentgrid/hal-forms` directly, so a field no renderer can construct or read
 * without casting is dead weight, not a safety net.
 */
export interface RenderFieldDescriptorBase {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description?: string;
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

/**
 * RenderFieldDescriptor discriminated union (ADR-004's "FieldDescriptor switch" in place of a
 * JSONForms-style tester/rank registry). One variant per rendering shape a `packages/ui`
 * form-renderer needs to handle — see `packages/ui/src/patterns/form-renderers/`.
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
