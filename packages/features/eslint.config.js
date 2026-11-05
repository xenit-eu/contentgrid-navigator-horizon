import baseConfig from "@contentgrid/eslint-config";
import { featuresLayerConfig } from "@contentgrid/eslint-config/layers";

// L2 (features never import the router) and L4 (features never import views).
//
// Known L2 violation, kept on purpose: the unsaved-changes guard uses the router's blocker, and
// where it lives is an open question that spec 005 leaves out of scope ("it stays as it is in
// this series"). The guard and the tests that mount it inside a router are exempt from L2 only;
// delete this list when the guard moves to the host (spec 005, out of scope; SC-007).
const ROUTER_EXEMPT = [
  "src/unsaved-changes-guard/**",
  "src/entity-item/attributes/editable-entity-item-attributes.test.tsx",
  "src/entity-item/edit/edit-entity-item-container.test.tsx",
  "src/entity-item/variations/attribute-focus/entity-item-attribute-focus.edit.test.tsx",
];

export default [...baseConfig, ...featuresLayerConfig(ROUTER_EXEMPT)];
