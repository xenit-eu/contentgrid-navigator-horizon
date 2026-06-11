import { useState } from "react";
import { ArrowUpRight, ChevronDown, FileTextIcon, Link2Off, LinkIcon, Plus } from "lucide-react";
import { cn, formatCellValue } from "../../lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../primitives/alert-dialog";
import { Button } from "../../primitives/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../primitives/collapsible";
import { Skeleton } from "../../primitives/skeleton";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A single related item row */
export interface RelationItem {
  /** Unique identifier for this related item */
  id: string;
  /** Attribute data keyed by attribute name */
  data: Record<string, unknown>;
}

/**
 * Column descriptor — kept for backward-compatibility with existing consumers
 * that pass a `columns` prop. Not used for rendering (no table layout).
 */
export interface RelationColumn {
  /** Attribute name used to look up values in RelationItem.data */
  key: string;
  /** Human-readable column header */
  title: string;
}

/** Maximum number of items rendered before the "View all" affordance */
const MAX_VISIBLE_ITEMS = 5;

export interface RelationSectionProps {
  /** Human-readable relation title, e.g. "Invoices" */
  title: string;
  /** When true the section renders the to-one (many-to-one) compact card layout */
  isManyToOne?: boolean;
  /** Loaded relation items; undefined while loading */
  items?: RelationItem[];
  /**
   * Column definitions — accepted for backward-compatibility; no longer used
   * to render a table. Pass it if you have it; it won't break anything.
   */
  columns?: RelationColumn[];
  /** True while the relation data is being fetched */
  isLoading?: boolean;
  /** Non-null when the relation data failed to load */
  error?: unknown;
  /** True while an unlink mutation is in progress */
  isUnlinking?: boolean;
  /** Called when the user confirms unlinking an item */
  onUnlink?: (id: string) => void;
  /** Called when the user clicks the "Link" / "Change" button */
  onLink?: () => void;
  /** Called when the user clicks a relation item row */
  onViewItem?: (id: string) => void;
  /**
   * Total item count from the server (may exceed the number of items rendered).
   * When provided, shown in the accordion header and used in the "View all" label.
   */
  totalCount?: number;
  /** Called when the user clicks the "View all N" affordance */
  onViewAll?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HAL_KEYS = new Set(["_links", "_templates", "_embedded"]);
const SYSTEM_KEY_NAMES = new Set([
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

/**
 * Return the primary display label for a relation item.
 * Picks the first non-null, non-HAL, non-system string field; falls back to id.
 */
function getItemLabel(item: RelationItem): string {
  const entry = Object.entries(item.data).find(
    ([k, v]) =>
      !k.startsWith("_") && !HAL_KEYS.has(k) && !SYSTEM_KEY_NAMES.has(k) && k !== "id" && v != null,
  );
  return entry ? String(entry[1]) : item.id;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/** Format a single raw value to a display string (no JSX). */
function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") {
    if (value.trim() !== "" && !Number.isNaN(Number(value))) return Number(value).toLocaleString();
    if (ISO_DATE_RE.test(value)) {
      const hasTime = value.includes("T");
      try {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) {
          if (hasTime) {
            return d.toLocaleString(undefined, {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
          }
          return d.toLocaleDateString(undefined, {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
        }
      } catch {
        // fall through
      }
    }
    return value;
  }
  return formatCellValue(value);
}

/**
 * Derive a single condensed meta line for a relation item.
 *
 * Joins up to TWO secondary displayable field values with " · ".
 * Skips the name field (used as label), HAL envelope keys, system keys,
 * and null/empty values. Falls back to the item self-path or id.
 */
function getItemMeta(item: RelationItem, labelKey: string | null): string {
  const secondaryValues: string[] = [];

  for (const [k, v] of Object.entries(item.data)) {
    if (secondaryValues.length >= 2) break;
    if (k.startsWith("_")) continue;
    if (HAL_KEYS.has(k)) continue;
    if (SYSTEM_KEY_NAMES.has(k)) continue;
    if (k === "id") continue;
    if (k === labelKey) continue;
    if (v === null || v === undefined || v === "") continue;

    const formatted = formatFieldValue(v);
    if (formatted) secondaryValues.push(formatted);
  }

  if (secondaryValues.length > 0) return secondaryValues.join(" · ");

  // Fallback: item id (the URL segment, not a UUID in full)
  return item.id;
}

/**
 * Find the key corresponding to getItemLabel's result (so we can skip it in meta).
 */
function getLabelKey(item: RelationItem): string | null {
  const entry = Object.entries(item.data).find(
    ([k, v]) =>
      !k.startsWith("_") && !HAL_KEYS.has(k) && !SYSTEM_KEY_NAMES.has(k) && k !== "id" && v != null,
  );
  return entry ? entry[0] : null;
}

// ---------------------------------------------------------------------------
// RelationItemRow
// ---------------------------------------------------------------------------

interface RelationItemRowProps {
  item: RelationItem;
  isLast: boolean;
  onViewItem?: (id: string) => void;
  onUnlinkRequest?: (id: string, label: string) => void;
}

/**
 * Derive the icon tile tint for a relation item.
 *
 * Heuristic: items whose primary label looks like a document reference (ends in a
 * common doc extension, or whose id path contains "pdf") get the amber/PDF tint;
 * all others get the steel tint that matches the "building/org" mockup style.
 * These are display-only — they carry no semantic meaning and will be revisited
 * when the entity-type icon system is wired up.
 */
function getItemTintClass(item: RelationItem): {
  bg: string;
  borderColor: string;
  color: string;
} {
  const label = getItemLabel(item);
  const lowerLabel = label.toLowerCase();
  const lowerId = item.id.toLowerCase();
  const isPdfLike =
    lowerLabel.endsWith(".pdf") ||
    lowerId.includes(".pdf") ||
    lowerLabel.endsWith(".doc") ||
    lowerLabel.endsWith(".docx");

  if (isPdfLike) {
    return {
      bg: "var(--cg-color-pdf-bg)",
      borderColor: "#F2D6C2",
      color: "var(--cg-color-pdf-fg)",
    };
  }
  return {
    bg: "var(--cg-tint-steel-bg)",
    borderColor: "#D2DFE8",
    color: "var(--cg-tint-steel-fg)",
  };
}

function RelationItemRow({ item, isLast, onViewItem, onUnlinkRequest }: RelationItemRowProps) {
  const label = getItemLabel(item);
  const labelKey = getLabelKey(item);
  const meta = getItemMeta(item, labelKey);

  const tint = getItemTintClass(item);

  // Decide which icon to use — FileText for items that look document-bearing, Box otherwise
  const Icon = FileTextIcon;

  // Icon tile + name + meta — shared inner content for both the interactive
  // (button) and the non-interactive (plain div) variants.
  const itemContent = (
    <>
      {/* Item icon — tinted tile per mockup .rel-item-ic / .ric-pdf / .ric-steel */}
      <div
        className="grid size-6 shrink-0 place-items-center rounded-[5px] border"
        style={{ background: tint.bg, borderColor: tint.borderColor, color: tint.color }}
      >
        <Icon className="size-3" />
      </div>

      {/* Name + meta */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-foreground">{label}</div>
        <div className="truncate text-[11px] text-muted-foreground">{meta}</div>
      </div>
    </>
  );

  // The row is a NON-interactive container. Interactive controls (the primary
  // view button and the optional unlink button) are SIBLINGS inside it, never
  // nested — this avoids the axe `nested-interactive` violation.
  return (
    <div className={cn("flex items-center gap-2.5", !isLast && "border-b border-border/50")}>
      {/* Primary view target — a real button filling the icon+name+meta area */}
      {onViewItem ? (
        <button
          type="button"
          onClick={() => onViewItem(item.id)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-2 text-left hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {itemContent}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2.5 px-1.5 py-2">{itemContent}</div>
      )}

      {/* Unlink button — sibling of the primary button (not nested) */}
      {onUnlinkRequest && (
        <button
          type="button"
          title="Unlink"
          aria-label="Unlink"
          className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onUnlinkRequest(item.id, label)}
        >
          <Link2Off className="size-3.5" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function RelationSection({
  title,
  isManyToOne,
  items,
  isLoading,
  error,
  isUnlinking,
  onUnlink,
  onLink,
  onViewItem,
  totalCount,
  onViewAll,
}: Readonly<RelationSectionProps>) {
  const [unlinkTarget, setUnlinkTarget] = useState<{ id: string; label: string } | null>(null);

  const hasItems = !isLoading && !error && items && items.length > 0;
  const kindLabel = isManyToOne ? "· to-one" : "· to-many";

  // Displayed count: prefer totalCount (server total), fall back to items length
  const displayCount = totalCount != null ? totalCount : (items?.length ?? 0);

  // Visible items slice for to-many
  const visibleItems = hasItems ? items.slice(0, MAX_VISIBLE_ITEMS) : [];

  // Whether to show the "View all" affordance
  const showViewAll =
    !isManyToOne && hasItems && onViewAll != null && (totalCount == null || totalCount > 0);

  function handleUnlink() {
    if (!unlinkTarget) return;
    onUnlink?.(unlinkTarget.id);
    setUnlinkTarget(null);
  }

  const unlinkDialog = onUnlink ? (
    <AlertDialog
      open={unlinkTarget !== null}
      onOpenChange={(open) => !open && setUnlinkTarget(null)}
    >
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Unlink {title.toLowerCase()}</AlertDialogTitle>
          <AlertDialogDescription>
            Remove the link to &ldquo;{unlinkTarget?.label}&rdquo;? This will not delete the{" "}
            {title.toLowerCase()} itself.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleUnlink} disabled={isUnlinking}>
            {isUnlinking ? "Unlinking..." : "Unlink"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;

  // -------------------------------------------------------------------------
  // Empty state (no items, not loading, no error)
  // -------------------------------------------------------------------------
  if (!isLoading && !error && items && items.length === 0) {
    return (
      <>
        <div className="mb-2 overflow-hidden rounded-lg border border-border">
          {/* Accordion head */}
          <div className="flex items-center gap-2.5 bg-card px-3 py-2.5">
            <span className="flex-1 text-[13px] font-medium text-foreground">
              {title}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">{kindLabel}</span>
            </span>
            <span className="tabular-nums text-xs text-muted-foreground">0</span>
          </div>
          {/* Empty body */}
          <div className="border-t border-border bg-[var(--cg-color-mist)] px-3 py-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="rounded-full bg-muted p-2.5">
                <LinkIcon className="size-4 text-muted-foreground" />
              </div>
              <p className="text-[13px] text-muted-foreground">No {title.toLowerCase()} linked</p>
              {onLink && (
                <Button variant="outline" size="sm" onClick={onLink}>
                  <Plus className="size-4" />
                  Link {title}
                </Button>
              )}
            </div>
          </div>
        </div>
        {unlinkDialog}
      </>
    );
  }

  // -------------------------------------------------------------------------
  // Main accordion layout (loading / error / items)
  // -------------------------------------------------------------------------
  return (
    <>
      <Collapsible defaultOpen className="mb-2 overflow-hidden rounded-lg border border-border">
        {/* Accordion head */}
        <CollapsibleTrigger className="flex w-full items-center gap-2.5 bg-card px-3 py-2.5 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 [&[data-state=open]>svg.chevron]:rotate-180">
          <span className="flex-1 text-left text-[13px] font-medium text-foreground">
            {title}
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">{kindLabel}</span>
          </span>
          {!isLoading && !error && (
            <span className="tabular-nums text-xs text-muted-foreground">{displayCount}</span>
          )}
          <ChevronDown className="chevron size-3.5 shrink-0 text-muted-foreground transition-transform duration-150" />
        </CollapsibleTrigger>

        {/* Accordion body */}
        <CollapsibleContent>
          <div className="border-t border-border bg-[var(--cg-color-mist)] px-3 py-1.5">
            {/* Loading state */}
            {isLoading && (
              <div className="space-y-2 py-1">
                <Skeleton className="h-9 w-full rounded-md" />
                <Skeleton className="h-9 w-4/5 rounded-md" />
              </div>
            )}

            {/* Error state */}
            {!!error && (
              <p className="py-2 text-sm text-destructive">Failed to load relation data.</p>
            )}

            {/* Item list */}
            {hasItems &&
              visibleItems.map((item, i) => (
                <RelationItemRow
                  key={item.id}
                  item={item}
                  isLast={i === visibleItems.length - 1 && !showViewAll}
                  onViewItem={onViewItem}
                  onUnlinkRequest={
                    onUnlink ? (id, label) => setUnlinkTarget({ id, label }) : undefined
                  }
                />
              ))}

            {/* View all affordance */}
            {showViewAll && (
              <button
                type="button"
                onClick={onViewAll}
                className="mt-0.5 inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-[13px] font-semibold text-[var(--cg-color-link-text)] transition-colors hover:bg-[var(--cg-color-mist)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                View all {totalCount != null ? totalCount : items?.length} {title.toLowerCase()}
                <ArrowUpRight className="size-3.5" />
              </button>
            )}

            {/* Link button (to-one "Change" / to-many "Link") — shown when items loaded */}
            {hasItems && onLink && (
              <div className="mt-1 border-t border-border/50 pt-1">
                <button
                  type="button"
                  onClick={onLink}
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Plus className="size-3.5" />
                  {isManyToOne ? "Change" : `Link ${title}`}
                </button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
      {unlinkDialog}
    </>
  );
}
