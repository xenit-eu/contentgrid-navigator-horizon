import { XIcon as X } from "@phosphor-icons/react";
import { type ProfileEntity } from "@contentgrid/navigator-data";
import {
  Button,
  ColorPicker,
  EntityCard,
  IconPicker,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@contentgrid/ui";
import { EntityIconBadge } from "../../layout";
import { useEntityDisplayPreferences } from "../use-entity-display-preferences";

export interface EntityConfigurationDetailProps {
  readonly profile: ProfileEntity;
  /** Called when the close button is clicked (e.g. navigate back to the configuration list). */
  readonly onClose?: () => void;
}

/**
 * Per-entity configuration detail page (`~configuration/$entity`). Currently color, icon,
 * and name-attribute — intentionally sparse; more configuration will land here over time.
 */
export function EntityConfigurationDetail({
  profile,
  onClose,
}: Readonly<EntityConfigurationDetailProps>) {
  const { preferences, setOverride } = useEntityDisplayPreferences(profile);
  const nameAttributeOptions = [profile.idAttribute, ...profile.userDefinedAttributes];
  const nameAttributeFieldId = `${profile.name}-name-attribute`;

  return (
    <EntityCard
      titleVariant="default"
      name={profile.singularName}
      title={profile.pluralName}
      header="Configure display"
      indentSubtitle={false}
      description={`Change configuration settings for this entity. Changes in this page will reflect how ${profile.pluralName} are rendered.`}
      action={
        <Button variant="ghost" size="icon" onClick={() => onClose?.()}>
          <X className="h-4 w-4" aria-hidden />
          <span className="sr-only">Close</span>
        </Button>
      }
      icon={
        <ColorPicker value={preferences.color} onChange={(color) => setOverride({ color })}>
          <EntityIconBadge profile={profile} />
        </ColorPicker>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Icon</Label>
          <IconPicker value={preferences.icon} onChange={(icon) => setOverride({ icon })} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={nameAttributeFieldId}>Name attribute</Label>
          <Select
            value={preferences.nameAttribute}
            onValueChange={(value) => setOverride({ nameAttribute: value })}
          >
            <SelectTrigger id={nameAttributeFieldId} className="w-full">
              <SelectValue placeholder="Choose attribute" />
            </SelectTrigger>
            <SelectContent>
              {nameAttributeOptions.map((attribute) => (
                <SelectItem key={attribute.name} value={attribute.name}>
                  {attribute.title ?? attribute.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </EntityCard>
  );
}
