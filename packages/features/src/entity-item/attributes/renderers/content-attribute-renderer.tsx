import { type ReactNode, useCallback, useState } from "react";
import { DownloadSimpleIcon, PencilSimpleIcon } from "@phosphor-icons/react";
import type { EntityItem } from "@contentgrid/navigator-data";
import {
  toProblemDisplayModel,
  useDownloadContent,
  useUploadContent,
} from "@contentgrid/navigator-data";
import { AttributeValue, Button, ContentUploadField, formatFileSize } from "@contentgrid/ui";
import { ProblemAlert } from "../../../problem-details";

export interface ContentAttributeRendererProps {
  readonly metadata: { readonly filename: string | null; readonly length: number } | null;
  readonly icon?: ReactNode;
  /**
   * The owning entity item and this attribute's name. Passing both enables a "Replace"
   * upload affordance, gated on `entityItem.canUploadContent(attributeName)`. Omit either
   * to render the metadata read-only (e.g. contexts with no upload capability, such as
   * collection tables or relation previews).
   */
  readonly entityItem?: EntityItem;
  readonly attributeName?: string;
}

function MetadataValue({
  metadata,
  icon,
}: Readonly<Pick<ContentAttributeRendererProps, "metadata" | "icon">>) {
  if (metadata == null) {
    return <AttributeValue />;
  }

  const text = `${metadata.filename ?? "Untitled"} · ${formatFileSize(metadata.length)}`;
  const value = (
    <AttributeValue className="text-xs text-muted-foreground/80">{text}</AttributeValue>
  );

  if (!icon) {
    return value;
  }

  return (
    <span className="flex items-center gap-1.5">
      {icon}
      {value}
    </span>
  );
}

/**
 * Downloads the current content attribute value via `useDownloadContent`, then hands the
 * fetched blob to the browser through a throwaway object URL + synthetic anchor click — the
 * only way to trigger a native "save as" for in-memory bytes that didn't come from a real URL.
 */
function DownloadContentButton({
  entityItem,
  attributeName,
  filename,
}: Readonly<{ entityItem: EntityItem; attributeName: string; filename: string | null }>) {
  const { mutate, isPending } = useDownloadContent(entityItem, attributeName, {
    mutationOptions: {
      onSuccess: (data) => {
        const url = URL.createObjectURL(data.blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = data.filename ?? filename ?? "";
        link.click();
        URL.revokeObjectURL(url);
      },
    },
  });

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      type="button"
      disabled={isPending}
      onClick={() => mutate()}
    >
      <DownloadSimpleIcon />
      <span className="sr-only">Download file</span>
    </Button>
  );
}

/**
 * Renders the metadata plus a "Replace" button that lets the user PUT a new file over this
 * content attribute, with progress/cancel/retry via `useUploadContent` + `ContentUploadField`.
 * Only mounted by `ContentAttributeRenderer` once upload is confirmed permitted, so the hook
 * call here is unconditional (Rules of Hooks) even though the capability itself is conditional.
 *
 * Retry re-sends `mutate({ file: pendingFile })` against the SAME `entityItem` prop this
 * component was rendered with. Content upload sends no `If-Match` (see
 * `entityItem.uploadContentRequest`), so unlike a HAL-FORMS entity update, a retry can never
 * surface a 412 — it always applies as an unconditional overwrite.
 *
 * `ContentUploadField`'s own "Remove" affordance (`onFileChange(null)`) doubles as the way out
 * of a failed upload: it shows whenever Cancel isn't active, including alongside Retry once
 * `isError` — otherwise a permanently-failing upload (e.g. 415) would trap the user with no way
 * back to the plain metadata view except by retrying the same doomed file forever.
 *
 * The "no file picked yet" trigger is `ContentUploadField`'s own `variant="compact"` view (a
 * small icon button, not its full drag-and-drop box) — this component does not hand-roll its
 * own file `<input>`; there is exactly one file-picking implementation in the package.
 *
 * The Download button only shows in the idle view — once a replacement file is picked,
 * `ContentUploadField` takes over that space and there's no "current" server file left to
 * distinguish from it.
 */
function ReplaceableContentValue({
  metadata,
  icon,
  entityItem,
  attributeName,
}: Readonly<{
  metadata: ContentAttributeRendererProps["metadata"];
  icon: ContentAttributeRendererProps["icon"];
  entityItem: EntityItem;
  attributeName: string;
}>) {
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const { mutate, progress, isError, error, cancel, reset } = useUploadContent(
    entityItem,
    attributeName,
    {
      mutationOptions: { onSuccess: () => setPendingFile(null) },
    },
  );

  const handleFileSelect = useCallback(
    (file: File | null) => {
      setPendingFile(file);
      if (file) {
        mutate({ file });
      } else {
        // Dismissing (Remove, or an errored attempt) rather than picking a new file — clear the
        // mutation back to idle so a later pick doesn't inherit this attempt's error state.
        reset();
      }
    },
    [mutate, reset],
  );

  const handleCancel = useCallback(() => {
    cancel();
    setPendingFile(null);
  }, [cancel]);

  const handleRetry = useCallback(() => {
    if (pendingFile) mutate({ file: pendingFile });
  }, [mutate, pendingFile]);

  if (pendingFile) {
    return (
      <div className="flex flex-col gap-2">
        <ContentUploadField
          file={pendingFile}
          onFileChange={handleFileSelect}
          uploadProgress={progress}
          uploadError={isError}
          onCancelUpload={isError ? undefined : handleCancel}
          onRetryUpload={isError ? handleRetry : undefined}
        />
        {/* No onRetryClick: content upload never sends If-Match, so the unsatisfiedVersion (412)
            kind that callback is for can never occur here — retry is already offered above via
            ContentUploadField's own Retry button. */}
        {error && <ProblemAlert model={toProblemDisplayModel(error)} />}
      </div>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <MetadataValue metadata={metadata} icon={icon} />
      {metadata && (
        <DownloadContentButton
          entityItem={entityItem}
          attributeName={attributeName}
          filename={metadata.filename}
        />
      )}
      <ContentUploadField
        variant="compact"
        triggerLabel="Replace file"
        triggerIcon={<PencilSimpleIcon />}
        file={null}
        onFileChange={handleFileSelect}
      />
    </span>
  );
}

export function ContentAttributeRenderer({
  metadata,
  icon,
  entityItem,
  attributeName,
}: Readonly<ContentAttributeRendererProps>) {
  if (entityItem === undefined || attributeName === undefined) {
    return <MetadataValue metadata={metadata} icon={icon} />;
  }

  if (entityItem.canUploadContent(attributeName)) {
    return (
      <ReplaceableContentValue
        // Remounts (discarding any pendingFile/progress/error left over from a previous item)
        // whenever the viewed entity item changes — callers render this across item navigation
        // without giving it their own per-item key (e.g. EntityItemAttributes), so an in-flight
        // or abandoned replace attempt for one item must never carry over to another.
        key={entityItem.id}
        metadata={metadata}
        icon={icon}
        entityItem={entityItem}
        attributeName={attributeName}
      />
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <MetadataValue metadata={metadata} icon={icon} />
      {metadata && (
        <DownloadContentButton
          entityItem={entityItem}
          attributeName={attributeName}
          filename={metadata.filename}
        />
      )}
    </span>
  );
}
