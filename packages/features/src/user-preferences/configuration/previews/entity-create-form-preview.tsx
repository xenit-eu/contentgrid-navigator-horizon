import { type ProfileEntity } from "@contentgrid/navigator-data";
import { Alert, AlertDescription, AlertList, AlertListItem, AlertTitle } from "@contentgrid/ui";

export interface EntityCreateFormPreviewProps {
  readonly profile: ProfileEntity;
}

/**
 * Placeholder for the entity's create-form preview — the HAL-FORMS-driven field
 * renderer (ADR-004) doesn't exist yet, so this only reports whether creation is
 * allowed and, if so, which fields the eventual form will need to render.
 */
export function EntityCreateFormPreview({ profile }: Readonly<EntityCreateFormPreviewProps>) {
  const createTemplate = profile.createTemplate;

  if (!createTemplate) {
    return (
      <Alert tone="warning">
        <AlertTitle>Create is not allowed</AlertTitle>
        <AlertDescription>
          This entity has no create template — creating {profile.pluralName} is not permitted.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert tone="info">
      <AlertTitle>Create form preview coming soon</AlertTitle>
      <AlertDescription>
        The create-form field renderer hasn&apos;t been built yet. Once it lands, this tab will
        render a create form for {profile.singularName} with these fields:
        <AlertList>
          {createTemplate.userDefinedProperties.map((prop) => (
            <AlertListItem key={prop.property.name}>
              {prop.property.prompt ?? prop.property.name}
              {prop.isRequired && " *"}
            </AlertListItem>
          ))}
        </AlertList>
      </AlertDescription>
    </Alert>
  );
}
