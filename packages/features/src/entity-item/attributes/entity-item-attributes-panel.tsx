import { useState } from "react";
import { PencilSimpleIcon } from "@phosphor-icons/react";
import type { EntityItem, UpdateHalFormTemplate } from "@contentgrid/navigator-data";
import { Button } from "@contentgrid/ui";
import { EditEntityItemView } from "../edit/edit-entity-item-view";
import { EntityItemAttributes } from "./entity-item-attributes";

/**
 * An item's "Attributes" section, with the Edit action at the right of its heading when the item
 * has an update form. While editing, the update form takes the attributes' place. Callers key it
 * by item, so edit mode never carries over to another item.
 */
export function EntityItemAttributesPanel({ item }: Readonly<{ item: EntityItem }>) {
  const [editTemplate, setEditTemplate] = useState<UpdateHalFormTemplate | null>(null);
  const { updateTemplate } = item;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Attributes</h2>
        {!editTemplate && updateTemplate && (
          <Button variant="outline" size="sm" onClick={() => setEditTemplate(updateTemplate)}>
            <PencilSimpleIcon aria-hidden />
            Edit
          </Button>
        )}
      </div>
      {editTemplate ? (
        <EditEntityItemView
          item={item}
          updateTemplate={editTemplate}
          onClose={() => setEditTemplate(null)}
        />
      ) : (
        <EntityItemAttributes item={item} />
      )}
    </div>
  );
}
