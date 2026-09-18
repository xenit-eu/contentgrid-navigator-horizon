import type {
  HalFormsProperty,
  ProfileEntity,
  SearchHalFormTemplateProperty,
} from "@contentgrid/navigator-data";
import type { EnumOption } from "@contentgrid/ui";

/**
 * Everything `useTypeahead` (`@contentgrid/navigator-data`) needs to fetch suggestions for one
 * search-form autocomplete field, resolved once (at `resolveHalFormsFields` time) from the
 * `SearchHalFormTemplate` a field came from. Static/template-derived — same lifecycle as the
 * rest of `HalFormsField`, unlike `FieldState.autocomplete` (runtime suggestion results).
 * `undefined` for a create-form field, or a search field the caller opted into `autocomplete`
 * for without a matching search property (defensive; shouldn't normally happen).
 */
export interface SearchAutocompleteContext {
  readonly profileEntity: ProfileEntity;
  readonly searchProperty: SearchHalFormTemplateProperty;
}

/**
 * Fields every `HalFormsField` variant carries. Generalizes `entity-item-create`'s
 * `FieldDescriptorBase` (ADR-004) to also cover a search-form property, not just a create-form
 * one — see `model/resolve-hal-forms-fields.ts`.
 *
 * Deliberately does NOT carry `provenance` here — provenance (FR-013) describes the field's
 * CURRENT value's origin, which changes at runtime (a user edits it, an external caller fills
 * it) independently of the template-derived shape this type describes. It lives in the
 * stateful layer instead (`state/field-error.ts`'s `FieldState.provenance`), passed to
 * `HalFormsFieldRenderer` the same way `value`/`error` already are — never baked into a value
 * resolved once from a template.
 */
export interface HalFormsFieldBase {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description?: string;
  readonly property: HalFormsProperty;
}

/**
 * `kind`-discriminated union driving `render/hal-forms-field-renderer.tsx`. Adds `autocomplete`
 * (FR-017) to the set of kinds `entity-item-create`'s `FieldDescriptor` already covers; every
 * other kind's shape is unchanged from that type.
 */
export type HalFormsField =
  | ({ readonly kind: "text" } & HalFormsFieldBase & {
        readonly regex?: RegExp;
        readonly maxLength?: number;
        readonly format?: "email";
      })
  | ({ readonly kind: "number" } & HalFormsFieldBase)
  | ({ readonly kind: "datetime" } & HalFormsFieldBase & { readonly includesTime: boolean })
  | ({ readonly kind: "boolean" } & HalFormsFieldBase)
  | ({ readonly kind: "file" } & HalFormsFieldBase & { readonly multiple: boolean })
  | ({ readonly kind: "enum" } & HalFormsFieldBase & {
        readonly options: readonly EnumOption[];
        readonly multiValue: boolean;
      })
  | ({ readonly kind: "autocomplete" } & HalFormsFieldBase & {
        readonly multiValue: boolean;
        readonly searchContext?: SearchAutocompleteContext;
      });
