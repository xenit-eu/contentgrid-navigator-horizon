/**
 * Internal barrel for `entity-item`'s content-focus variation (spec `002-pdf-viewer`): renders a
 * content attribute's PDF next to the item's attributes and relations. Re-exported publicly from
 * `@contentgrid/features/entity-item` (see `packages/features/src/entity-item/index.ts`) —
 * `entity-item` itself is `x-stability: "stable"`, but this variation is mounted only by
 * `apps/navigator-experimental` (see `packages/features/src/entity-item/CLAUDE.md` for scope);
 * `apps/navigator` (the generic app) must not import it.
 *
 * `EntityItemContentFocusView` is the public entry point (contract
 * `contracts/content-focus-view.md`) — an app mounts it with `entityName`/`itemId`/`toolbar`/
 * relation callbacks only, per Principle VIII. The rest of the exports below are its building
 * blocks, exported for their own stories/tests.
 */
export { pdfiumWasmUrl } from "./util/pdfium-wasm-url";
export { selectDefaultContentAttribute } from "./util/select-default-content-attribute";
export { ContentFocusLayout } from "./components/content-focus-layout";
export type { ContentFocusLayoutProps } from "./components/content-focus-layout";
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
export { EntityItemContentFocusView } from "./views/entity-item-content-focus-view";
export type {
  EntityItemContentFocusViewProps,
  ViewToolbarConfiguration,
  ViewToolbarOptions,
} from "./views/entity-item-content-focus-view";
