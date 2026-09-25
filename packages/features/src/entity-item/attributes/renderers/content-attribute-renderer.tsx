import type { EntityItem, EntityItemAttributeContent } from "@contentgrid/navigator-data";
import { toProblemDisplayModel, useUploadContent } from "@contentgrid/navigator-data";
import { AttributeValue, FileUpload, formatFileSize } from "@contentgrid/ui";
import { ProblemAlert } from "../../../problem-details";

export interface ContentAttributeRendererProps {
  readonly attribute: EntityItemAttributeContent;
  /**
   * The entity item `attribute` belongs to. Passing it enables the "Replace" upload affordance,
   * gated on `entityItem.canUploadContent`. Omit it to render read-only (e.g. collection tables or
   * relation previews).
   */
  readonly entityItem?: EntityItem;
}

function MetadataValue({
  metadata,
}: Readonly<{ metadata: EntityItemAttributeContent["metadata"] }>) {
  if (metadata == null) {
    return <AttributeValue />;
  }

  return (
    <AttributeValue className="text-xs text-muted-foreground/80">
      {`${metadata.filename ?? "Document"} · ${formatFileSize(metadata.length)}`}
    </AttributeValue>
  );
}

/**
 * The stored file with a "Replace" button (or a dropped file) that uploads a new file over this
 * content attribute. While the upload is pending or failed, the picked file (the mutation's
 * `variables`) is shown straight away; clearing it cancels the upload
 * or discards the failure.
 */
function ReplaceableContentValue({
  attribute,
  entityItem,
}: Readonly<{ attribute: EntityItemAttributeContent; entityItem: EntityItem }>) {
  const { mutate, progress, isPending, error, variables, cancel } = useUploadContent(
    entityItem,
    attribute.name,
  );

  const pendingFile = isPending || error ? variables?.file : undefined;

  return (
    <div className="flex max-w-md flex-col gap-2">
      <FileUpload
        variant="inline"
        currentFileMetadata={
          pendingFile
            ? { filename: pendingFile.name, mimetype: pendingFile.type, length: pendingFile.size }
            : attribute.metadata
        }
        status={
          isPending ? { isLoading: true, error: null, progress } : { isLoading: false, error }
        }
        onUpload={(file) => (file ? mutate({ file }) : cancel())}
        onRetry={pendingFile && (() => mutate({ file: pendingFile }))}
      />
      {error && <ProblemAlert model={toProblemDisplayModel(error)} />}
    </div>
  );
}

export function ContentAttributeRenderer({
  attribute,
  entityItem,
}: Readonly<ContentAttributeRendererProps>) {
  if (entityItem?.canUploadContent(attribute.name)) {
    return (
      <ReplaceableContentValue
        // Remount per item so a pending replace never carries over to another item.
        key={entityItem.id}
        attribute={attribute}
        entityItem={entityItem}
      />
    );
  }

  return <MetadataValue metadata={attribute.metadata} />;
}
