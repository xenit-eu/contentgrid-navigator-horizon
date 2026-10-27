import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useViewNavigation } from "@contentgrid/views";
import {
  EntityProfileGate,
  ensureEntityProfileLoaded,
} from "@contentgrid/views/entity-profile-gate";

export const Route = createFileRoute("/_app/~configuration/$entity")({
  beforeLoad: ({ context, params }) => ensureEntityProfileLoaded(context, params.entity),
  component: EntityGateRoute,
});

function EntityGateRoute() {
  const { entity } = Route.useParams();
  const navigation = useViewNavigation();

  return (
    <EntityProfileGate entityName={entity} onBackHome={() => navigation.openHome()}>
      <Outlet />
    </EntityProfileGate>
  );
}
