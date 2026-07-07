import { createFileRoute } from "@tanstack/react-router";
import { entityItemDetailRouteOptions } from "@contentgrid/features/entity-list";

// Loader/validateSearch/component are shared with navigator's identical
// route — see entityItemDetailRouteOptions in packages/features.
export const Route = createFileRoute("/_app/$entity/$itemId")(entityItemDetailRouteOptions);
