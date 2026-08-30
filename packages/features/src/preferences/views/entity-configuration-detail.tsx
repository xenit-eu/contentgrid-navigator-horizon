import { useState } from "react";
import { EyeIcon, PlusCircleIcon, TableIcon, XIcon as X } from "@phosphor-icons/react";
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
  TabLink,
  TabbedLayout,
} from "@contentgrid/ui";
import { EntityIconBadge } from "../../layout";
import { useEntityDisplayPreferences } from "../use-entity-display-preferences";
import { EntityCreateFormPreview } from "./previews/entity-create-form-preview";
import { EntityItemPreview } from "./previews/entity-item-preview";
import { EntityTablePreview } from "./previews/entity-table-preview";

export interface EntityConfigurationDetailProps {
  readonly profile: ProfileEntity;
  /** Called when the close button is clicked (e.g. navigate back to the configuration list). */
  readonly onClose?: () => void;
}

const PREVIEW_TABS = [
  {
    key: "item",
    label: "Item Preview",
    icon: <EyeIcon aria-hidden />,
    iconColor: "oklch(0.55 0.18 250)",
  },
  {
    key: "collection",
    label: "Collection Preview",
    icon: <TableIcon aria-hidden />,
    iconColor: "oklch(0.58 0.14 190)",
  },
  {
    key: "create",
    label: "Create Form",
    icon: <PlusCircleIcon aria-hidden />,
    iconColor: "oklch(0.65 0.18 55)",
  },
] as const;

/**
 * Per-entity configuration detail page (`~configuration/$entity`). Currently color, icon,
 * and name-attribute — intentionally sparse; more configuration will land here over time.
 */
export function EntityConfigurationDetail({
  profile,
  onClose,
}: Readonly<EntityConfigurationDetailProps>) {
  const { preferences, setOverride } = useEntityDisplayPreferences(profile);
  const attributeOptions = [profile.idAttribute, ...profile.userDefinedAttributes];
  const nameAttributeFieldId = `${profile.name}-name-attribute`;
  const subtitleAttributeFieldId = `${profile.name}-subtitle-attribute`;
  const [activeTab, setActiveTab] = useState<(typeof PREVIEW_TABS)[number]["key"]>("item");

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
      <div className="@container">
        <div className="grid gap-6 @3xl:grid-cols-2">
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
                  {attributeOptions.map((attribute) => (
                    <SelectItem key={attribute.name} value={attribute.name}>
                      {attribute.title ?? attribute.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={subtitleAttributeFieldId}>Subtitle attribute</Label>
              <Select
                value={preferences.subtitleAttribute}
                onValueChange={(value) => setOverride({ subtitleAttribute: value })}
              >
                <SelectTrigger id={subtitleAttributeFieldId} className="w-full">
                  <SelectValue placeholder="Choose attribute" />
                </SelectTrigger>
                <SelectContent>
                  {attributeOptions.map((attribute) => (
                    <SelectItem key={attribute.name} value={attribute.name}>
                      {attribute.title ?? attribute.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <TabbedLayout
            tabs={PREVIEW_TABS.map((tab) => ({ ...tab, active: tab.key === activeTab }))}
            renderTabLink={(tab, label) => (
              <TabLink
                key={tab.key}
                href="#"
                active={tab.active}
                icon={tab.icon}
                iconColor={tab.iconColor}
                onClick={(event) => {
                  event.preventDefault();
                  setActiveTab(tab.key as (typeof PREVIEW_TABS)[number]["key"]);
                }}
              >
                {label}
              </TabLink>
            )}
          >
            {activeTab === "item" && <EntityItemPreview profile={profile} />}
            {activeTab === "collection" && <EntityTablePreview profile={profile} />}
            {activeTab === "create" && <EntityCreateFormPreview profile={profile} />}
          </TabbedLayout>
        </div>
      </div>
    </EntityCard>
  );
}
