import { useState } from "react";
import { ArrowRightIcon, FilePlusIcon } from "@phosphor-icons/react";
import { type ProfileEntity, useLoadedProfileEntities } from "@contentgrid/navigator-data";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  FileUploadZone,
  IconBadge,
  PageTitle,
} from "@contentgrid/ui";
import { LoadingPage } from "../app-info-pages";
import { CreateEntityItemProfileSelectorList } from "./create-entity-item-profile-selector";
import { useCreateEntityItemState } from "./state/create-entity-item-state";

export interface ClassifyCreateEntityItemPanelProps {
  /** Called on "Continue" with the chosen entity; the caller opens its create form. */
  readonly onSelect: (profile: ProfileEntity) => void;
  readonly onCancel: () => void;
}

/**
 * The general "Create Item" page: choose the entity to create and optionally attach a file,
 * which the chosen entity's create form picks up from `useCreateEntityItemState`.
 */
export function ClassifyCreateEntityItemPanel({
  onSelect,
  onCancel,
}: Readonly<ClassifyCreateEntityItemPanelProps>) {
  const { profiles: loadedProfiles, isLoading } = useLoadedProfileEntities();
  const profiles = loadedProfiles.filter((profile) => profile.createTemplate !== null);
  const initialFile = useCreateEntityItemState((state) => state.initialFile);
  const setInitialFile = useCreateEntityItemState((state) => state.setInitialFile);
  const [selectedProfile, setSelectedProfile] = useState<ProfileEntity>();

  if (isLoading) return <LoadingPage />;

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <PageTitle
            title={"New Item"}
            icon={<IconBadge icon={<FilePlusIcon />} />}
            header="Create Entity Item"
            subtitle="Select the entity you want to create."
            boldTitle={false}
          />
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">There is nothing you can create.</p>
          ) : (
            <>
              <CreateEntityItemProfileSelectorList
                profiles={profiles}
                selectedProfile={selectedProfile}
                onSelect={setSelectedProfile}
                label="Entity"
              />

              <fieldset>
                <legend className="mb-2 text-sm leading-none font-medium">
                  Upload a file (optional)
                </legend>
                <FileUploadZone file={initialFile} onFileChange={setInitialFile} />
              </fieldset>
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
