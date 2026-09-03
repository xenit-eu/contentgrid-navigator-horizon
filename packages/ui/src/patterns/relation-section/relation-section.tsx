import { useState } from "react";
import {
  ArrowSquareOutIcon as ArrowSquareOut,
  CaretDownIcon as CaretDown,
  LinkIcon as Link,
  LinkBreakIcon as LinkBreak,
  PlusIcon as Plus,
} from "@phosphor-icons/react";
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
import { Badge } from "../../primitives/badge";
import { Button } from "../../primitives/button";
import { Card, CardContent, CardHeader } from "../../primitives/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../primitives/collapsible";
import { Skeleton } from "../../primitives/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../primitives/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../primitives/tooltip";

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

/** Column descriptor for the relation table */
export interface RelationColumn {
  /** Attribute name used to look up values in RelationItem.data */
  key: string;
  /** Human-readable column header */
  title: string;
}

export interface RelationSectionProps {
  /** Human-readable relation title, e.g. "Invoices" */
  title: string;
  /** Renders a destructive-styled required marker next to the title, matching FieldShell/BooleanRenderer. */
  required?: boolean;
  /** When true the section renders the to-one (many-to-one) compact card layout */
  isManyToOne?: boolean;
  /** Loaded relation items; undefined while loading */
  items?: RelationItem[];
  /** Column definitions; when empty the section falls back to rendering data keys */
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
  /** Called when the user clicks the detail / external-link icon for an item */
  onViewItem?: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getItemLabel(item: RelationItem): string {
  const firstVal = Object.entries(item.data).find(
    ([k, v]) => !k.startsWith("_") && k !== "id" && v != null,
  );
  return firstVal ? String(firstVal[1]) : item.id;
}

function resolveColumnKeys(items: RelationItem[], columns?: RelationColumn[]): string[] {
  if (columns && columns.length > 0) {
    return columns.map((c) => c.key).filter((k) => items[0] && k in items[0].data);
  }
  if (!items[0]) return [];
  return Object.keys(items[0].data).filter((k) => !k.startsWith("_") && k !== "id");
}

function getColumnTitle(key: string, columns?: RelationColumn[]): string {
  const col = columns?.find((c) => c.key === key);
  if (col) return col.title;
  return key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Matches the required marker in FieldShell/BooleanRenderer. */
function RequiredMarker() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function RelationSection({
  title,
  required,
  isManyToOne,
  items,
  columns,
  isLoading,
  error,
  isUnlinking,
  onUnlink,
  onLink,
  onViewItem,
}: Readonly<RelationSectionProps>) {
  const [unlinkTarget, setUnlinkTarget] = useState<{ id: string; label: string } | null>(null);

  const hasItems = !isLoading && !error && items && items.length > 0;
  const columnKeys = hasItems ? resolveColumnKeys(items, columns) : [];

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
  // Many-to-one layout: compact card
  // -------------------------------------------------------------------------
  if (isManyToOne) {
    return (
      <TooltipProvider>
        <Card className="py-4 gap-3">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {title}
                {required && <RequiredMarker />}
              </h3>
              {hasItems && onLink && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={onLink}
                >
                  <Plus className="size-4" />
                  Change
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            )}
            {!!error && <p className="text-sm text-destructive">Failed to load relation data.</p>}
            {!isLoading && !error && !hasItems && (
              <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-10">
                <div className="bg-muted rounded-full p-3">
                  <Link className="text-muted-foreground size-6" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">No {title.toLowerCase()} linked</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Link a {title.toLowerCase()} to this item
                  </p>
                </div>
                {onLink && (
                  <Button type="button" variant="outline" size="sm" onClick={onLink}>
                    <Plus className="size-4" />
                    Link {title}
                  </Button>
                )}
              </div>
            )}
            {hasItems &&
              items.map((item) => {
                const label = getItemLabel(item);
                return (
                  <div key={item.id} className="flex items-center gap-4 rounded-lg border p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{label}</p>
                      <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                        {columnKeys
                          .filter((k) => item.data[k] != null)
                          .slice(0, 3)
                          .map((key) => (
                            <span key={key}>
                              {getColumnTitle(key, columns)}: {String(item.data[key])}
                            </span>
                          ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {onViewItem && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => onViewItem(item.id)}
                            >
                              <ArrowSquareOut className="size-4" />
                              <span className="sr-only">View details</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View details</TooltipContent>
                        </Tooltip>
                      )}
                      {onUnlink && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => setUnlinkTarget({ id: item.id, label })}
                            >
                              <LinkBreak className="size-4" />
                              <span className="sr-only">Unlink</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Unlink</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>
        {unlinkDialog}
      </TooltipProvider>
    );
  }

  // -------------------------------------------------------------------------
  // Many-to-many layout: collapsible table
  // -------------------------------------------------------------------------
  const itemCount = items?.length ?? 0;

  return (
    <TooltipProvider>
      <Card className="py-4 gap-4">
        {!isLoading && !error && !hasItems ? (
          <>
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  {title}
                  {required && <RequiredMarker />}
                </h3>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-10">
                <div className="bg-muted rounded-full p-3">
                  <Link className="text-muted-foreground size-6" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">No {title.toLowerCase()} linked</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Link one or more {title.toLowerCase()} to this item
                  </p>
                </div>
                {onLink && (
                  <Button type="button" variant="outline" size="sm" onClick={onLink}>
                    <Plus className="size-4" />
                    Link {title}
                  </Button>
                )}
              </div>
            </CardContent>
          </>
        ) : (
          <Collapsible defaultOpen>
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <CollapsibleTrigger className="flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&[data-state=open]>svg.chevron]:rotate-180">
                  <h3 className="text-sm font-semibold">
                    {title}
                    {required && <RequiredMarker />}
                  </h3>
                  {!isLoading && !error && (
                    <Badge variant="secondary" className="text-xs">
                      {itemCount}
                    </Badge>
                  )}
                  <CaretDown
                    className={cn(
                      "chevron text-muted-foreground size-4 transition-transform duration-200",
                    )}
                  />
                </CollapsibleTrigger>
                {hasItems && onLink && (
                  <Button type="button" variant="outline" size="sm" onClick={onLink}>
                    <Plus className="size-4" />
                    Link {title}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                {isLoading && (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <Skeleton className="h-12 w-2/3 rounded-lg" />
                  </div>
                )}
                {!!error && (
                  <p className="text-sm text-destructive">Failed to load relation data.</p>
                )}
                {hasItems && (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {columnKeys.map((key) => (
                            <TableHead key={key}>{getColumnTitle(key, columns)}</TableHead>
                          ))}
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow
                            key={item.id}
                            className={cn(onViewItem && "cursor-pointer hover:bg-muted/50")}
                            onClick={onViewItem ? () => onViewItem(item.id) : undefined}
                          >
                            {columnKeys.map((key) => (
                              <TableCell key={key}>{formatCellValue(item.data[key])}</TableCell>
                            ))}
                            <TableCell>
                              {onUnlink && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-xs"
                                      className="text-muted-foreground hover:text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setUnlinkTarget({
                                          id: item.id,
                                          label: getItemLabel(item),
                                        });
                                      }}
                                    >
                                      <LinkBreak className="size-3" />
                                      <span className="sr-only">Unlink</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Unlink</TooltipContent>
                                </Tooltip>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        )}
      </Card>
      {unlinkDialog}
    </TooltipProvider>
  );
}
