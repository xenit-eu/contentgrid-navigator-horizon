import { createFileRoute } from "@tanstack/react-router";
import {
  EntityProfileGate,
  ensureEntityProfileGateLoaderData,
} from "@contentgrid/features/entity-browser";

export const Route = createFileRoute("/_app/$entity")({
  beforeLoad: ({ context, params }) => ensureEntityProfileGateLoaderData(context, params.entity),
  component: EntityProfileGate,
});
