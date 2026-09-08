import type { HalFormsProperty } from "@contentgrid/navigator-data";
import type { EnumOption } from "@contentgrid/ui";

/**
 * Fields every `FieldDescriptor` variant carries. Unlike the retired
 * `RenderFieldDescriptor` (packages/navigator-data/src/form-fields/render-field-descriptor.ts,
 * deleted by this restructure), the raw `property` is carried through unmodified rather than
 * pre-flattened into a lossy subset — a renderer that needs template metadata this shape doesn't
 * surface as its own typed field (e.g. resolving a remote option link) reads it directly off
 * `property`, instead of the bridge needing a second retrofit every time a renderer needs one
 * more constraint. `property`'s type (`HalFormsProperty`) is re-exported from
 * `@contentgrid/navigator-data`'s barrel rather than imported from `@contentgrid/hal-forms`
 * directly — see that package's CLAUDE.md forbidden-imports rule.
 */
export interface FieldDescriptorBase {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description?: string;
  readonly property: HalFormsProperty;
}

/**
 * `kind`-discriminated union driving `render/field-renderer.tsx` (ADR-004's replacement
 * FieldRenderer). One variant per rendering shape. Covers only the create-form path (ACC-3128,
 * attributes-only) — this union is not meant to grow a variant per hypothetical future form kind.
 *
 * Neither `filter` nor `sort` are members here, and neither should be added speculatively:
 * - Filtering already has a real, working, differently-shaped home —
 *   `packages/features/src/search/filter-properties.ts`'s `SearchFilterProperty` (from
 *   `@contentgrid/ui`), built directly off `SearchHalFormTemplate` with its own operator/range/
 *   redundancy logic. There is no future migration that would route filter fields through this
 *   type instead, so a `filter` kind here would just be a second, guessed-shape, unused
 *   implementation of something already solved.
 * - Sort, in legacy Navigator, is never a per-field concept — there's no "sort field" rendered
 *   one-at-a-time alongside attribute inputs. It's a single control over the whole collection
 *   view: the `_sort` HAL-FORMS property's inline options are read directly
 *   (`CollectionSearchTable.tsx`) to drive column-header sort toggles, entirely outside the
 *   attribute-form renderer. It would need its own small dedicated type/component reading the
 *   search template's `_sort` property directly, not a `kind` in this per-field union.
 */
export type FieldDescriptor =
  | ({ readonly kind: "text" } & FieldDescriptorBase & {
        readonly regex?: RegExp;
        readonly maxLength?: number;
        /** Set for the HAL-FORMS `email` wire type; unset for plain `text`. There is no `url`
         * variant here — that wire type is reserved exclusively for relations on this platform
         * (see `userDefinedProperties`'s doc comment in navigator-data's create-form.ts) and never
         * reaches this descriptor. */
        readonly format?: "email";
      })
  | ({ readonly kind: "number" } & FieldDescriptorBase & {
        readonly min?: number;
        readonly max?: number;
        readonly step?: number;
      })
  | ({ readonly kind: "datetime" } & FieldDescriptorBase & { readonly includesTime: boolean })
  | ({ readonly kind: "boolean" } & FieldDescriptorBase)
  | ({ readonly kind: "file" } & FieldDescriptorBase & { readonly multiple: boolean })
  | ({ readonly kind: "enum" } & FieldDescriptorBase & {
        readonly options: readonly EnumOption[];
        readonly multiValue: boolean;
      })
  | ({ readonly kind: "relation" } & FieldDescriptorBase & {
        readonly cardinality: "to-one" | "to-many";
        readonly targetHref: string;
        readonly valueField: string;
      });

export type FieldDescriptorKind = FieldDescriptor["kind"];
