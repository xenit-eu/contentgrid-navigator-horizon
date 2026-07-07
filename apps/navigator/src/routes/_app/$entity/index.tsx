import { createFileRoute } from "@tanstack/react-router";
import { entityDetailRouteOptions } from "@contentgrid/features/entity-list";

// Loader/validateSearch/component are shared with navigator-experimental's
// identical route — see entityDetailRouteOptions in packages/features.
export const Route = createFileRoute("/_app/$entity/")(entityDetailRouteOptions);
