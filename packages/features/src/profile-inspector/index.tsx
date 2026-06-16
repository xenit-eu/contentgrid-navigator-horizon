import { type ReactNode, useState } from "react";
import { type ProfileEntity, useProfileEntities } from "@contentgrid/navigator-data";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@contentgrid/ui";

export function ProfileInspector() {
  const profiles = useProfileEntities();

  if (profiles.isPending) {
    return <ProfileInspectorMessage>Loading profiles…</ProfileInspectorMessage>;
  }
  if (profiles.isError) {
    return (
      <ProfileInspectorMessage>
        Failed to load profiles: {profiles.error.message}
      </ProfileInspectorMessage>
    );
  }
  if (profiles.data.length === 0) {
    return <ProfileInspectorMessage>No profiles found.</ProfileInspectorMessage>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Profile Inspector</CardTitle>
          <CardDescription>Detailed view of all entity profiles and their schemas</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {profiles.data.length} profile(s) discovered
          </p>
        </CardContent>
      </Card>

      {profiles.data.map((profile) => (
        <ProfileCard key={profile.name} profile={profile} />
      ))}
    </div>
  );
}

function ProfileInspectorMessage({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Inspector</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">{children}</p>
      </CardContent>
    </Card>
  );
}

function ProfileCard({ profile }: Readonly<{ profile: ProfileEntity }>) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const toggleSection = (section: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{profile.title}</CardTitle>
        <CardDescription>Entity: {profile.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Information */}
        <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
          <InfoRow label="Name (singular)" value={profile.name} />
          <InfoRow label="Singular Name" value={profile.singularName} />
          <InfoRow label="Plural Name" value={profile.pluralName} />
          <InfoRow label="Description" value={profile.description} />
          <InfoRow label="Profile Link" value={profile.link.href} mono />
          <InfoRow label="Collection Link" value={profile.collectionLink.href} mono />
          <InfoRow label="Item Link Template" value={profile.itemLink.href} mono />
        </div>

        {/* Detailed Sections */}
        <div className="space-y-2">
          {/* Attributes */}
          <Collapsible
            open={openSections.has("attributes")}
            onOpenChange={() => toggleSection("attributes")}
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-accent">
              <div className="flex items-center gap-2">
                <span className="font-medium">Attributes</span>
                <Badge variant="secondary">{profile.attributes.length}</Badge>
              </div>
              <span className="text-xs">{openSections.has("attributes") ? "−" : "+"}</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2 p-2">
              {profile.attributes.map((attr) => (
                <div key={attr.name} className="rounded border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{attr.name}</span>
                    <Badge variant="outline">{attr.type}</Badge>
                    {attr.isRequired && <Badge variant="destructive">required</Badge>}
                    {attr.isReadOnly && <Badge>read-only</Badge>}
                    {attr.isUnique && <Badge variant="secondary">unique</Badge>}
                  </div>
                  <div className="text-muted-foreground space-y-1 text-xs">
                    <p>Title: {attr.title}</p>
                    {attr.description && <p>Description: {attr.description}</p>}
                    {attr.isCreatedBy && <p className="text-amber-600">Audit: Created By</p>}
                    {attr.isCreatedDate && <p className="text-amber-600">Audit: Created Date</p>}
                    {attr.isModifiedBy && <p className="text-amber-600">Audit: Modified By</p>}
                    {attr.isModifiedDate && <p className="text-amber-600">Audit: Modified Date</p>}
                    {attr.hasExactSearch && (
                      <p className="text-blue-600">
                        Searchable: exact-match
                        {attr.hasPrefixSearch && ", prefix-match"}
                      </p>
                    )}
                    {attr.allowedValues && (
                      <p>Allowed values: {attr.allowedValues.map((v) => `"${v}"`).join(", ")}</p>
                    )}
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          {/* User-Defined Attributes */}
          <Collapsible
            open={openSections.has("user-attributes")}
            onOpenChange={() => toggleSection("user-attributes")}
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-accent">
              <div className="flex items-center gap-2">
                <span className="font-medium">User-Defined Attributes</span>
                <Badge variant="secondary">{profile.userDefinedAttributes.length}</Badge>
              </div>
              <span className="text-xs">{openSections.has("user-attributes") ? "−" : "+"}</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1 p-2">
              {profile.userDefinedAttributes.map((attr) => (
                <div key={attr.name} className="flex items-center gap-2 text-sm">
                  <span className="font-mono">{attr.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {attr.type}
                  </Badge>
                  <span className="text-muted-foreground text-xs">{attr.title}</span>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          {/* Relations */}
          <Collapsible
            open={openSections.has("relations")}
            onOpenChange={() => toggleSection("relations")}
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-accent">
              <div className="flex items-center gap-2">
                <span className="font-medium">Relations</span>
                <Badge variant="secondary">{profile.relations.length}</Badge>
              </div>
              <span className="text-xs">{openSections.has("relations") ? "−" : "+"}</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2 p-2">
              {profile.relations.map((rel) => (
                <div key={rel.name} className="rounded border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{rel.name}</span>
                    <Badge variant={rel.isToOne ? "default" : "secondary"}>
                      {rel.isToOne ? "to-one" : "to-many"}
                    </Badge>
                    {rel.isRequired && <Badge variant="destructive">required</Badge>}
                  </div>
                  <div className="text-muted-foreground space-y-1 text-xs">
                    <p>Title: {rel.title}</p>
                    {rel.description && <p>Description: {rel.description}</p>}
                    <p>
                      Cardinality:{" "}
                      {rel.isManyToMany
                        ? "many-to-many"
                        : rel.isManyToOne
                          ? "many-to-one"
                          : rel.isOneToMany
                            ? "one-to-many"
                            : "one-to-one"}
                    </p>
                    {rel.targetProfileLink && (
                      <p className="font-mono">Target: {rel.targetProfileLink.href}</p>
                    )}
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          {/* Audit Attributes */}
          <Collapsible open={openSections.has("audit")} onOpenChange={() => toggleSection("audit")}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-accent">
              <div className="flex items-center gap-2">
                <span className="font-medium">Audit Attributes</span>
                <Badge variant="secondary">{profile.auditAttributes.length}</Badge>
              </div>
              <span className="text-xs">{openSections.has("audit") ? "−" : "+"}</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2 p-2">
              {profile.createdByAttribute && (
                <InfoRow label="Created By" value={profile.createdByAttribute.name} mono />
              )}
              {profile.createdAtAttribute && (
                <InfoRow label="Created At" value={profile.createdAtAttribute.name} mono />
              )}
              {profile.modifiedByAttribute && (
                <InfoRow label="Modified By" value={profile.modifiedByAttribute.name} mono />
              )}
              {profile.modifiedAtAttribute && (
                <InfoRow label="Modified At" value={profile.modifiedAtAttribute.name} mono />
              )}
              {profile.auditAttributes.length === 0 && (
                <p className="text-muted-foreground text-sm">No audit attributes configured</p>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Search Template */}
          <Collapsible
            open={openSections.has("search-template")}
            onOpenChange={() => toggleSection("search-template")}
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-accent">
              <div className="flex items-center gap-2">
                <span className="font-medium">Search Template</span>
                {profile.searchTemplate && (
                  <Badge variant="secondary">
                    {profile.searchTemplate.searchProperties.length} properties
                  </Badge>
                )}
              </div>
              <span className="text-xs">{openSections.has("search-template") ? "−" : "+"}</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-3 p-2">
              {profile.searchTemplate ? (
                <>
                  <div className="text-muted-foreground rounded border p-3 text-xs">
                    <p>Method: {profile.searchTemplate.template.request.method}</p>
                    <p className="font-mono">
                      Target: {profile.searchTemplate.template.request.url}
                    </p>
                  </div>

                  {profile.searchTemplate.searchProperties.length > 0 && (
                    <div>
                      <h5 className="mb-2 text-xs font-semibold">Search Properties</h5>
                      <div className="space-y-2">
                        {profile.searchTemplate.searchProperties.map((prop) => (
                          <div key={prop.property.name} className="rounded border bg-muted p-2">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="font-mono text-xs font-medium">
                                {prop.property.name}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                {prop.searchType}
                              </Badge>
                              {prop.isOverRelation && (
                                <Badge variant="secondary" className="text-[10px]">
                                  relation
                                </Badge>
                              )}
                            </div>
                            <div className="text-muted-foreground space-y-0.5 text-[10px]">
                              <p>Prompt: {prop.property.prompt}</p>
                              {prop.profileAttribute && (
                                <>
                                  <p>Attribute: {prop.profileAttribute.title}</p>
                                  <p>Type: {prop.profileAttribute.type}</p>
                                  {prop.profileAttribute.description && (
                                    <p>Description: {prop.profileAttribute.description}</p>
                                  )}
                                </>
                              )}
                              {prop.profileRelation && (
                                <>
                                  <p>Relation: {prop.profileRelation.title}</p>
                                  <p>
                                    Cardinality:{" "}
                                    {prop.profileRelation.isManyToMany
                                      ? "many-to-many"
                                      : prop.profileRelation.isManyToOne
                                        ? "many-to-one"
                                        : prop.profileRelation.isOneToMany
                                          ? "one-to-many"
                                          : "one-to-one"}
                                  </p>
                                  {prop.profileRelation.description && (
                                    <p>Description: {prop.profileRelation.description}</p>
                                  )}
                                  {prop.profileRelation.targetProfileLink && (
                                    <p className="font-mono">
                                      Target Profile: {prop.profileRelation.targetProfileLink.href}
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {profile.searchTemplate.sortOptions &&
                    profile.searchTemplate.sortOptions.length > 0 && (
                      <div>
                        <h5 className="mb-2 text-xs font-semibold">Sort Options</h5>
                        <div className="space-y-1">
                          {profile.searchTemplate.sortOptions.map((opt) => (
                            <div
                              key={opt.value}
                              className="text-muted-foreground flex items-center gap-2 text-xs"
                            >
                              <span className="font-mono">{opt.value}</span>
                              <Badge variant="outline" className="text-[10px]">
                                {opt.direction}
                              </Badge>
                              {opt.profileAttribute && (
                                <span className="text-[10px]">{opt.profileAttribute.title}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </>
              ) : (
                <p className="text-muted-foreground text-sm">No search template available</p>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Create Template */}
          <Collapsible
            open={openSections.has("create-template")}
            onOpenChange={() => toggleSection("create-template")}
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-accent">
              <div className="flex items-center gap-2">
                <span className="font-medium">Create Template</span>
                {profile.createTemplate && (
                  <Badge variant="secondary">
                    {profile.createTemplate.allProperties.length} properties
                  </Badge>
                )}
              </div>
              <span className="text-xs">{openSections.has("create-template") ? "−" : "+"}</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-3 p-2">
              {profile.createTemplate ? (
                <>
                  <div className="text-muted-foreground rounded border p-3 text-xs">
                    <p>Method: {profile.createTemplate.template.request.method}</p>
                    <p className="font-mono">
                      Target: {profile.createTemplate.template.request.url}
                    </p>
                  </div>

                  {profile.createTemplate.userDefinedProperties.length > 0 && (
                    <div>
                      <h5 className="mb-2 text-xs font-semibold">
                        User-Defined Attributes (
                        {profile.createTemplate.userDefinedProperties.length})
                      </h5>
                      <div className="space-y-2">
                        {profile.createTemplate.userDefinedProperties.map((prop) => (
                          <div key={prop.property.name} className="rounded border bg-muted p-2">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="font-mono text-xs font-medium">
                                {prop.property.name}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                {prop.property.type}
                              </Badge>
                              {prop.isRequired && (
                                <Badge variant="destructive" className="text-[10px]">
                                  required
                                </Badge>
                              )}
                              {prop.isContent && <Badge className="text-[10px]">file</Badge>}
                            </div>
                            <div className="text-muted-foreground space-y-0.5 text-[10px]">
                              <p>Prompt: {prop.property.prompt}</p>
                              {prop.profileAttribute && (
                                <>
                                  <p>Attribute: {prop.profileAttribute.title}</p>
                                  <p>Type: {prop.profileAttribute.type}</p>
                                  {prop.profileAttribute.description && (
                                    <p>Description: {prop.profileAttribute.description}</p>
                                  )}
                                </>
                              )}
                              {prop.allowedValues && (
                                <p>Allowed: {prop.allowedValues.map((v) => `"${v}"`).join(", ")}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {profile.createTemplate.toOneRelationProperties.length > 0 && (
                    <div>
                      <h5 className="mb-2 text-xs font-semibold">
                        To-One Relations ({profile.createTemplate.toOneRelationProperties.length})
                      </h5>
                      <div className="space-y-2">
                        {profile.createTemplate.toOneRelationProperties.map((prop) => (
                          <div key={prop.property.name} className="rounded border bg-muted p-2">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="font-mono text-xs font-medium">
                                {prop.property.name}
                              </span>
                              <Badge variant="default" className="text-[10px]">
                                to-one
                              </Badge>
                              {prop.isRequired && (
                                <Badge variant="destructive" className="text-[10px]">
                                  required
                                </Badge>
                              )}
                            </div>
                            <div className="text-muted-foreground space-y-0.5 text-[10px]">
                              <p>Prompt: {prop.property.prompt}</p>
                              {prop.profileRelation && (
                                <>
                                  <p>Relation: {prop.profileRelation.title}</p>
                                  <p>
                                    Cardinality:{" "}
                                    {prop.profileRelation.isManyToMany
                                      ? "many-to-many"
                                      : prop.profileRelation.isManyToOne
                                        ? "many-to-one"
                                        : prop.profileRelation.isOneToMany
                                          ? "one-to-many"
                                          : "one-to-one"}
                                  </p>
                                  {prop.profileRelation.description && (
                                    <p>Description: {prop.profileRelation.description}</p>
                                  )}
                                </>
                              )}
                              {prop.targetProfile && (
                                <>
                                  <p>Target Entity: {prop.targetProfile.title}</p>
                                  <p className="font-mono">
                                    Target Profile: {prop.targetProfile.link.href}
                                  </p>
                                </>
                              )}
                              <p className="font-mono">Collection: {prop.targetCollectionHref}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {profile.createTemplate.toManyRelationProperties.length > 0 && (
                    <div>
                      <h5 className="mb-2 text-xs font-semibold">
                        To-Many Relations ({profile.createTemplate.toManyRelationProperties.length})
                      </h5>
                      <div className="space-y-2">
                        {profile.createTemplate.toManyRelationProperties.map((prop) => (
                          <div key={prop.property.name} className="rounded border bg-muted p-2">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="font-mono text-xs font-medium">
                                {prop.property.name}
                              </span>
                              <Badge variant="secondary" className="text-[10px]">
                                to-many
                              </Badge>
                            </div>
                            <div className="text-muted-foreground space-y-0.5 text-[10px]">
                              <p>Prompt: {prop.property.prompt}</p>
                              {prop.profileRelation && (
                                <>
                                  <p>Relation: {prop.profileRelation.title}</p>
                                  <p>
                                    Cardinality:{" "}
                                    {prop.profileRelation.isManyToMany
                                      ? "many-to-many"
                                      : prop.profileRelation.isManyToOne
                                        ? "many-to-one"
                                        : prop.profileRelation.isOneToMany
                                          ? "one-to-many"
                                          : "one-to-one"}
                                  </p>
                                  {prop.profileRelation.description && (
                                    <p>Description: {prop.profileRelation.description}</p>
                                  )}
                                </>
                              )}
                              {prop.targetProfile && (
                                <>
                                  <p>Target Entity: {prop.targetProfile.title}</p>
                                  <p className="font-mono">
                                    Target Profile: {prop.targetProfile.link.href}
                                  </p>
                                </>
                              )}
                              <p className="font-mono">Collection: {prop.targetCollectionHref}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-sm">No create template available</p>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Raw Link Object */}
          <Collapsible
            open={openSections.has("raw-link")}
            onOpenChange={() => toggleSection("raw-link")}
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-accent">
              <span className="font-medium">Raw Link Object</span>
              <span className="text-xs">{openSections.has("raw-link") ? "−" : "+"}</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 p-2">
              <pre className="text-muted-foreground overflow-x-auto rounded border bg-muted p-4 text-xs">
                {JSON.stringify(profile.link, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: Readonly<{ label: string; value: string; mono?: boolean }>) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
      <dd className={`text-sm ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
