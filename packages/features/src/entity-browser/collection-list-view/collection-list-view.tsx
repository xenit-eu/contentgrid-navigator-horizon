import { useRouter } from "@tanstack/react-router";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileIcon,
  FileImageIcon,
  FileTextIcon,
  FilterIcon,
  InboxIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import {
  ProblemDetailError,
  useEntityCapabilities,
  useEntityList,
  useEntitySchema,
  useProfile,
} from "@contentgrid/navigator-data";
import { resolveDisplayName } from "@contentgrid/navigator-data/utils/entity-display-name";
import {
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@contentgrid/ui";
import { formatAttributeValue, pickDisplayAttributes } from "../attribute-format";

// ---------------------------------------------------------------------------
// Content-attribute helpers (file-type icon + meta line in the primary cell)
// ---------------------------------------------------------------------------

interface ContentMeta {
  filename?: string;
  mimetype?: string;
  length?: number;
}

/** Extracts a content-object meta from an item's data for a given attribute. */
function readContentMeta(value: unknown): ContentMeta | undefined {
  if (value == null || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  return {
    filename: typeof v.filename === "string" ? v.filename : undefined,
    mimetype: typeof v.mimetype === "string" ? v.mimetype : undefined,
    length: typeof v.length === "number" ? v.length : undefined,
  };
}

type FileKind = "pdf" | "image" | "other";

/** Classifies content meta into a file-kind used for icon tile styling. */
function classifyFile(meta: ContentMeta | undefined): FileKind {
  const hint = `${meta?.mimetype ?? ""} ${meta?.filename ?? ""}`.toLowerCase();
  if (/image|\.(png|jpe?g|gif|webp|svg|bmp|tiff?)$/.test(hint)) return "image";
  if (/pdf|\.(pdf)$/.test(hint)) return "pdf";
  return "other";
}

/** Tile background/foreground classes by file kind (mockup .file-ic variants). */
const FILE_KIND_TILE_STYLE: Record<FileKind, string> = {
  pdf: "bg-[var(--cg-color-pdf-bg)] text-[var(--cg-color-pdf-fg)]",
  image: "bg-[var(--cg-color-img-bg)] text-[var(--cg-color-img-fg)]",
  other: "bg-[var(--cg-color-mist)] text-[var(--cg-color-text-dim)]",
};

/** Picks a lucide icon matching the content's mimetype / filename extension. */
function FileTypeIcon({ meta }: Readonly<{ meta: ContentMeta | undefined }>) {
  const hint = `${meta?.mimetype ?? ""} ${meta?.filename ?? ""}`.toLowerCase();
  if (/image|\.(png|jpe?g|gif|webp|svg|bmp|tiff?)$/.test(hint)) {
    return <FileImageIcon className="size-3.5" />;
  }
  if (
    /pdf|word|excel|sheet|presentation|document|text|\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp|txt|csv)$/.test(
      hint,
    )
  ) {
    return <FileTextIcon className="size-3.5" />;
  }
  return <FileIcon className="size-3.5" />;
}

/** Human-readable byte size (mockup style: "412 KB", "1.4 MB"). */
function formatBytes(bytes: number | undefined): string | undefined {
  if (bytes == null || !Number.isFinite(bytes)) return undefined;
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const rounded =
    size >= 100 || Number.isInteger(size) ? Math.round(size) : Math.round(size * 10) / 10;
  return `${rounded} ${units[unit]}`;
}

/**
 * Primary cell that mirrors the mockup `.cell-primary`: a 30px file-type icon
 * tile, the item display name, and a meta line ("document.pdf · 412 KB" or
 * "no content"). Used when the entity has a content attribute.
 */
function PrimaryFileCell({
  displayName,
  meta,
}: Readonly<{ displayName: string; meta: ContentMeta | undefined }>) {
  const size = formatBytes(meta?.length);
  const hasContent = Boolean(meta?.filename);
  const metaLine = hasContent ? [meta?.filename, size].filter(Boolean).join(" · ") : "no content";

  const kind = classifyFile(meta);
  const tileStyle = FILE_KIND_TILE_STYLE[kind];

  return (
    <div className="flex items-center gap-3">
      <div className={`grid size-[30px] shrink-0 place-items-center rounded-md ${tileStyle}`}>
        <FileTypeIcon meta={meta} />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium text-foreground">{displayName}</div>
        <div
          className={`mt-px truncate text-[12px] ${hasContent ? "text-muted-foreground" : "text-muted-foreground/70"}`}
        >
          {metaLine}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PageToolbar({
  entityTitle,
  onBack,
  onHome,
}: Readonly<{ entityTitle: string; onBack: () => void; onHome: () => void }>) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 border-b border-border bg-card px-6 py-2.5">
      <button
        type="button"
        onClick={onBack}
        className="grid size-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Back to home"
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
        <span className="font-medium text-foreground">{entityTitle}</span>
      </nav>

      {/* TODO(HZN-5C): multi-search field + filters — visual placeholder only */}
      <div
        aria-disabled="true"
        className="ml-auto flex max-w-[520px] flex-1 cursor-not-allowed items-center gap-2 rounded-lg border border-transparent bg-muted px-4 py-2 opacity-50"
        title="Search and filters are coming in HZN-5C"
      >
        <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-[13px] text-muted-foreground">Search…</span>
      </div>
      <button
        type="button"
        disabled
        className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-border bg-transparent px-3 py-2 text-[13px] font-medium text-foreground opacity-50"
        title="Filters are coming in HZN-5C"
      >
        {/* TODO(HZN-5C): filters button */}
        <FilterIcon className="size-3.5" />
        Filters
      </button>
    </div>
  );
}

function PageHead({
  entityTitle,
  totalItems,
  isPending,
}: Readonly<{ entityTitle: string; totalItems: number | undefined; isPending: boolean }>) {
  return (
    <div className="shrink-0 px-6 pt-7 pb-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cg-color-eyebrow)]">
        Entity collection
      </div>
      <h1 className="mt-1.5 mb-1 text-[26px] font-bold tracking-[-0.02em] text-foreground">
        {entityTitle}
      </h1>
      <div className="text-[13px] text-[var(--cg-color-text-dim)]">
        {isPending
          ? "Loading…"
          : totalItems !== undefined
            ? `${totalItems.toLocaleString()} items`
            : ""}
      </div>
    </div>
  );
}

const SKELETON_ROW_KEYS = ["sk-r0", "sk-r1", "sk-r2", "sk-r3", "sk-r4", "sk-r5"] as const;
const SKELETON_CELL_KEYS = ["sk-c0", "sk-c1", "sk-c2", "sk-c3", "sk-c4", "sk-c5"] as const;

function SkeletonRows({ colCount }: Readonly<{ colCount: number }>) {
  return (
    <>
      {SKELETON_ROW_KEYS.map((rowKey) => (
        <TableRow key={rowKey} className="cursor-default">
          <TableCell>
            <div className="flex items-center gap-3">
              <Skeleton className="size-[30px] shrink-0 rounded-md bg-[var(--cg-color-skeleton)]" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-[13px] w-36 bg-[var(--cg-color-skeleton)]" />
                <Skeleton className="h-[11px] w-24 bg-[var(--cg-color-skeleton)]" />
              </div>
            </div>
          </TableCell>
          {SKELETON_CELL_KEYS.slice(0, Math.max(0, colCount - 1)).map((cellKey) => (
            <TableCell key={cellKey}>
              <Skeleton className="h-[13px] w-20 bg-[var(--cg-color-skeleton)]" />
            </TableCell>
          ))}
          <TableCell />
        </TableRow>
      ))}
    </>
  );
}

function EmptyState({
  entityTitle,
  canCreate,
}: Readonly<{ entityTitle: string; canCreate: boolean }>) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10">
      <div className="max-w-[360px] text-center">
        <div
          className="mx-auto mb-5 grid size-[72px] place-items-center rounded-2xl border-[1.5px] border-dashed"
          style={{
            background: "linear-gradient(135deg,#E0F4FF,var(--cg-color-mist))",
            borderColor: "#8FD0F0",
          }}
        >
          <InboxIcon className="size-8" style={{ color: "#0283BD" }} />
        </div>
        <div className="mb-2 text-[20px] font-bold tracking-[-0.01em] text-foreground">
          No {entityTitle.toLowerCase()} yet
        </div>
        <div className="mb-6 text-[13px] leading-[1.6] text-[var(--cg-color-text-dim)]">
          {canCreate
            ? `Create your first ${entityTitle.toLowerCase()} to get started. It will appear here once added.`
            : `No ${entityTitle.toLowerCase()} items have been created yet.`}
        </div>
        {/* RBAC hide-point: only show Create when the profile exposes create-form.
            TODO(HZN-5A): wire to create form when entity creation is implemented */}
        {canCreate && (
          <Button disabled className="gap-2 opacity-50" title="Create is coming in HZN-5A">
            <PlusIcon className="size-4" />
            Create {entityTitle}
          </Button>
        )}
      </div>
    </div>
  );
}

function ErrorState({ error }: Readonly<{ error: unknown }>) {
  let message = "An unexpected error occurred while loading this collection.";
  let title = "Failed to load collection";

  if (error instanceof ProblemDetailError) {
    const status = error.problemDetail.status;
    if (status === 403) {
      title = "Access denied";
      message = "You don't have access to this collection.";
    } else if (status === 404) {
      title = "Collection not found";
      message = "This collection doesn't exist or is not accessible.";
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
// Pagination footer
// ---------------------------------------------------------------------------

interface PaginationFooterProps {
  itemCount: number;
  totalItems: number | undefined;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

function PaginationFooter({
  itemCount,
  totalItems,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: Readonly<PaginationFooterProps>) {
  const totalLabel = totalItems !== undefined ? `~${totalItems.toLocaleString()}` : "?";

  return (
    <div className="flex shrink-0 items-center justify-between border-t border-border bg-card px-6 py-4 text-[13px] text-[var(--cg-color-text-dim)]">
      <div>
        Showing {itemCount} of {totalLabel}
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!hasPrevious}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[13px] text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeftIcon className="size-3.5" />
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[13px] text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
          <ChevronRightIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface CollectionListViewProps {
  collection: string;
  cursor?: string;
  sort?: string;
}

export function CollectionListView({
  collection,
  cursor,
  sort,
}: Readonly<CollectionListViewProps>) {
  // useRouter gives us a stable router reference for imperative navigation
  // without requiring knowledge of the app's full route type registration.
  const router = useRouter();

  // --- Data ---
  const profile = useProfile();
  const entityInfo = profile.data?.find(
    (e) => e.name === collection || e.href.split("/").pop() === collection,
  );
  const entityTitle = entityInfo?.title ?? collection;

  const schema = useEntitySchema(collection);
  // RBAC hook point: canCreate gates empty-state affordance.
  // Fallback to true while schema is loading (permissive — see useEntityCapabilities).
  const capabilities = useEntityCapabilities(collection);
  const canCreate = capabilities.canCreate;

  const rawDisplayAttributes = schema.data ? pickDisplayAttributes(schema.data.attributes) : [];
  // When the entity has a content attribute, the primary cell renders a
  // file-type icon tile + filename/size meta line (mockup `.cell-primary`).
  const contentAttribute = schema.data?.attributes.find((a) => a.type === "content");
  // When the schema has no listable attributes, fall back to a synthetic
  // primary column that shows the item's display name or id.
  const hasFallback = !schema.isPending && rawDisplayAttributes.length === 0;
  const displayAttributes = rawDisplayAttributes;

  const listResult = useEntityList(collection, { cursor, sort });

  const isPending = schema.isPending || listResult.isPending;

  // --- Navigation helpers ---
  function goHome() {
    void router.navigate({ to: "/" as never });
  }

  function goToItem(itemId: string) {
    void router.navigate({
      to: "/$collection/$id" as never,
      params: { collection, id: itemId } as never,
    });
  }

  function goToPage(pageCursor: string | undefined) {
    void router.navigate({
      to: "/$collection" as never,
      params: { collection } as never,
      search: { cursor: pageCursor, sort } as never,
    });
  }

  function handleNext() {
    if (listResult.data?.nextHref) {
      goToPage(listResult.data.nextHref);
    }
  }

  function handlePrevious() {
    if (listResult.data?.prevHref) {
      goToPage(listResult.data.prevHref);
    }
  }

  // --- Derived column count for skeletons ---
  const colCount = isPending ? 5 : hasFallback ? 1 : displayAttributes.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageToolbar entityTitle={entityTitle} onBack={goHome} onHome={goHome} />

      <PageHead
        entityTitle={entityTitle}
        totalItems={listResult.data?.totalItems}
        isPending={isPending}
      />

      {/* Error state */}
      {listResult.isError ? (
        <ErrorState error={listResult.error} />
      ) : (
        <>
          {/* Table area */}
          <div className="min-h-0 flex-1 overflow-auto px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  {isPending ? (
                    // Skeleton placeholder header cells
                    SKELETON_CELL_KEYS.slice(0, colCount).map((key, i) => (
                      <TableHead key={key} className={i === 0 ? "w-[36%]" : ""}>
                        <Skeleton className="h-3 w-20" />
                      </TableHead>
                    ))
                  ) : hasFallback ? (
                    <TableHead className="w-[36%]">{entityTitle}</TableHead>
                  ) : (
                    displayAttributes.map((attr, i) => (
                      <TableHead key={attr.name} className={i === 0 ? "w-[36%]" : ""}>
                        {attr.title}
                      </TableHead>
                    ))
                  )}
                  {/* Trailing actions/chevron column */}
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>

              <TableBody>
                {isPending ? (
                  <SkeletonRows colCount={colCount + 1} />
                ) : (
                  listResult.data?.items.map((item) => {
                    const displayName = resolveDisplayName(
                      item.data,
                      item.id,
                      schema.data?.attributes ?? [],
                    );
                    return (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer"
                        role="button"
                        tabIndex={0}
                        aria-label={`View ${displayName}`}
                        onClick={() => goToItem(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            goToItem(item.id);
                          }
                        }}
                      >
                        {hasFallback ? (
                          <TableCell className="text-[13px] font-medium text-foreground">
                            {contentAttribute ? (
                              <PrimaryFileCell
                                displayName={displayName}
                                meta={readContentMeta(item.data[contentAttribute.name])}
                              />
                            ) : (
                              displayName
                            )}
                          </TableCell>
                        ) : (
                          displayAttributes.map((attr, i) => (
                            <TableCell
                              key={attr.name}
                              className={`text-[13px] text-foreground ${i === 0 ? "font-medium" : ""}`}
                            >
                              {i === 0 && contentAttribute ? (
                                <PrimaryFileCell
                                  displayName={displayName}
                                  meta={readContentMeta(item.data[contentAttribute.name])}
                                />
                              ) : (
                                formatAttributeValue(item.data[attr.name], attr.type)
                              )}
                            </TableCell>
                          ))
                        )}
                        {/* TODO(SLICE-4): row actions (edit, delete, RBAC visibility) */}
                        <TableCell className="text-right">
                          <ChevronRightIcon className="inline size-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* Empty state rendered below the table structure */}
            {!isPending && listResult.data?.items.length === 0 && (
              <EmptyState entityTitle={entityTitle} canCreate={canCreate} />
            )}
          </div>

          {/* Pagination footer — only shown once list data is available */}
          {!isPending && listResult.data && (
            <PaginationFooter
              itemCount={listResult.data.items.length}
              totalItems={listResult.data.totalItems}
              hasPrevious={listResult.data.hasPrevious}
              hasNext={listResult.data.hasNext}
              onPrevious={handlePrevious}
              onNext={handleNext}
            />
          )}
        </>
      )}
    </div>
  );
}
