import { Suspense, lazy } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";

// Dev-only tooling. The Application Selector can repoint Navigator at an
// arbitrary backend / OIDC issuer, so it must never be reachable in a
// production (stable) build. Gating the dynamic import on import.meta.env.DEV
// — which Vite statically folds to a literal — lets Rollup tree-shake the
// selector (and the whole @contentgrid/dev-tools package) out of the
// production bundle entirely. Mirrors the MSW pattern in main.tsx.
const ApplicationSelectorPage = import.meta.env.DEV
  ? lazy(() =>
      import("@contentgrid/dev-tools").then((m) => ({
        default: m.ApplicationSelectorPage,
      })),
    )
  : null;

export const Route = createFileRoute("/config")({
  beforeLoad() {
    if (!import.meta.env.DEV) {
      throw redirect({ to: "/" });
    }
  },
  component: ConfigRoute,
});

function ConfigRoute() {
  if (!ApplicationSelectorPage) return null;
  return (
    <Suspense fallback={null}>
      <ApplicationSelectorPage />
    </Suspense>
  );
}
