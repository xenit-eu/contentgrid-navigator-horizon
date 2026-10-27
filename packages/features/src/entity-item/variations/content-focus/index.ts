/**
 * Internal barrel for `entity-item`'s content-focus variation (spec `002-pdf-viewer`): renders a
 * content attribute's PDF next to the item's attributes and relations. Re-exported publicly from
 * `@contentgrid/features/entity-item` (see `packages/features/src/entity-item/index.ts`) —
 * `entity-item` itself is `x-stability: "stable"`. Promoted from `apps/navigator-experimental` to
 * `apps/navigator` (ACC-2902 content-focus promotion); both apps mount it now (see
 * `packages/features/src/entity-item/CLAUDE.md` for scope and history).
 *
 * `EntityItemContentFocusBody` is the public entry point (contract
 * `contracts/content-focus-view.md`) — the view above (`@contentgrid/views/entity-item-detail`)
 * resolves the `entityItem` and hands it in, drawing no chrome of its own, per Principle VIII. The
 * rest of the exports below are its building blocks, exported for their own stories/tests.
 */
export { pdfiumWasmUrl } from "./util/pdfium-wasm-url";
export { selectDefaultContentAttribute } from "./util/select-default-content-attribute";
export { ContentAttributeSelector } from "./components/content-attribute-selector";
export type { ContentAttributeSelectorProps } from "./components/content-attribute-selector";
export { ContentPreviewFrame } from "./components/content-preview-frame";
export type {
  ContentPreviewState,
  ContentPreviewFrameProps,
  ContentPreviewFrameLabels,
} from "./components/content-preview-frame";
export { ContentPreviewPanel } from "./components/content-preview-panel";
export type { ContentPreviewPanelProps } from "./components/content-preview-panel";
export {
  EntityItemContentFocusBody,
  entityItemContentFocusPadding,
} from "./body/entity-item-content-focus-body";
export type { EntityItemContentFocusBodyProps } from "./body/entity-item-content-focus-body";
