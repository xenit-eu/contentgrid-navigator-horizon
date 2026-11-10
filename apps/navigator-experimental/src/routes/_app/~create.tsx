import { createFileRoute, useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { ClassifyCreateEntityItemPanel } from "@contentgrid/features/entity-item-create";

export const Route = createFileRoute("/_app/~create")({
  component: ClassifyCreateEntityItemRoute,
});

function ClassifyCreateEntityItemRoute() {
  const go = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();

  return (
    <ClassifyCreateEntityItemPanel
      onSelect={(profile) =>
        go({ to: "/$entity/~create", params: { entity: profile.name }, search: {} })
      }
      onCancel={() => (canGoBack ? router.history.back() : go({ to: "/", search: {} }))}
    />
  );
}
