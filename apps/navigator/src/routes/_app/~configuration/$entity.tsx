import { createFileRoute } from "@tanstack/react-router";
import {
  EntityProfileGateRoute,
  ensureEntityProfileLoaded,
} from "@contentgrid/views/entity-profile-gate";

export const Route = createFileRoute("/_app/~configuration/$entity")({
  beforeLoad: ({ context, params }) => ensureEntityProfileLoaded(context, params.entity),
  component: EntityProfileGateRoute,
});
