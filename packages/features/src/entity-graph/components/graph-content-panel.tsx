import { ArrowLeftIcon } from "@phosphor-icons/react";
import type { EntityItem } from "@contentgrid/navigator-data";
import { Button } from "@contentgrid/ui";
import { ContentPreviewPanel, EntityItemReference } from "../../entity-item";

export interface GraphContentPanelProps {
  /** The item holding the file. */
  readonly item: EntityItem;
  readonly attributeName: string;
  readonly attributeTitle: string;
  readonly onBack: () => void;
}

/** Preview of the file behind a content node, in the graph's details panel. */
export function GraphContentPanel({
  item,
  attributeName,
  attributeTitle,
  onBack,
}: Readonly<GraphContentPanelProps>) {
  return (
    <section
      aria-label={`${attributeTitle} preview`}
      className="flex h-full min-h-[480px] flex-col gap-3"
    >
      <Button type="button" variant="ghost" size="sm" onClick={onBack} className="-ml-2 self-start">
        <ArrowLeftIcon />
        Back to details
      </Button>
      <header className="space-y-1">
        <EntityItemReference item={item} size="sm" />
        <h2 className="text-sm font-semibold">{attributeTitle}</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
        <ContentPreviewPanel entityItem={item} attributeName={attributeName} />
      </div>
    </section>
  );
}
