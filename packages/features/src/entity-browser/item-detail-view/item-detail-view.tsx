import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  ChevronRightIcon,
  FileIcon,
  PencilIcon,
  TrashIcon,
} from "lucide-react";
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
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  RelationSection,
  Separator,
  Skeleton,
} from "@contentgrid/ui";

// ---------------------------------------------------------------------------
// Shared attribute filter (mirrors pickDisplayAttributes in collection-list-view
// but INCLUDES content attrs in the detail view — we just skip system fields)
// ---------------------------------------------------------------------------

const SYSTEM_FIELDS = new Set([
  "id",
  "created_at",
  "created_by",
  "created_date",
  "modified_at",
  "modified_by",
  "modified_date",
  "updated_at",
  "updated_by",
]);

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
// Value formatter (use convertToString from navigator-data where possible)
// ---------------------------------------------------------------------------

function formatValue(value: unknown, type: string): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground italic">—</span>;
  }

  if (type === "boolean") {
    const boolVal = Boolean(value);
    return (
      <Badge
        variant="outline"
        className={
          boolVal
            ? "border-transparent bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : "border-transparent bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        }
      >
        {boolVal ? "Yes" : "No"}
      </Badge>
    );
  }

  if (type === "date" || type === "datetime") {
    const str = typeof value === "string" ? value : String(value);
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        if (type === "date") {
          return d.toLocaleDateString(undefined, {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
        }
        return d.toLocaleString(undefined, {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    } catch {
      // fall through
    }
    return str;
  }

  if (typeof value === "object") {
    try {
      return <span className="font-mono text-[12px]">{JSON.stringify(value)}</span>;
    } catch {
      return "";
    }
  }

  return String(value);
}

// ---------------------------------------------------------------------------
// RelationCard — wraps RelationSection for a single relation
// ---------------------------------------------------------------------------

interface RelationCardProps {
  entityName: string;
  entityId: string;
  relation: EntityRelation;
  onNavigate: (collection: string, id: string) => void;
}

function RelationCard({ entityName, entityId, relation, onNavigate }: Readonly<RelationCardProps>) {
  const result = useEntityRelations(entityName, entityId, relation.name);

  const items =
    result.data?.map((ri) => ({
      id: ri.id,
      data: ri.data,
    })) ?? undefined;

  // Derive a target collection name from the targetEntityHref if available
  const targetCollection = relation.targetEntityHref
    ? (relation.targetEntityHref.split("/").pop() ?? relation.name)
    : relation.name;

  return (
    <RelationSection
      title={relation.title}
      isManyToOne={relation.manyToOne && !relation.manyToMany}
      items={items}
      isLoading={result.isPending}
      error={result.isError ? result.error : undefined}
      onViewItem={(id) => onNavigate(targetCollection, id)}
      // TODO(HZN-5A): onLink + onUnlink wired when entity-picker form is implemented
    />
  );
}

// ---------------------------------------------------------------------------
// AttributeRow
// ---------------------------------------------------------------------------

function AttributeRow({
  label,
  value,
  type,
}: Readonly<{ label: string; value: unknown; type: string }>) {
  return (
    <div className="flex min-h-[32px] items-start gap-3 py-1.5 text-[13px]">
      <dt className="w-[140px] shrink-0 pt-0.5 font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 text-foreground">{formatValue(value, type)}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AttributeList
// ---------------------------------------------------------------------------

function AttributeList({
  attributes,
  data,
}: Readonly<{ attributes: EntityAttribute[]; data: Record<string, unknown> }>) {
  const displayAttrs = pickDetailAttributes(attributes);

  if (displayAttrs.length === 0) {
    return <p className="text-[13px] text-muted-foreground italic">No displayable attributes.</p>;
  }

  return (
    <dl className="divide-y divide-border/50">
      {displayAttrs.map((attr) => (
        <AttributeRow key={attr.name} label={attr.title} value={data[attr.name]} type={attr.type} />
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
            <div className="rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-[12px] text-muted-foreground">
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
  actions?: React.ReactNode;
}

function BreadcrumbToolbar({
  entityTitle,
  displayName,
  onBack,
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
        <span>Home</span>
        <ChevronRightIcon className="size-2.5" />
        <span>{entityTitle}</span>
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

function DetailErrorState({ error }: Readonly<{ error: unknown }>) {
  let title = "Failed to load item";
  let message = "An unexpected error occurred while loading this item.";

  if (error instanceof ProblemDetailError) {
    const status = error.problemDetail.status;
    if (status === 403) {
      title = "Access denied";
      message = "You don't have permission to view this item.";
    } else if (status === 404) {
      title = "Not found";
      message = "This item doesn't exist or is not accessible.";
    } else {
      title = error.problemDetail.title ?? title;
      message = error.problemDetail.detail ?? message;
    }
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10">
      <div className="max-w-[400px] rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <AlertCircleIcon className="mx-auto mb-3 size-8 text-destructive" />
        <div className="mb-1 text-[15px] font-semibold text-destructive">{title}</div>
        <div className="text-[13px] leading-relaxed text-foreground/70">{message}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content-focus variant (PAGE 03)
// Invoice-style: 1fr + 360px right panel
// ---------------------------------------------------------------------------

interface ContentFocusProps {
  collection: string;
  id: string;
  entityTitle: string;
  displayName: string;
  selfHref: string;
  attributes: EntityAttribute[];
  relations: EntityRelation[];
  data: Record<string, unknown>;
  onBack: () => void;
  onNavigate: (col: string, itemId: string) => void;
  onEditClick: () => void;
  onDeleteClick: () => void;
  /** RBAC hide-point: hide Edit button when false. Defaults to true (permissive). */
  canEdit: boolean;
  /** RBAC hide-point: hide Delete button when false. Defaults to true (permissive). */
  canDelete: boolean;
}

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
  onNavigate,
  onEditClick,
  onDeleteClick,
  canEdit,
  canDelete,
}: Readonly<ContentFocusProps>) {
  // Derive content attribute name from schema
  const contentAttr = attributes.find(isContentAttr);
  const contentAttrName = contentAttr?.title ?? contentAttr?.name ?? "document";

  // Derive the path segment of the self href for display
  const selfPath = selfHref
    ? new URL(selfHref, "http://localhost").pathname
    : `/${collection}/${id}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BreadcrumbToolbar entityTitle={entityTitle} displayName={displayName} onBack={onBack} />

      {/* Content-focus grid: viewer | side panel */}
      <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: "1fr 360px" }}>
        {/* File viewer pane — placeholder (real viewer is a later ticket) */}
        <div className="flex min-h-0 flex-col border-r border-border bg-muted/30">
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
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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
          <div className="flex-1 overflow-auto px-5 py-4">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Attributes
            </div>
            <AttributeList attributes={attributes} data={data} />

            {relations.length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Relations
                </div>
                <div className="flex flex-col gap-2">
                  {relations.map((rel) => (
                    <RelationCard
                      key={rel.name}
                      entityName={collection}
                      entityId={id}
                      relation={rel}
                      onNavigate={onNavigate}
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

interface AttributeFocusProps {
  collection: string;
  id: string;
  entityTitle: string;
  displayName: string;
  selfHref: string;
  attributes: EntityAttribute[];
  relations: EntityRelation[];
  data: Record<string, unknown>;
  onBack: () => void;
  onNavigate: (col: string, itemId: string) => void;
  onEditClick: () => void;
  onDeleteClick: () => void;
  /** RBAC hide-point: hide Edit button when false. Defaults to true (permissive). */
  canEdit: boolean;
  /** RBAC hide-point: hide Delete button when false. Defaults to true (permissive). */
  canDelete: boolean;
}

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
  onNavigate,
  onEditClick,
  onDeleteClick,
  canEdit,
  canDelete,
}: Readonly<AttributeFocusProps>) {
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
        actions={toolbarActions}
      />

      {/* Two-column layout: attrs left | relations right */}
      <div
        className="min-h-0 flex-1 overflow-auto p-6"
        style={{ display: "grid", gridTemplateColumns: "minmax(0,720px) 1fr", gap: "24px" }}
      >
        {/* Left: eyebrow + h1 + meta + Attributes card */}
        <div>
          <div className="mb-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {entityTitle}
            </div>
            <h1 className="mt-1.5 text-[26px] font-bold tracking-tight text-foreground">
              {displayName}
            </h1>
            <div className="mt-1 text-[12px] text-muted-foreground">{selfPath}</div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Attributes</CardTitle>
            </CardHeader>
            <CardContent>
              <AttributeList attributes={attributes} data={data} />
            </CardContent>
          </Card>
        </div>

        {/* Right: Relations card */}
        {relations.length > 0 && (
          <div>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Relations</CardTitle>
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
            {Array.from({ length: 5 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: stable positional skeleton
              <Skeleton key={i} className="h-6 w-full" />
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
  if (isError) return <DetailErrorState error={error} />;

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
    onNavigate: goToItem,
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
