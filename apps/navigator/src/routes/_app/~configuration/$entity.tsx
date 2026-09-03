import { createFileRoute } from "@tanstack/react-router";
import {
  EntityProfileGate,
  ensureEntityProfileLoaded,
} from "@contentgrid/features/entity-profile-gate";

export const Route = createFileRoute("/_app/~configuration/$entity")({
  beforeLoad: ({ context, params }) => ensureEntityProfileLoaded(context, params.entity),
  component: EntityProfileGate,
});
