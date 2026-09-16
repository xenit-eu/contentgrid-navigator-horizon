import { useState } from "react";
import {
  type EntityItem,
  type EntityItemAttributeContent,
  toProblemDisplayModel,
  useUploadContent,
} from "@contentgrid/navigator-data";
import { Button, ContentUploadField } from "@contentgrid/ui";
import { ProblemAlert } from "../../problem-details";
import { ContentAttributeRenderer } from "./renderers/content-attribute-renderer";

export interface ContentAttributeCellProps {
  readonly item: EntityItem;
  readonly value: EntityItemAttributeContent;
}

/**
 * Interactive content-attribute cell for the main attribute table
 * (`entity-item-attributes.tsx`) — swaps the read-only `ContentAttributeRenderer`
 * (still used everywhere else this attribute kind appears: relation previews,
 * the audit-adjacent `AttributeValueRenderer` dispatch) for one that can also
 * replace the file, whenever upload is permitted.
 *
 * Matches legacy Navigator's own split (`MetadataContentRow` vs. `FileUpload`'s
 * `FileCard`/dropzone toggle): compact filename/size text by default, same as every
 * other attribute row — the upload dropzone only appears once the user clicks
 * "Replace", and collapses back to the compact display on success or cancel. Never
 * shows the (large) dropzone permanently — that's disproportionate to a single row in
 * an otherwise plain label/value table.
 *
 * `item.canUploadContent` mirrors the `cg:content` link presence that also drives
 * this attribute being classified as `AttributeKind.CONTENT` in the first place, so
 * this gate is always true in practice today — kept anyway per the HAL-FORMS
 * affordance rule (gate on link/template presence, never assume permission).
 */
export function ContentAttributeCell({ item, value }: Readonly<ContentAttributeCellProps>) {
  const attributeName = value.name;
  const [isReplacing, setIsReplacing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  // Tracked separately from the mutation's own `error`: TanStack resets that to
  // null the instant a retry's mutate() call starts (before it has even
  // settled), which would otherwise unmount the error box mid-retry and shift
  // everything below it. Keeping our own copy lets the box stay mounted (just
  // dimmed) until the retry actually succeeds or fails again.
  const [lastError, setLastError] = useState<Error | null>(null);
  const { mutate, progress, cancel, isPending } = useUploadContent(item, attributeName, {
    mutationOptions: {
      onSuccess: () => {
        setFile(null);
        setLastError(null);
        setIsReplacing(false);
      },
      onError: (uploadError) => setLastError(uploadError),
    },
  });

  if (!item.canUploadContent(attributeName)) {
    return <ContentAttributeRenderer metadata={value.metadata} />;
  }

  if (!isReplacing) {
    return (
      <div className="flex items-center gap-2">
        <ContentAttributeRenderer metadata={value.metadata} />
        <Button variant="ghost" size="sm" onClick={() => setIsReplacing(true)} type="button">
          Replace
        </Button>
      </div>
    );
  }

  const hasError = !isPending && lastError !== null;

  function backOut() {
    setFile(null);
    setLastError(null);
    setIsReplacing(false);
  }

  return (
    <div className="space-y-2">
      <ContentUploadField
        file={file}
        onFileChange={(next) => {
          setFile(next);
          setLastError(null);
          if (next) {
            mutate({ file: next });
          } else {
            setIsReplacing(false);
          }
        }}
        uploadProgress={isPending ? progress : undefined}
        uploadError={hasError}
        onCancelUpload={isPending ? cancel : undefined}
        onRetryUpload={
          hasError
            ? () => {
                if (file) mutate({ file });
              }
            : undefined
        }
      />
      {lastError !== null && (
        <div className={isPending ? "opacity-50 transition-opacity" : undefined}>
          <ProblemAlert model={toProblemDisplayModel(lastError)} />
        </div>
      )}
      {/* Only rendered when ContentUploadField has no equivalent control of its own: before a
          file is picked (no remove/cancel/retry button exists yet) and after a failed upload
          (it shows Retry only, never Remove) — never alongside its own Remove button, which
          already backs out the same way once a file is picked and nothing has gone wrong. */}
      {!isPending && (file === null || hasError) && (
        <Button variant="ghost" size="sm" onClick={backOut} type="button">
          Cancel
        </Button>
      )}
    </div>
  );
}
