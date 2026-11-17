import baseConfig from "@contentgrid/eslint-config";
import { viewsLayerConfig } from "@contentgrid/eslint-config/layers";

// L2 (no router outside src/shells/) and L5 (a view never imports a less stable view).
export default [...baseConfig, ...viewsLayerConfig()];
