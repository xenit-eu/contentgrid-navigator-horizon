import baseConfig from "@contentgrid/eslint-config";
import { uiLayerConfig } from "@contentgrid/eslint-config/layers";

// L3 (ui never imports features) and L4 (ui never imports views).
export default [...baseConfig, ...uiLayerConfig()];
