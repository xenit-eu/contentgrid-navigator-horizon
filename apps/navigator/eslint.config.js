import baseConfig from "@contentgrid/eslint-config";
import { appsViewsOnly, restrictSources } from "@contentgrid/eslint-config/layers";
import { contentgridPlugin } from "@contentgrid/eslint-config/plugin";

// L1: apps import features only through views. These features have no view yet, so the apps still
// import them directly. Transitional and app-owned: delete an entry when its view lands, and at
// go-live the list must be empty or each remaining feature audited (ADR-006 amendment, go-live
// steps; spec 005 T063). `preferences` stays listed: the feature still exists and the apps import
// it (the user-preferences work is deferred).
const PENDING_VIEW_FEATURES = ["app-info-pages", "entity-item-create", "preferences", "search"];

// local-mock-backend is dev-only tooling — only main.tsx's DEV-gated enableMocking() may import
// it. Files inside local-mock-backend/ are exempt so they can import each other. ESLint replaces
// (never merges) a rule's options between entries, so the non-exempt entry carries L1 and this
// restriction together.
const LOCAL_MOCK_BACKEND_EXEMPT = ["src/main.tsx", "src/local-mock-backend/**"];
const LOCAL_MOCK_BACKEND = {
  specifier: String.raw`(^|/)local-mock-backend(/|$)`,
  message:
    "local-mock-backend is dev-only; only main.tsx's DEV-gated enableMocking() may import it.",
};

export default [
  ...baseConfig,
  {
    plugins: { "@contentgrid": contentgridPlugin },
    rules: {
      // Pre-GA the stability gate is suspended — views of every tier (the x-stability tag lives
      // on views, not features) are importable here. Restore to ["stable"] at go-live (see the
      // ADR-006 amendment's go-live steps).
      "@contentgrid/no-unstable-views": [
        "error",
        { allowedStability: ["experimental", "candidate", "stable"] },
      ],
    },
  },
  {
    files: ["tests/**"],
    rules: {
      "no-empty-pattern": "off",
    },
  },
  {
    name: "contentgrid/layers/apps",
    ignores: LOCAL_MOCK_BACKEND_EXEMPT,
    rules: restrictSources([...appsViewsOnly(PENDING_VIEW_FEATURES), LOCAL_MOCK_BACKEND]),
  },
  {
    name: "contentgrid/layers/apps/local-mock-backend-exempt",
    files: LOCAL_MOCK_BACKEND_EXEMPT,
    rules: restrictSources(appsViewsOnly(PENDING_VIEW_FEATURES)),
  },
];
