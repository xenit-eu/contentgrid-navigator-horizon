import { XIcon as X } from "@phosphor-icons/react";
import { type ProfileEntity } from "@contentgrid/navigator-data";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ColorPicker,
  IconPicker,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@contentgrid/ui";
import { resolveEntityCardIcon } from "./resolve-entity-icon";
import { useEntityDisplayPreferences } from "./use-entity-display-preferences";

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
  const EntityIcon = resolveEntityCardIcon(preferences.icon);
  const nameAttributeOptions = [profile.idAttribute, ...profile.userDefinedAttributes];
  const nameAttributeFieldId = `${profile.name}-name-attribute`;

  return (
    <Card className="max-w-sm">
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Same "icon badge is the color trigger" pattern as the entity cards on the
              `~configuration` overview — clicking the icon opens the color popover. */}
          <ColorPicker value={preferences.color} onChange={(color) => setOverride({ color })}>
            <span
              className="flex items-center justify-center rounded-md p-2"
              style={
                preferences.color
                  ? {
                      backgroundColor: `color-mix(in oklch, ${preferences.color} 18%, transparent)`,
                    }
                  : undefined
              }
            >
              <EntityIcon className="h-5 w-5 text-muted-foreground" aria-hidden />
            </span>
          </ColorPicker>
          <div>
            <CardTitle className="text-lg">{profile.pluralName}</CardTitle>
            <CardDescription>{profile.description ?? "No description"}</CardDescription>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onClose?.()}>
          <X className="h-4 w-4" aria-hidden />
          <span className="sr-only">Close</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
    </Card>
  );
}
