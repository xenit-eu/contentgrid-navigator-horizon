import { createFileRoute } from "@tanstack/react-router";
import {
  EntityDetailPage,
  ensureEntityDetailLoaderData,
} from "@contentgrid/features/entity-browser";
import { entitySearchStateValidator } from "@contentgrid/navigator-data";

export const Route = createFileRoute("/_app/$entity/")({
  validateSearch: entitySearchStateValidator,
  loaderDeps: ({ search }) => ({ cursor: search.cursor }),
  loader: ({ context, deps }) => ensureEntityDetailLoaderData(context, deps.cursor),
  component: EntityDetailPage,
});
