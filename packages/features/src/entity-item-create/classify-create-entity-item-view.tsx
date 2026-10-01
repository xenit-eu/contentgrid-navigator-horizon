import { useId, useState } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { type ProfileEntity, useCreatableProfileEntities } from "@contentgrid/navigator-data";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  FileUploadZone,
  Label,
  ProfileEntitySelectorList,
} from "@contentgrid/ui";
import { LoadingPage } from "../app-info-pages";
import { useCreateEntityItemState } from "./state/create-entity-item-state";
import { toProfileEntityOption } from "./to-profile-entity-option";

export interface ClassifyCreateEntityItemViewProps {
  /** Called on "Continue" with the chosen entity; the caller opens its create form. */
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
  const { profiles, isLoading } = useCreatableProfileEntities();
  const initialFile = useCreateEntityItemState((state) => state.initialFile);
  const setInitialFile = useCreateEntityItemState((state) => state.setInitialFile);
  const [selectedProfile, setSelectedProfile] = useState<ProfileEntity>();
  const fileLabelId = useId();

  if (isLoading) return <LoadingPage />;

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-xl">
            <h1>Create Item</h1>
          </CardTitle>
          <CardDescription>Select the entity you want to create.</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">There is nothing you can create.</p>
          ) : (
            <>
              <ProfileEntitySelectorList
                entities={profiles.map((profile) => toProfileEntityOption(profile))}
                selectedEntity={selectedProfile && toProfileEntityOption(selectedProfile)}
                onSelect={(option) =>
                  setSelectedProfile(profiles.find(({ name }) => name === option.name))
                }
                label="Entity"
              />

              <div role="group" aria-labelledby={fileLabelId} className="flex flex-col gap-2">
                <Label id={fileLabelId}>Upload a file (optional)</Label>
                <FileUploadZone file={initialFile} onFileChange={setInitialFile} />
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="justify-between gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            disabled={!selectedProfile}
            onClick={() => selectedProfile && onSelect(selectedProfile)}
          >
            Continue
            <ArrowRightIcon aria-hidden />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
