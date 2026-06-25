import { useNavigate, useParams } from "@tanstack/react-router";
import { useProfileEntities } from "@contentgrid/navigator-data";
import { BrandingHeader, ProfileEntitySelector } from "@contentgrid/ui";

export function NavigatorHeader() {
  const navigate = useNavigate();
  const profileEntityResults = useProfileEntities();
  const profileEntities = profileEntityResults.filter((r) => r.data).map((r) => r.data!);

  const { entity: urlEntity } = useParams({ strict: false }) as { entity?: string };
  const selectedProfileEntity = profileEntities.find((e) => e.name === urlEntity) ?? null;

  return (
    <BrandingHeader
      title="Navigator"
      actions={
        <ProfileEntitySelector
          entities={profileEntities}
          selectedEntity={selectedProfileEntity ?? undefined}
          onSelect={async (entity) => {
            await navigate({ to: "/$entity", params: { entity: entity.name } });
          }}
        />
      }
    />
  );
}
