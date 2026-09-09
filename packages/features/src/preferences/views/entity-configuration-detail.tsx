import { useState } from "react";
import { EyeIcon, PlusCircleIcon, TableIcon, XIcon as X } from "@phosphor-icons/react";
import { type ProfileAttribute, type ProfileEntity } from "@contentgrid/navigator-data";
import {
  AttributeMultiSelect,
  AttributeSelect,
  Button,
  ColorPicker,
  ColorPickerContent,
  EntityCard,
  IconPicker,
  Label,
  type ProfileAttributeOption,
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

function toAttributeOption(attribute: ProfileAttribute, isSystem: boolean): ProfileAttributeOption {
  return {
    name: attribute.name,
    title: attribute.title,
    description: attribute.description,
    type: attribute.isContent
      ? "content"
      : (attribute.type as unknown as ProfileAttributeOption["type"]),
    isSystem,
  };
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
  const regularOptions = [profile.idAttribute, ...profile.userDefinedAttributes].map((attribute) =>
    toAttributeOption(attribute, false),
  );
  const systemOptions = profile.auditAttributes.map((attribute) =>
    toAttributeOption(attribute, true),
  );
  // Name/subtitle can point at any attribute, including audit fields (e.g. "modified date").
  const attributeOptions = [...regularOptions, ...systemOptions];
  // Visible columns are limited to what the collection table actually renders (id + user-defined).
  const columnOptions = regularOptions;
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
        <div className="flex flex-col gap-6 @3xl:flex-row">
          <div className="min-w-0 flex-1">
            <TabbedLayout
              tabs={PREVIEW_TABS.map((tab) => ({ ...tab, active: tab.key === activeTab }))}
              renderTabLink={(tab, label) => (
                <TabLink
                  key={tab.key}
                  href="#"
                  active={tab.active}
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

          <div className="bg-border hidden w-px self-stretch @3xl:block" aria-hidden />

          <div className="space-y-4 @3xl:w-72 @3xl:shrink-0">
            <ColorPickerContent
              value={preferences.color}
              onChange={(color) => setOverride({ color })}
            />

            <div className="space-y-1.5">
              <Label>Icon</Label>
              <IconPicker value={preferences.icon} onChange={(icon) => setOverride({ icon })} />
            </div>

            <AttributeSelect
              label="Name attribute"
              attributes={attributeOptions}
              value={preferences.nameAttribute}
              onSelect={(attribute) => setOverride({ nameAttribute: attribute.name })}
              placeholder="Choose attribute"
            />

            <AttributeSelect
              label="Subtitle attribute"
              attributes={attributeOptions}
              value={preferences.subtitleAttribute}
              onSelect={(attribute) => setOverride({ subtitleAttribute: attribute.name })}
              placeholder="Choose attribute"
            />

            <AttributeMultiSelect
              label="Visible columns"
              attributes={columnOptions}
              values={preferences.visibleColumns ?? []}
              onChange={(names) => setOverride({ visibleColumns: [...names] })}
              placeholder="Choose columns"
            />
          </div>
        </div>
      </div>
    </EntityCard>
  );
}
