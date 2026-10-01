import type { ProfileEntity } from "@contentgrid/navigator-data";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  FileUploadZone,
  ProfileEntitySelector,
} from "@contentgrid/ui";
import { LoadingPage } from "../app-info-pages";
import { useCreateEntityItemState } from "./state/create-entity-item-state";
import { useCreatableProfileEntities } from "./use-creatable-profile-entities";

export interface ClassifyCreateEntityItemViewProps {
  /** Called as soon as an entity is chosen; the caller opens its create form. */
  readonly onSelect: (profile: ProfileEntity) => void;
  readonly onCancel: () => void;
}

/**
 * The general "Create Item" page: choose the entity to create and optionally attach a file,
 * which the chosen entity's create form picks up from `useCreateEntityItemState`.
 */
export function ClassifyCreateEntityItemView({
  onSelect,
  onCancel,
}: Readonly<ClassifyCreateEntityItemViewProps>) {
  const { options, isLoading, profileFor } = useCreatableProfileEntities();
  const initialFile = useCreateEntityItemState((state) => state.initialFile);
  const setInitialFile = useCreateEntityItemState((state) => state.setInitialFile);

  if (isLoading) return <LoadingPage />;

  return (
    <div className="flex h-full items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Create Item</CardTitle>
          <CardDescription>Select the entity you want to create.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground">There is nothing you can create.</p>
          ) : (
            <>
              <ProfileEntitySelector
                entities={options}
                label="Entity"
                onSelect={(option) => {
                  const profile = profileFor(option);
                  if (profile) onSelect(profile);
                }}
              />
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Upload a file (optional)</span>
                <FileUploadZone file={initialFile} onFileChange={setInitialFile} />
              </div>
            </>
          )}
        </CardContent>
        <CardFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
