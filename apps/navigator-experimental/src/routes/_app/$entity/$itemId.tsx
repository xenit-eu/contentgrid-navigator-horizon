import { createFileRoute } from "@tanstack/react-router";
import {
  EntityItemDetailPage,
  ensureEntityItemDetailLoaderData,
} from "@contentgrid/features/entity-browser";

export const Route = createFileRoute("/_app/$entity/$itemId")({
  loader: ({ context, params }) => ensureEntityItemDetailLoaderData(context, params.itemId),
  component: EntityItemDetailPage,
});
