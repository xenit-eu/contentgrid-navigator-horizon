/**
 * Internal barrel for `entity-item`'s content-focus variation (spec `002-pdf-viewer`): renders a
 * content attribute's PDF next to the item's attributes and relations. Re-exported publicly from
 * `@contentgrid/features/entity-item` (see `packages/features/src/entity-item/index.ts`) —
 * `entity-item` carries no stability tag (the tag lives on views). Promoted from `apps/navigator-experimental` to
 * `apps/navigator` (ACC-2902 content-focus promotion); both apps mount it now (see
 * `packages/features/src/entity-item/CLAUDE.md` for scope and history).
 *
 * `EntityItemContentFocus` is the public entry point (contract
 * `contracts/content-focus-view.md`); `EntityItemAutoVariation` (`../entity-item-auto-variation.tsx`)
 * renders it for an item with content attributes. The view above
 * (`@contentgrid/views/entity-item-detail`) resolves the `entityItem` and hands it in; neither draws
 * chrome of its own, per Principle VIII. The rest of the exports below are its building blocks,
 * exported for their own stories/tests.
 */
export { pdfiumWasmUrl } from "./util/pdfium-wasm-url";
export { selectDefaultContentAttribute } from "./util/select-default-content-attribute";
export {
  ContentAttributeOptionSelector,
  ContentAttributeSelector,
} from "./components/content-attribute-selector";
export type { ContentAttributeSelectorProps } from "./components/content-attribute-selector";
export { ContentPreviewFrame } from "./components/content-preview-frame";
export type {
  ContentPreviewState,
  ContentPreviewFrameProps,
  ContentPreviewFrameLabels,
} from "./components/content-preview-frame";
export { FilePreview } from "./components/file-preview";
export { ContentPreviewPanel } from "./components/content-preview-panel";
export type { ContentPreviewPanelProps } from "./components/content-preview-panel";
export { EntityItemContentFocus } from "./entity-item-content-focus";
