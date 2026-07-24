import { useState } from "react";
import {
  ArrowDownIcon as ArrowDown,
  ArrowUpIcon as ArrowUp,
  ArrowsDownUpIcon as ArrowsDownUp,
  DotsThreeIcon as DotsThree,
  EyeIcon as Eye,
  LinkBreakIcon as LinkBreak,
  PencilSimpleIcon as PencilSimple,
  TrashIcon as Trash,
  TrayIcon as Tray,
} from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../primitives/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../primitives/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../primitives/tooltip";

export interface DataTableColumn {
  /** Machine-readable key matching a key in DataTableRow.data */
  key: string;
  /** Header label displayed in the column */
  header: string;
  /** Whether this column can be sorted. Defaults to false. */
  sortable?: boolean;
}

export interface DataTableRow {
  /** Unique identifier for this row */
  id: string;
  /** Column data keyed by DataTableColumn.key */
  data: Record<string, unknown>;
}

export interface SortOption {
  value: string;
  property: string;
  prompt: string;
}

export interface DataTableProps {
  /** Entity identifier used in empty-state messaging and action callbacks */
  entityName: string;
  /** Human-readable entity title used in empty-state messaging */
  entityTitle?: string;
  /** Column definitions */
  columns: DataTableColumn[];
  /** Rows to display */
  rows: DataTableRow[];
  /** Currently active sort string, e.g. "name,asc" */
  currentSort?: string;
  /** Called when the user clicks a sortable column header */
  onSort?: (field: string) => void;
  /** Sort options for tooltip labels */
  sortOptions?: SortOption[];
  /** Called when the user clicks the create-new button in the empty state */
  onCreateClick?: () => void;
  /** Called when the user clicks "View details" from the row action menu */
  onViewDetails?: (id: string) => void;
  /** Called when the user clicks "Edit" from the row action menu */
  onEdit?: (id: string) => void;
  /** Called when the user confirms deletion. If undefined the Delete action is hidden. */
  onDelete?: (id: string) => void;
  /** When true, the delete confirmation dialog shows a loading state */
  isDeleting?: boolean;
  /** Called immediately when the user clicks the inline unlink icon on a row. If undefined the unlink button is hidden. */
  onUnlink?: (id: string) => void;
  /** When true, the unlink icon buttons are disabled */
  isUnlinking?: boolean;
  /** Called when the user clicks the row itself (outside the action menu) */
  onRowClick?: (id: string) => void;
}

export function DataTable({
  entityName,
  entityTitle,
  columns,
  rows,
  currentSort,
  onSort,
  sortOptions,
  onCreateClick,
  onViewDetails,
  onEdit,
  onDelete,
  isDeleting,
  onUnlink,
  isUnlinking,
  onRowClick,
}: Readonly<DataTableProps>) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function getSortIcon(key: string) {
    const isAsc = currentSort === `${key},asc`;
    const isDesc = currentSort === `${key},desc`;
    if (isAsc) return <ArrowUp className="ml-1 size-3.5" data-sort-direction="asc" />;
    if (isDesc) return <ArrowDown className="ml-1 size-3.5" data-sort-direction="desc" />;
    return (
      <ArrowsDownUp className="ml-1 size-3.5 text-muted-foreground/50" data-sort-direction="none" />
    );
  }

  function getSortTooltip(key: string): string | undefined {
    if (!sortOptions) return undefined;
    const isAsc = currentSort === `${key},asc`;
    const isDesc = currentSort === `${key},desc`;
    let nextSort: string | undefined;
    if (isAsc) {
      nextSort = `${key},desc`;
    } else if (isDesc) {
      nextSort = undefined;
    } else {
      nextSort = `${key},asc`;
    }
    const nextPrompt = nextSort
      ? sortOptions.find((o) => o.property === key && o.value === nextSort)?.prompt
      : undefined;
    const currentPrompt = sortOptions.find(
      (o) => o.property === key && o.value === currentSort,
    )?.prompt;
    return nextPrompt ?? currentPrompt;
  }

  const hasActions = !!(onViewDetails || onEdit || onDelete || onUnlink);

  return (
    <>
      <TooltipProvider>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col, i) => (
                  <TableHead key={col.key} className={cn(i === 0 && "pl-4")}>
                    {col.sortable && onSort ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-8"
                            title={getSortTooltip(col.key)}
                            onClick={() => onSort(col.key)}
                          >
                            {col.header}
                            {getSortIcon(col.key)}
                          </Button>
                        </TooltipTrigger>
                        {getSortTooltip(col.key) && (
                          <TooltipContent side="bottom" className="max-w-xs">
                            {getSortTooltip(col.key)}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                ))}
                {hasActions && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(onRowClick && "cursor-pointer hover:bg-muted/50")}
                    onClick={() => onRowClick?.(row.id)}
                  >
                    {columns.map((col, i) => (
                      <TableCell key={col.key} className={cn(i === 0 && "pl-4")}>
                        {row.data[col.key] == null ? "—" : String(row.data[col.key])}
                      </TableCell>
                    ))}
                    {hasActions && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {onUnlink && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  disabled={isUnlinking}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onUnlink(row.id);
                                  }}
                                >
                                  <LinkBreak className="h-4 w-4" />
                                  <span className="sr-only">Unlink</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Unlink</TooltipContent>
                            </Tooltip>
                          )}
                          {(onViewDetails || onEdit || onDelete) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <DotsThree className="h-4 w-4" />
                                  <span className="sr-only">Open menu</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {onViewDetails && (
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onViewDetails(row.id);
                                    }}
                                  >
                                    <Eye className="mr-2 h-4 w-4" />
                                    View details
                                  </DropdownMenuItem>
                                )}
                                {onEdit && (
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEdit(row.id);
                                    }}
                                  >
                                    <PencilSimple className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                )}
                                {onDelete && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteId(row.id);
                                      }}
                                    >
                                      <Trash className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length + (hasActions ? 1 : 0)} className="h-48">
                    <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                      <Tray className="h-10 w-10" />
                      <p className="text-lg font-medium">No items found</p>
                      <Button variant="outline" size="sm" onClick={onCreateClick}>
                        Add new item to {entityTitle ?? entityName}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </TooltipProvider>

      {onDelete && deleteId && (
        <AlertDialog
          open={!!deleteId}
          onOpenChange={(open) => {
            if (!open) setDeleteId(null);
          }}
        >
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete item</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this {(entityTitle ?? entityName).toLowerCase()}?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  onDelete(deleteId);
                  setDeleteId(null);
                }}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
