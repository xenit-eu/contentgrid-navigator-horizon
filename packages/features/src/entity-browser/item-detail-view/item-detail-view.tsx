import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { ArrowLeftIcon, ChevronRightIcon, FileIcon, PencilIcon, TrashIcon } from "lucide-react";
import {
  ProblemDetailError,
  useDeleteEntity,
  useEntityCapabilities,
  useEntityDetail,
  useEntityRelations,
  useEntitySchema,
  useProfile,
} from "@contentgrid/navigator-data";
import type { EntityAttribute, EntityRelation } from "@contentgrid/navigator-data";
import { resolveDisplayName } from "@contentgrid/navigator-data/utils/entity-display-name";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardTitleCount,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  RelationSection,
  Separator,
  Skeleton,
} from "@contentgrid/ui";
import { SYSTEM_FIELDS, formatAttributeValue } from "../attribute-format";
import { EntityErrorState } from "../error-state";

// ---------------------------------------------------------------------------
// Attribute filter helpers (detail-view specific — includes content attrs)
// ---------------------------------------------------------------------------

function isSystemField(attr: EntityAttribute): boolean {
  return attr.readOnly && SYSTEM_FIELDS.has(attr.name);
}

function isContentAttr(attr: EntityAttribute): boolean {
  return attr.type === "content";
}

function isAuditMetadata(attr: EntityAttribute): boolean {
  return attr.type === "audit_metadata";
}

function pickDetailAttributes(attributes: EntityAttribute[]): EntityAttribute[] {
  return attributes.filter((a) => !isSystemField(a) && !isAuditMetadata(a) && !isContentAttr(a));
}

// ---------------------------------------------------------------------------
// RelationCard — wraps RelationSection for a single relation
// ---------------------------------------------------------------------------

interface RelationCardProps {
  entityName: string;
  entityId: string;
  relation: EntityRelation;
  onNavigate: (collection: string, id: string) => void;
  onViewAll?: (collection: string) => void;
}

function RelationCard({
  entityName,
  entityId,
  relation,
  onNavigate,
  onViewAll,
}: Readonly<RelationCardProps>) {
  const result = useEntityRelations(entityName, entityId, relation.name);

  // Raw relation items are passed straight through: RelationSection (in
  // @contentgrid/ui) skips HAL envelope keys itself and localises
  // dates/numbers with the same rules as the main collection table.
  const items = result.data ?? undefined;

  // Derive a target collection name from the targetEntityHref if available
  const targetCollection = relation.targetEntityHref
    ? (relation.targetEntityHref.split("/").pop() ?? relation.name)
    : relation.name;

  const isManyToOne = relation.manyToOne && !relation.manyToMany;

  return (
    <RelationSection
      title={relation.title}
      isManyToOne={isManyToOne}
      items={items}
      isLoading={result.isPending}
      error={result.isError ? result.error : undefined}
      onViewItem={(id) => onNavigate(targetCollection, id)}
      // For to-many: wire "View all" to navigate to the target collection
      onViewAll={!isManyToOne && onViewAll ? () => onViewAll(targetCollection) : undefined}
      // TODO(HZN-5A): onLink + onUnlink wired when entity-picker form is implemented
    />
  );
}

// ---------------------------------------------------------------------------
// AttributeRow
// ---------------------------------------------------------------------------

/**
 * AttributeRow renders one label/value pair.
 *
 * Two layout variants mirror the mockup:
 *   - "side"  → `.attr-row` (content-focus side panel): two equal columns (1fr 1fr).
 *   - "focus" → `.af-row`   (attribute-focus card): fixed 160px label column.
 *
 * Both: label is `text-[13px]` text-dim (NOT bold, NOT mono); value is
 * `text-[13px]` midnight; empty values render a dimmed em-dash.
 */
function AttributeRow({
  label,
  value,
  type,
  variant,
}: Readonly<{ label: string; value: unknown; type: string; variant: "side" | "focus" }>) {
  return (
    <div
      className="grid items-start gap-3 border-b border-border/50 py-3 text-[13px] last:border-b-0"
      style={{ gridTemplateColumns: variant === "focus" ? "160px 1fr" : "1fr 1fr" }}
    >
      <dt className="min-w-0 text-[13px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-[13px] text-foreground">{formatAttributeValue(value, type)}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AttributeList
// ---------------------------------------------------------------------------

function AttributeList({
  attributes,
  data,
  variant,
}: Readonly<{
  attributes: EntityAttribute[];
  data: Record<string, unknown>;
  variant: "side" | "focus";
}>) {
  const displayAttrs = pickDetailAttributes(attributes);

  if (displayAttrs.length === 0) {
    return <p className="text-[13px] text-muted-foreground italic">No displayable attributes.</p>;
  }

  return (
    <dl>
      {displayAttrs.map((attr) => (
        <AttributeRow
          key={attr.name}
          label={attr.title}
          value={data[attr.name]}
          type={attr.type}
          variant={variant}
        />
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Delete dialog
// ---------------------------------------------------------------------------

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityTitle: string;
  displayName: string;
  relations: EntityRelation[];
  isDeleting: boolean;
  deleteError: unknown;
  onConfirm: () => void;
}

function DeleteDialog({
  open,
  onOpenChange,
  entityTitle,
  displayName,
  relations,
  isDeleting,
  deleteError,
  onConfirm,
}: Readonly<DeleteDialogProps>) {
  let errorMessage: string | null = null;
  if (deleteError instanceof ProblemDetailError) {
    const pd = deleteError.problemDetail;
    if (pd.status === 409) {
      // integrity/required-relation — show the server's detail
      errorMessage = pd.detail ?? pd.title ?? "This item cannot be deleted due to a constraint.";
    } else {
      errorMessage = pd.detail ?? pd.title ?? "Failed to delete item.";
    }
  } else if (deleteError instanceof Error && deleteError.message.startsWith("No ETag cached")) {
    errorMessage = "Couldn't determine the item version. Please refresh and try again.";
  } else if (deleteError instanceof Error) {
    errorMessage = deleteError.message;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <TrashIcon className="size-[18px] text-destructive" />
            <DialogTitle>Delete {entityTitle.toLowerCase()}?</DialogTitle>
          </div>
        </DialogHeader>

        <div className="text-[13px] leading-relaxed text-foreground">
          <p className="mb-3">
            You&rsquo;re about to permanently delete <strong>{displayName}</strong>. This cannot be
            undone.
          </p>

          {relations.length > 0 && (
            <div className="rounded-lg border border-border bg-[var(--cg-color-frost)] px-3 py-2.5 text-[13px] text-muted-foreground">
              <p className="mb-1 font-semibold text-foreground">
                Linked relations will be cleared:
              </p>
              {relations.map((r) => (
                <p key={r.name}>
                  · {r.title}{" "}
                  <span className="text-foreground/50">
                    ({r.manyToMany || !r.manyToOne ? "to-many" : "to-one"})
                  </span>
                </p>
              ))}
            </div>
          )}

          {errorMessage && (
            <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive">
              {errorMessage}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            <TrashIcon className="size-4" />
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Breadcrumb toolbar (shared between variants)
// ---------------------------------------------------------------------------

interface BreadcrumbToolbarProps {
  entityTitle: string;
  displayName: string;
  onBack: () => void;
  onHome: () => void;
  onCollection: () => void;
  actions?: React.ReactNode;
}

function BreadcrumbToolbar({
  entityTitle,
  displayName,
  onBack,
  onHome,
  onCollection,
  actions,
}: Readonly<BreadcrumbToolbarProps>) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 border-b border-border bg-card px-6 py-2.5">
      <button
        type="button"
        onClick={onBack}
        className="grid size-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Back to collection"
      >
        <ArrowLeftIcon className="size-3.5" />
      </button>

      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <button
          type="button"
          onClick={onHome}
          className="cursor-pointer border-0 bg-transparent text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Home
        </button>
        <ChevronRightIcon className="size-2.5" />
        <button
          type="button"
          onClick={onCollection}
          className="cursor-pointer border-0 bg-transparent text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {entityTitle}
        </button>
        <ChevronRightIcon className="size-2.5" />
        <span className="font-medium text-foreground">{displayName}</span>
      </nav>

      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

const DETAIL_ERROR_LABELS = {
  defaultTitle: "Failed to load item",
  defaultMessage: "An unexpected error occurred while loading this item.",
  forbiddenMessage: "You don't have permission to view this item.",
  notFoundTitle: "Not found",
  notFoundMessage: "This item doesn't exist or is not accessible.",
} as const;

// ---------------------------------------------------------------------------
// Shared layout props for the two detail variants
// ---------------------------------------------------------------------------

interface DetailLayoutProps {
  collection: string;
  id: string;
  entityTitle: string;
  displayName: string;
  selfHref: string;
  attributes: EntityAttribute[];
  relations: EntityRelation[];
  data: Record<string, unknown>;
  onBack: () => void;
  onHome: () => void;
  onCollection: () => void;
  onNavigate: (col: string, itemId: string) => void;
  /** Navigate to a related collection (used by "View all" in to-many relation accordions). */
  onViewAll: (col: string) => void;
  onEditClick: () => void;
  onDeleteClick: () => void;
  /** RBAC hide-point: hide Edit button when false. Defaults to true (permissive). */
  canEdit: boolean;
  /** RBAC hide-point: hide Delete button when false. Defaults to true (permissive). */
  canDelete: boolean;
}

// ---------------------------------------------------------------------------
// Content-focus variant (PAGE 03)
// Invoice-style: 1fr + 360px right panel
// ---------------------------------------------------------------------------

function ContentFocusView({
  collection,
  id,
  entityTitle,
  displayName,
  selfHref,
  attributes,
  relations,
  data,
  onBack,
  onHome,
  onCollection,
  onNavigate,
  onViewAll,
  onEditClick,
  onDeleteClick,
  canEdit,
  canDelete,
}: Readonly<DetailLayoutProps>) {
  // Derive content attribute name from schema
  const contentAttr = attributes.find(isContentAttr);
  const contentAttrName = contentAttr?.title ?? contentAttr?.name ?? "document";

  // Derive the path segment of the self href for display
  const selfPath = selfHref
    ? new URL(selfHref, "http://localhost").pathname
    : `/${collection}/${id}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BreadcrumbToolbar
        entityTitle={entityTitle}
        displayName={displayName}
        onBack={onBack}
        onHome={onHome}
        onCollection={onCollection}
      />

      {/* Content-focus grid: viewer | side panel */}
      <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: "1fr 360px" }}>
        {/* File viewer pane — placeholder (real viewer is a later ticket) */}
        <div
          className="flex min-h-0 flex-col border-r border-border"
          style={{ background: "var(--cg-gradient-viewer)" }}
        >
          <div className="flex min-h-0 flex-1 items-center justify-center p-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="grid size-20 place-items-center rounded-2xl border-[1.5px] border-dashed border-border bg-card">
                <FileIcon className="size-9 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-foreground">{contentAttrName}</p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {/* TODO(HZN content-viewer): render PDF/preview using @embedpdf stack */}
                  File preview is not yet available.
                </p>
              </div>
              {/* Disabled download affordance */}
              <Button variant="outline" size="sm" disabled className="gap-2 opacity-50">
                Download
              </Button>
            </div>
          </div>
        </div>

        {/* Metadata side panel */}
        <aside className="flex min-h-0 flex-col border-l border-border bg-card">
          {/* Side panel head */}
          <div className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0 flex-1">
              <div
                className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: "var(--cg-color-eyebrow)" }}
              >
                {entityTitle}
              </div>
              <div className="mt-1 truncate text-[15px] font-semibold text-foreground">
                {displayName}
              </div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">{selfPath}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {/* RBAC hide-point: Edit — hidden when canEdit is false (default template absent).
                  TODO(HZN-5A): wire Edit form; TODO(HZN-7.4): remove disabled once implemented */}
              {canEdit && (
                <button
                  type="button"
                  disabled
                  title="Edit — coming in HZN-5A"
                  className="grid size-7 cursor-not-allowed place-items-center rounded-md text-muted-foreground opacity-50 hover:bg-muted"
                  onClick={onEditClick}
                >
                  <PencilIcon className="size-3.5" />
                </button>
              )}
              {/* RBAC hide-point: Delete — hidden when canDelete is false (delete template absent). */}
              {canDelete && (
                <button
                  type="button"
                  title="Delete"
                  className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={onDeleteClick}
                >
                  <TrashIcon className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Side panel body: attributes + relations */}
          <div className="flex-1 overflow-auto px-5 py-3.5">
            <div className="flex items-center justify-between pb-2 text-[12px] font-semibold tracking-[0.06em] text-muted-foreground">
              <span>Attributes</span>
              <span className="font-medium text-muted-foreground/70">
                {pickDetailAttributes(attributes).length}
              </span>
            </div>
            <AttributeList attributes={attributes} data={data} variant="side" />

            {relations.length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="flex items-center justify-between pb-2 text-[12px] font-semibold tracking-[0.06em] text-muted-foreground">
                  <span>Relations</span>
                  <span className="font-medium text-muted-foreground/70">{relations.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {relations.map((rel) => (
                    <RelationCard
                      key={rel.name}
                      entityName={collection}
                      entityId={id}
                      relation={rel}
                      onNavigate={onNavigate}
                      onViewAll={onViewAll}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Attribute-focus variant (PAGE 04)
// Supplier-style: two-column (attrs left | relations right)
// ---------------------------------------------------------------------------

function AttributeFocusView({
  collection,
  id,
  entityTitle,
  displayName,
  selfHref,
  attributes,
  relations,
  data,
  onBack,
  onHome,
  onCollection,
  onNavigate,
  onViewAll,
  onEditClick,
  onDeleteClick,
  canEdit,
  canDelete,
}: Readonly<DetailLayoutProps>) {
  const selfPath = selfHref
    ? new URL(selfHref, "http://localhost").pathname
    : `/${collection}/${id}`;

  const toolbarActions =
    canEdit || canDelete ? (
      <>
        {/* RBAC hide-point: Edit — hidden when canEdit is false (default template absent).
            TODO(HZN-5A): wire Edit form; TODO(HZN-7.4): remove disabled once implemented */}
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            disabled
            className="gap-2 opacity-50"
            onClick={onEditClick}
          >
            <PencilIcon className="size-3.5" />
            Edit
          </Button>
        )}
        {/* RBAC hide-point: Delete — hidden when canDelete is false (delete template absent). */}
        {canDelete && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDeleteClick}
          >
            <TrashIcon className="size-3.5" />
            Delete
          </Button>
        )}
      </>
    ) : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BreadcrumbToolbar
        entityTitle={entityTitle}
        displayName={displayName}
        onBack={onBack}
        onHome={onHome}
        onCollection={onCollection}
        actions={toolbarActions}
      />

      {/* Two-column layout: attrs left | relations right */}
      <div
        className="min-h-0 flex-1 overflow-auto p-6"
        style={{ display: "grid", gridTemplateColumns: "minmax(0,720px) 1fr", gap: "48px" }}
      >
        {/* Left: eyebrow + h1 + meta + Attributes card */}
        <div>
          <div className="mb-5">
            <div
              className="text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: "var(--cg-color-eyebrow)" }}
            >
              {entityTitle}
            </div>
            <h1 className="mt-1.5 text-[26px] font-bold tracking-tight text-foreground">
              {displayName}
            </h1>
            <div className="mt-1 text-[12px] text-muted-foreground">{selfPath}</div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>
                Attributes
                <CardTitleCount>{pickDetailAttributes(attributes).length}</CardTitleCount>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AttributeList attributes={attributes} data={data} variant="focus" />
            </CardContent>
          </Card>
        </div>

        {/* Right: Relations card */}
        {relations.length > 0 && (
          <div>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>
                  Relations
                  <CardTitleCount>{relations.length}</CardTitleCount>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {relations.map((rel) => (
                    <RelationCard
                      key={rel.name}
                      entityName={collection}
                      entityId={id}
                      relation={rel}
                      onNavigate={onNavigate}
                      onViewAll={onViewAll}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar skeleton */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border bg-card px-6 py-2.5">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="h-3 w-48" />
      </div>
      <div className="flex min-h-0 flex-1 gap-6 p-6">
        <div className="flex-1 space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-3 w-32" />
          <div className="mt-6 space-y-3">
            {["sk-a0", "sk-a1", "sk-a2", "sk-a3", "sk-a4"].map((key) => (
              <Skeleton key={key} className="h-6 w-full" />
            ))}
          </div>
        </div>
        <div className="w-[360px] space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

export function ItemDetailView({ collection, id }: Readonly<{ collection: string; id: string }>) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<unknown>(null);

  // --- Data ---
  const profile = useProfile();
  const entityInfo = profile.data?.find(
    (e) => e.name === collection || e.href.split("/").pop() === collection,
  );
  const entityTitle = entityInfo?.title ?? collection;

  const detail = useEntityDetail(collection, id);
  const schema = useEntitySchema(collection);
  const deleteMutation = useDeleteEntity();

  // RBAC hook point — derives edit/delete caps from HAL-FORMS template presence.
  // Fallback: true while loading (permissive — shows affordances until platform actively denies).
  // HZN-7.4 will wire the full RBAC signal end-to-end.
  const capabilities = useEntityCapabilities(collection, id);

  const isPending = detail.isPending || schema.isPending;
  const isError = detail.isError || schema.isError;
  const error = detail.error ?? schema.error;

  // --- Derived values ---
  const data = detail.data?.data ?? {};
  const selfHref = detail.data?.selfHref ?? "";
  const attributes = schema.data?.attributes ?? [];
  const relations = schema.data?.relations ?? [];

  const displayName: string = schema.data ? resolveDisplayName(data, id, attributes) : id;

  // Variant: content-focus when any attribute has type "content",
  // or when the item's cg:content links are present
  const hasContentAttr = attributes.some(isContentAttr);

  // --- Navigation ---
  function goHome() {
    void router.navigate({ to: "/" as never });
  }

  function goBack() {
    void router.navigate({
      to: "/$collection" as never,
      params: { collection } as never,
      search: {} as never,
    });
  }

  function goToItem(targetCollection: string, targetId: string) {
    void router.navigate({
      to: "/$collection/$id" as never,
      params: { collection: targetCollection, id: targetId } as never,
    });
  }

  function goToCollection(targetCollection: string) {
    void router.navigate({
      to: "/$collection" as never,
      params: { collection: targetCollection } as never,
      search: {} as never,
    });
  }

  // --- Delete ---
  function handleDeleteConfirm() {
    setDeleteError(null);
    deleteMutation.mutate(
      { entityName: collection, entityId: id },
      {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          goBack();
        },
        onError: (err) => {
          setDeleteError(err);
          // Keep dialog open so user can see the error (especially 409)
        },
      },
    );
  }

  function handleDeleteClick() {
    setDeleteError(null);
    setDeleteDialogOpen(true);
  }

  // --- States ---
  if (isPending) return <DetailSkeleton />;
  if (isError) return <EntityErrorState error={error} labels={DETAIL_ERROR_LABELS} />;

  const sharedProps = {
    collection,
    id,
    entityTitle,
    displayName,
    selfHref,
    attributes,
    relations,
    data,
    onBack: goBack,
    onHome: goHome,
    onCollection: goBack,
    onNavigate: goToItem,
    onViewAll: goToCollection,
    onEditClick: () => undefined, // TODO(HZN-5A): open create/edit form
    onDeleteClick: handleDeleteClick,
    // RBAC capabilities — undefined means still loading, default to true (permissive).
    canEdit: capabilities.canEdit ?? true,
    canDelete: capabilities.canDelete ?? true,
  };

  return (
    <>
      {hasContentAttr ? (
        <ContentFocusView {...sharedProps} />
      ) : (
        <AttributeFocusView {...sharedProps} />
      )}

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) setDeleteError(null);
          setDeleteDialogOpen(open);
        }}
        entityTitle={entityTitle}
        displayName={displayName}
        relations={relations}
        isDeleting={deleteMutation.isPending}
        deleteError={deleteError}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
