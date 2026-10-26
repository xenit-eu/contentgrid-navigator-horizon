import { Outlet, useParams } from "@tanstack/react-router";
import { useViewNavigation } from "../../navigation";
import { EntityProfileGate } from "./entity-profile-gate";

/** `EntityProfileGate` as the component of a `/$entity` layout route. */
export function EntityProfileGateRoute() {
  const { entity: entityName } = useParams({ strict: false }) as { entity: string };
  const navigation = useViewNavigation();

  return (
    <EntityProfileGate entityName={entityName} onBackHome={() => navigation.openHome()}>
      <Outlet />
    </EntityProfileGate>
  );
}
